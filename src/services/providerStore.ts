/**
 * Axiom AI & Tavily Provider Store
 * Browser localStorage as the Single Source of Truth for Custom AI & Search Providers.
 *
 * Requirements:
 * - Dedicated keys: 'tara_ai_api_providers' and 'tara_tavily_config'
 * - Instant synchronous write & read-back verification
 * - Multi-tab synchronization via browser 'storage' event
 * - Resilient JSON parsing & non-blocking error handling (never crash or show black screen)
 * - Safe API key preservation (visual masking '••••' never overwrites real key)
 * - Strict separation from conflicting server/database persistence
 */

import { AIProviderConfig, ProviderTestStatus, SearchProviderConfig } from '../types/agent.ts';

export const AI_PROVIDERS_KEY = 'tara_ai_api_providers';
export const TAVILY_CONFIG_KEY = 'tara_tavily_config';
export const SEARCH_PROVIDERS_KEY = 'tara_search_providers';

export interface TavilyConfig {
  apiKey: string;
  enabled: boolean;
  baseUrl?: string;
  searchDepth?: 'basic' | 'advanced';
  maxResults?: number;
  lastTestedAt?: string;
  lastTestStatus?: ProviderTestStatus;
  lastError?: string;
  lastLatencyMs?: number;
}

type ProviderSubscriber = (providers: AIProviderConfig[]) => void;
type TavilySubscriber = (config: TavilyConfig) => void;
type ErrorSubscriber = (error: string) => void;

class ProviderStoreService {
  private static instance: ProviderStoreService;
  private memoryAiProviders: AIProviderConfig[] | null = null;
  private memoryTavilyConfig: TavilyConfig | null = null;
  private subscribers: Set<ProviderSubscriber> = new Set();
  private tavilySubscribers: Set<TavilySubscriber> = new Set();
  private errorSubscribers: Set<ErrorSubscriber> = new Set();
  private isStorageListening = false;

  private constructor() {
    this.initStorageListener();
  }

  public static getInstance(): ProviderStoreService {
    if (!ProviderStoreService.instance) {
      ProviderStoreService.instance = new ProviderStoreService();
    }
    return ProviderStoreService.instance;
  }

  /**
   * Safe check for localStorage availability.
   * Handles Safari private mode, disabled cookies, quota exceeded, or SSR contexts.
   */
  private isStorageAvailable(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    try {
      const testKey = '__axiom_ls_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initializes multi-tab synchronization via the window 'storage' event.
   */
  private initStorageListener(): void {
    if (typeof window === 'undefined' || this.isStorageListening) return;

    try {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === AI_PROVIDERS_KEY) {
          const fresh = this.loadProviders();
          this.notifySubscribers(fresh);
        } else if (event.key === TAVILY_CONFIG_KEY) {
          const freshTavily = this.loadTavilyConfig();
          this.notifyTavilySubscribers(freshTavily);
        }
      });
      this.isStorageListening = true;
    } catch (err) {
      console.warn('[ProviderStore] Failed to register storage event listener:', err);
    }
  }

  /**
   * Normalizes raw object into a validated, typed AIProviderConfig.
   */
  public normalizeProvider(raw: any, index = 0): AIProviderConfig {
    const rawId = raw?.id ? String(raw.id).trim() : '';
    const id = rawId || `ai-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const name = raw?.name ? String(raw.name).trim() : 'Custom AI Provider';
    const type = raw?.type || 'openai-compatible';
    const rawApiKey = typeof raw?.apiKey === 'string' ? raw.apiKey.trim() : '';
    
    // Normalize model identifiers
    const model = raw?.model || raw?.modelName || raw?.defaultModel || 'gpt-4o-mini';
    const modelName = model;
    const defaultModel = raw?.defaultModel || model;

    // Base URL normalization
    let baseUrl = typeof raw?.baseUrl === 'string' ? raw.baseUrl.trim() : '';
    if (!baseUrl) {
      if (type === 'openrouter') {
        baseUrl = 'https://openrouter.ai/api/v1';
      } else if (type === 'gemini') {
        baseUrl = 'https://generativelanguage.googleapis.com';
      } else {
        baseUrl = 'https://api.openai.com/v1';
      }
    }

    const priority =
      typeof raw?.priority === 'number' && !isNaN(raw.priority) && raw.priority > 0
        ? raw.priority
        : index + 1;

    const enabled = typeof raw?.enabled === 'boolean' ? raw.enabled : true;

    const timeout =
      typeof raw?.timeout === 'number' && raw.timeout > 0
        ? raw.timeout
        : typeof raw?.timeoutMs === 'number' && raw.timeoutMs > 0
        ? raw.timeoutMs
        : 30000;

    const maxRetries =
      typeof raw?.maxRetries === 'number' && !isNaN(raw.maxRetries)
        ? Math.max(0, Math.min(5, raw.maxRetries))
        : 2;

    return {
      id,
      name,
      type,
      baseUrl,
      apiKey: rawApiKey,
      hasKey: Boolean(rawApiKey && rawApiKey.length > 0),
      modelName,
      defaultModel,
      priority,
      enabled,
      timeoutMs: timeout,
      maxRetries,
      maxTokens: typeof raw?.maxTokens === 'number' ? raw.maxTokens : 4000,
      temperature: typeof raw?.temperature === 'number' ? raw.temperature : 0.7,
      headers: raw?.headers && typeof raw.headers === 'object' ? raw.headers : {},
      capabilities: {
        jsonMode: raw?.capabilities?.jsonMode ?? true,
        toolCalling: raw?.capabilities?.toolCalling ?? false,
        webGrounding: raw?.capabilities?.webGrounding ?? false,
        vision: raw?.capabilities?.vision ?? false,
      },
      lastTestedAt: raw?.lastTestedAt,
      lastTestStatus: raw?.lastTestStatus || 'NEVER_TESTED',
      lastError: raw?.lastError,
      lastLatencyMs: raw?.lastLatencyMs,
      usageInfo: raw?.usageInfo,
      createdAt: raw?.createdAt || new Date().toISOString(),
      updatedAt: raw?.updatedAt || new Date().toISOString(),
    };
  }

  /**
   * Normalizes Tavily configuration.
   */
  public normalizeTavilyConfig(raw: any): TavilyConfig {
    const rawApiKey = typeof raw?.apiKey === 'string' ? raw.apiKey.trim() : '';
    return {
      apiKey: rawApiKey,
      enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : Boolean(rawApiKey),
      baseUrl: raw?.baseUrl || 'https://api.tavily.com',
      searchDepth: raw?.searchDepth || 'advanced',
      maxResults: typeof raw?.maxResults === 'number' ? raw.maxResults : 6,
      lastTestedAt: raw?.lastTestedAt,
      lastTestStatus: raw?.lastTestStatus || 'NEVER_TESTED',
      lastError: raw?.lastError,
      lastLatencyMs: raw?.lastLatencyMs,
    };
  }

  // =========================================================================
  // AI PROVIDERS CRUD OPERATIONS
  // =========================================================================

  /**
   * Reads tara_ai_api_providers from localStorage.
   * Safe parsing, structure validation, and non-blocking error handling.
   * If empty or invalid, returns []. Never throws or causes a black screen.
   */
  public loadProviders(): AIProviderConfig[] {
    if (!this.isStorageAvailable()) {
      return this.memoryAiProviders || [];
    }

    try {
      const rawJson = window.localStorage.getItem(AI_PROVIDERS_KEY);
      if (!rawJson || rawJson.trim() === '') {
        return [];
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawJson);
      } catch (parseError) {
        console.warn('[ProviderStore] Corrupted JSON in localStorage. Safely resetting to [] without crashing.');
        this.notifyError('Corrupted provider storage recovered. Reset to safe empty list.');
        return [];
      }

      if (!Array.isArray(parsed)) {
        console.warn('[ProviderStore] Non-array payload in localStorage. Resetting to [].');
        return [];
      }

      const providers = parsed
        .map((item, idx) => this.normalizeProvider(item, idx))
        .sort((a, b) => a.priority - b.priority);

      this.memoryAiProviders = providers;
      return providers;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[ProviderStore] Error accessing localStorage in loadProviders:', msg);
      return this.memoryAiProviders || [];
    }
  }

  /**
   * Saves the complete provider array directly to localStorage.
   * Performs read-back verification to guarantee data persistence.
   */
  public saveProviders(providers: AIProviderConfig[]): boolean {
    const normalized = providers
      .map((p, idx) => this.normalizeProvider(p, idx))
      .sort((a, b) => a.priority - b.priority);

    this.memoryAiProviders = normalized;

    if (!this.isStorageAvailable()) {
      this.notifySubscribers(normalized);
      return true;
    }

    try {
      const json = JSON.stringify(normalized);
      window.localStorage.setItem(AI_PROVIDERS_KEY, json);

      // Verify that localStorage actually contains the saved data
      const readBack = window.localStorage.getItem(AI_PROVIDERS_KEY);
      if (!readBack || readBack !== json) {
        throw new Error('Verification failed: Written data does not match storage.');
      }

      // Parse and perform read-back sanity checks
      const parsed = JSON.parse(readBack);
      if (!Array.isArray(parsed)) {
        throw new Error('Verification failed: Stored data is not an array.');
      }

      for (const item of parsed) {
        if (item.apiKey && typeof item.apiKey === 'string' && item.apiKey.includes('••••')) {
          console.error('[ProviderStore] Masked string detected in stored key for provider:', item.id);
          throw new Error(`Verification failed: Masked key was written to localStorage for provider ${item.id}`);
        }
      }

      this.notifySubscribers(normalized);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[ProviderStore] Failed to save providers to localStorage:', msg);
      this.notifyError(`Failed to persist provider settings: ${msg}`);
      // Notify subscribers with memory state so UI doesn't freeze
      this.notifySubscribers(normalized);
      return false;
    }
  }

  /**
   * Adds a new provider to localStorage.
   */
  public addProvider(newProvider: Partial<AIProviderConfig>): AIProviderConfig {
    const current = this.loadProviders();
    const nextPriority =
      typeof newProvider.priority === 'number' && newProvider.priority > 0
        ? newProvider.priority
        : current.length + 1;

    let initialApiKey = '';
    if (typeof newProvider.apiKey === 'string') {
      const trimmed = newProvider.apiKey.trim();
      if (!trimmed.includes('••••')) {
        initialApiKey = trimmed;
      }
    }

    const normalized = this.normalizeProvider(
      {
        ...newProvider,
        apiKey: initialApiKey,
        hasKey: Boolean(initialApiKey && initialApiKey.length > 0),
        priority: nextPriority,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      current.length
    );

    const updated = [...current, normalized];
    this.saveProviders(updated);
    return normalized;
  }

  /**
   * Updates an existing provider in localStorage.
   * Safely preserves existing API keys if masked string ('••••') is passed.
   * Supports explicit key clearing and new key updates.
   */
  public updateProvider(id: string, updates: Partial<AIProviderConfig>): AIProviderConfig | null {
    const current = this.loadProviders();
    const index = current.findIndex((p) => p.id === id);
    if (index === -1) {
      return null;
    }

    const existing = current[index];

    // API Key resolution logic (Section 2 & 5)
    let resolvedApiKey = existing.apiKey;
    if (typeof updates.apiKey === 'string') {
      const trimmed = updates.apiKey.trim();
      if (trimmed.includes('••••')) {
        // CASE B: UI passed masked value, ALWAYS keep original real key
        resolvedApiKey = existing.apiKey;
      } else if (trimmed === '') {
        // CASE D: Explicit clear if hasKey was specifically set to false or key was emptied
        if (updates.hasKey === false) {
          resolvedApiKey = '';
        } else {
          // If hasKey wasn't explicitly false, preserve existing key
          resolvedApiKey = existing.apiKey;
        }
      } else {
        // CASE C: User entered a new unmasked key
        resolvedApiKey = trimmed;
      }
    }

    const merged: AIProviderConfig = {
      ...existing,
      ...updates,
      apiKey: resolvedApiKey,
      hasKey: Boolean(resolvedApiKey && resolvedApiKey.length > 0),
      updatedAt: new Date().toISOString(),
    };

    const normalized = this.normalizeProvider(merged, index);
    current[index] = normalized;

    this.saveProviders(current);
    return normalized;
  }

  /**
   * Deletes a provider by ID from localStorage.
   * Removes ONLY that provider from the array and saves the updated list.
   * Does NOT clear other providers.
   */
  public deleteProvider(id: string): boolean {
    const current = this.loadProviders();
    const updated = current.filter((p) => p.id !== id);

    // Re-index priorities smoothly
    const reindexed = updated.map((p, idx) => ({ ...p, priority: idx + 1 }));
    return this.saveProviders(reindexed);
  }

  /**
   * Toggles the enabled status of a provider in localStorage.
   */
  public toggleProvider(id: string, enabled?: boolean): AIProviderConfig | null {
    const current = this.loadProviders();
    const target = current.find((p) => p.id === id);
    if (!target) return null;

    const nextEnabled = enabled !== undefined ? enabled : !target.enabled;
    return this.updateProvider(id, { enabled: nextEnabled });
  }

  /**
   * Reorders providers and updates their priorities.
   */
  public reorderProviders(orderedIds: string[]): AIProviderConfig[] {
    const current = this.loadProviders();
    const idMap = new Map(current.map((p) => [p.id, p]));
    const reordered: AIProviderConfig[] = [];

    orderedIds.forEach((id, idx) => {
      const p = idMap.get(id);
      if (p) {
        reordered.push({ ...p, priority: idx + 1 });
        idMap.delete(id);
      }
    });

    // Append any remaining that were not in orderedIds
    idMap.forEach((p) => {
      reordered.push({ ...p, priority: reordered.length + 1 });
    });

    this.saveProviders(reordered);
    return reordered;
  }

  /**
   * Returns all enabled providers sorted by priority.
   */
  public getEnabledProviders(): AIProviderConfig[] {
    return this.loadProviders()
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Finds a provider by ID directly from localStorage (never stale React state).
   */
  public getProviderById(id: string): AIProviderConfig | null {
    const providers = this.loadProviders();
    return providers.find((p) => p.id === id) || null;
  }

  // =========================================================================
  // TAVILY & SEARCH PROVIDER OPERATIONS
  // =========================================================================

  /**
   * Loads Tavily configuration from 'tara_tavily_config'.
   */
  public loadTavilyConfig(): TavilyConfig {
    if (!this.isStorageAvailable()) {
      return this.memoryTavilyConfig || { apiKey: '', enabled: false, baseUrl: 'https://api.tavily.com' };
    }

    try {
      const rawJson = window.localStorage.getItem(TAVILY_CONFIG_KEY);
      if (!rawJson) {
        return { apiKey: '', enabled: false, baseUrl: 'https://api.tavily.com' };
      }
      const parsed = JSON.parse(rawJson);
      const normalized = this.normalizeTavilyConfig(parsed);
      this.memoryTavilyConfig = normalized;
      return normalized;
    } catch {
      return { apiKey: '', enabled: false, baseUrl: 'https://api.tavily.com' };
    }
  }

  /**
   * Saves Tavily configuration to 'tara_tavily_config'.
   * Safely preserves existing API key if masked.
   */
  public saveTavilyConfig(updates: Partial<TavilyConfig>): TavilyConfig {
    const current = this.loadTavilyConfig();

    let resolvedKey = current.apiKey;
    if (typeof updates.apiKey === 'string') {
      const trimmed = updates.apiKey.trim();
      if (trimmed && !trimmed.includes('••••')) {
        resolvedKey = trimmed;
      }
    }

    const merged: TavilyConfig = {
      ...current,
      ...updates,
      apiKey: resolvedKey,
      baseUrl: updates.baseUrl || current.baseUrl || 'https://api.tavily.com',
      enabled: updates.enabled !== undefined ? updates.enabled : current.enabled,
    };

    this.memoryTavilyConfig = merged;

    if (this.isStorageAvailable()) {
      try {
        window.localStorage.setItem(TAVILY_CONFIG_KEY, JSON.stringify(merged));
      } catch (err) {
        console.warn('[ProviderStore] Failed to write tavily config to localStorage:', err);
      }
    }

    this.notifyTavilySubscribers(merged);
    return merged;
  }

  /**
   * Loads search providers from localStorage (with Tavily integrated).
   */
  public loadSearchProviders(): SearchProviderConfig[] {
    const tavily = this.loadTavilyConfig();
    
    // Default search providers structure backed by localStorage
    let storedList: SearchProviderConfig[] = [];
    if (this.isStorageAvailable()) {
      try {
        const raw = window.localStorage.getItem(SEARCH_PROVIDERS_KEY);
        if (raw) {
          storedList = JSON.parse(raw);
        }
      } catch {
        storedList = [];
      }
    }

    // Ensure Tavily is present and synchronized with tara_tavily_config
    const tavilyProvider: SearchProviderConfig = {
      id: 'search_tavily',
      name: 'Tavily AI Search',
      type: 'tavily',
      apiKey: tavily.apiKey,
      hasKey: Boolean(tavily.apiKey),
      baseUrl: tavily.baseUrl || 'https://api.tavily.com',
      searchDepth: tavily.searchDepth || 'advanced',
      maxResults: tavily.maxResults || 6,
      priority: 1,
      enabled: tavily.enabled,
      lastTestedAt: tavily.lastTestedAt,
      lastTestStatus: tavily.lastTestStatus || 'NEVER_TESTED',
      lastLatencyMs: tavily.lastLatencyMs,
      lastError: tavily.lastError,
    };

    const others = Array.isArray(storedList)
      ? storedList.filter((s) => s.id !== 'search_tavily' && s.type !== 'tavily')
      : [];

    return [tavilyProvider, ...others].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Saves search provider list and syncs Tavily config if updated.
   */
  public saveSearchProviders(providers: SearchProviderConfig[]): boolean {
    const tavily = providers.find((p) => p.type === 'tavily' || p.id === 'search_tavily');
    if (tavily) {
      this.saveTavilyConfig({
        apiKey: tavily.apiKey,
        enabled: tavily.enabled,
        baseUrl: tavily.baseUrl,
        searchDepth: tavily.searchDepth,
        maxResults: tavily.maxResults,
        lastTestedAt: tavily.lastTestedAt,
        lastTestStatus: tavily.lastTestStatus,
        lastLatencyMs: tavily.lastLatencyMs,
        lastError: tavily.lastError,
      });
    }

    if (this.isStorageAvailable()) {
      try {
        window.localStorage.setItem(SEARCH_PROVIDERS_KEY, JSON.stringify(providers));
        return true;
      } catch (err) {
        console.warn('[ProviderStore] Failed to write search providers:', err);
      }
    }
    return true;
  }

  // =========================================================================
  // SUBSCRIPTIONS & EVENT DISPATCH
  // =========================================================================

  public subscribe(callback: ProviderSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  public subscribeTavily(callback: TavilySubscriber): () => void {
    this.tavilySubscribers.add(callback);
    return () => {
      this.tavilySubscribers.delete(callback);
    };
  }

  public onError(callback: ErrorSubscriber): () => void {
    this.errorSubscribers.add(callback);
    return () => {
      this.errorSubscribers.delete(callback);
    };
  }

  private notifySubscribers(providers: AIProviderConfig[]): void {
    this.subscribers.forEach((fn) => {
      try {
        fn(providers);
      } catch (err) {
        console.warn('[ProviderStore] Subscriber notification error:', err);
      }
    });
  }

  private notifyTavilySubscribers(config: TavilyConfig): void {
    this.tavilySubscribers.forEach((fn) => {
      try {
        fn(config);
      } catch (err) {
        console.warn('[ProviderStore] Tavily subscriber notification error:', err);
      }
    });
  }

  private notifyError(msg: string): void {
    this.errorSubscribers.forEach((fn) => {
      try {
        fn(msg);
      } catch (err) {
        console.warn('[ProviderStore] Error subscriber notification error:', err);
      }
    });
  }
}

export const providerStore = ProviderStoreService.getInstance();
