import { AIProviderConfig, TavilyConfig } from '../types/agent';

const AI_PROVIDERS_KEY = 'tara_ai_api_providers';
const TAVILY_CONFIG_KEY = 'tara_tavily_config';
export const MASKED_SECRET = '••••••••';

export function isMasked(value: string | undefined): boolean {
  if (!value) return false;
  return value.includes('••••') || value === MASKED_SECRET;
}

export function maskSecret(secret: string | undefined): string {
  if (!secret || secret.trim() === '') return '';
  return MASKED_SECRET;
}

const DEFAULT_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'gemini-default',
    type: 'gemini',
    name: 'Google Gemini',
    apiKey: '',
    model: 'gemini-2.5-flash',
    enabled: true,
    isDefault: true,
    priority: 1,
    testStatus: 'UNTESTED'
  },
  {
    id: 'openai-default',
    type: 'openai',
    name: 'OpenAI (GPT-4o)',
    apiKey: '',
    model: 'gpt-4o-mini',
    enabled: false,
    priority: 2,
    testStatus: 'UNTESTED'
  },
  {
    id: 'anthropic-default',
    type: 'anthropic',
    name: 'Anthropic Claude',
    apiKey: '',
    model: 'claude-3-5-sonnet',
    enabled: false,
    priority: 3,
    testStatus: 'UNTESTED'
  },
  {
    id: 'groq-default',
    type: 'groq',
    name: 'Groq Cloud',
    apiKey: '',
    model: 'llama-3.3-70b-versatile',
    enabled: false,
    priority: 4,
    testStatus: 'UNTESTED'
  },
  {
    id: 'deepseek-default',
    type: 'deepseek',
    name: 'DeepSeek AI',
    apiKey: '',
    model: 'deepseek-chat',
    enabled: false,
    priority: 5,
    testStatus: 'UNTESTED'
  }
];

const DEFAULT_TAVILY: TavilyConfig = {
  apiKey: '',
  enabled: false,
  searchDepth: 'basic',
  maxResults: 5,
  testStatus: 'UNTESTED'
};

type StoreSubscriber = () => void;

class ProviderStore {
  private subscribers: Set<StoreSubscriber> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === AI_PROVIDERS_KEY || e.key === TAVILY_CONFIG_KEY) {
          this.notifySubscribers();
        }
      });
      window.addEventListener('tara_storage_update', () => {
        this.notifySubscribers();
      });
    }
  }

  public subscribe(callback: StoreSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Error in providerStore subscriber', err);
      }
    });
  }

  private emitUpdate(key: string) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('tara_storage_update', { detail: { key } })
      );
    }
    this.notifySubscribers();
  }

  // --- AI Providers ---

  public loadProviders(): AIProviderConfig[] {
    if (typeof window === 'undefined') return DEFAULT_PROVIDERS;
    try {
      const raw = localStorage.getItem(AI_PROVIDERS_KEY);
      if (!raw) {
        this.saveProviders(DEFAULT_PROVIDERS, false);
        return DEFAULT_PROVIDERS;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return DEFAULT_PROVIDERS;
      }
      return parsed;
    } catch (e) {
      console.error('Failed to parse AI providers from localStorage, using fallback', e);
      return DEFAULT_PROVIDERS;
    }
  }

  public saveProviders(providers: AIProviderConfig[], notify: boolean = true): void {
    if (typeof window === 'undefined') return;
    try {
      const serialized = JSON.stringify(providers);
      localStorage.setItem(AI_PROVIDERS_KEY, serialized);

      // Synchronous read-back verification
      const verify = localStorage.getItem(AI_PROVIDERS_KEY);
      if (verify !== serialized) {
        throw new Error('Read-back verification failed for AI providers storage');
      }

      if (notify) {
        this.emitUpdate(AI_PROVIDERS_KEY);
      }
    } catch (e) {
      console.error('Critical error saving AI providers to localStorage:', e);
      throw e;
    }
  }

  public addProvider(newProvider: Omit<AIProviderConfig, 'id'>): AIProviderConfig {
    const providers = this.loadProviders();
    const id = `provider-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const fullProvider: AIProviderConfig = {
      ...newProvider,
      id
    };
    providers.push(fullProvider);
    this.saveProviders(providers);
    return fullProvider;
  }

  public updateProvider(id: string, updates: Partial<AIProviderConfig>): AIProviderConfig {
    const providers = this.loadProviders();
    const index = providers.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Provider not found: ${id}`);
    }

    const existing = providers[index];
    let finalApiKey = updates.apiKey;

    // Masked secret protection
    if (finalApiKey !== undefined) {
      if (isMasked(finalApiKey) || finalApiKey.trim() === '') {
        finalApiKey = existing.apiKey;
      }
    } else {
      finalApiKey = existing.apiKey;
    }

    const updated: AIProviderConfig = {
      ...existing,
      ...updates,
      apiKey: finalApiKey
    };

    providers[index] = updated;
    this.saveProviders(providers);
    return updated;
  }

  public removeProvider(id: string): void {
    const providers = this.loadProviders();
    const filtered = providers.filter((p) => p.id !== id);
    this.saveProviders(filtered);
  }

  public toggleProvider(id: string, enabled?: boolean): AIProviderConfig {
    const providers = this.loadProviders();
    const index = providers.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Provider not found: ${id}`);
    }
    const current = providers[index];
    const newEnabled = enabled !== undefined ? enabled : !current.enabled;
    const updated = { ...current, enabled: newEnabled };
    providers[index] = updated;
    this.saveProviders(providers);
    return updated;
  }

  public getProviderById(id: string): AIProviderConfig | undefined {
    return this.loadProviders().find((p) => p.id === id);
  }

  public getActiveProvider(): AIProviderConfig | undefined {
    const providers = this.loadProviders();
    return providers.find((p) => p.enabled && p.apiKey && p.apiKey.trim() !== '') || 
           providers.find((p) => p.enabled) ||
           providers[0];
  }

  // --- Tavily Search Config ---

  public getTavilyConfig(): TavilyConfig {
    if (typeof window === 'undefined') return DEFAULT_TAVILY;
    try {
      const raw = localStorage.getItem(TAVILY_CONFIG_KEY);
      if (!raw) return DEFAULT_TAVILY;
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_TAVILY, ...parsed };
    } catch (e) {
      console.error('Failed to parse Tavily config from localStorage', e);
      return DEFAULT_TAVILY;
    }
  }

  public saveTavilyConfig(updates: Partial<TavilyConfig>): TavilyConfig {
    if (typeof window === 'undefined') return DEFAULT_TAVILY;
    try {
      const existing = this.getTavilyConfig();
      let finalApiKey = updates.apiKey;

      if (finalApiKey !== undefined) {
        if (isMasked(finalApiKey) || finalApiKey.trim() === '') {
          finalApiKey = existing.apiKey;
        }
      } else {
        finalApiKey = existing.apiKey;
      }

      const merged: TavilyConfig = {
        ...existing,
        ...updates,
        apiKey: finalApiKey
      };

      const serialized = JSON.stringify(merged);
      localStorage.setItem(TAVILY_CONFIG_KEY, serialized);

      // Read-back verification
      const verify = localStorage.getItem(TAVILY_CONFIG_KEY);
      if (verify !== serialized) {
        throw new Error('Read-back verification failed for Tavily storage');
      }

      this.emitUpdate(TAVILY_CONFIG_KEY);
      return merged;
    } catch (e) {
      console.error('Critical error saving Tavily config to localStorage:', e);
      throw e;
    }
  }
}

export const providerStore = new ProviderStore();
