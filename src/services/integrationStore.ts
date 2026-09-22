import { BloggerIntegration, SocialIntegration, SocialPlatform } from '../types/agent';
import { isMasked, MASKED_SECRET } from './providerStore';

export const BLOGGER_KEY = 'tara_blogger_integrations';
export const SOCIAL_KEY = 'tara_social_integrations';

type StoreSubscriber = () => void;

class IntegrationStore {
  private subscribers: Set<StoreSubscriber> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === BLOGGER_KEY || e.key === SOCIAL_KEY) {
          this.notifySubscribers();
        }
      });
      window.addEventListener('tara_integration_update', () => {
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
        console.error('Error in integrationStore subscriber', err);
      }
    });
  }

  private emitUpdate(key: string) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('tara_integration_update', { detail: { key } })
      );
    }
    this.notifySubscribers();
  }

  // ==========================================
  // BLOGGER INTEGRATIONS
  // ==========================================

  public loadBlogger(): BloggerIntegration[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(BLOGGER_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (e) {
      console.error('Safe recovery: corrupt Blogger localStorage, returning empty array', e);
      return [];
    }
  }

  public saveBlogger(items: BloggerIntegration[], notify: boolean = true): void {
    if (typeof window === 'undefined') return;
    try {
      const serialized = JSON.stringify(items);
      localStorage.setItem(BLOGGER_KEY, serialized);

      // Synchronous read-back verification
      const verified = localStorage.getItem(BLOGGER_KEY);
      if (verified !== serialized) {
        throw new Error('Read-back verification failed for tara_blogger_integrations');
      }

      if (notify) {
        this.emitUpdate(BLOGGER_KEY);
      }
    } catch (e) {
      console.error('Critical error writing Blogger integrations to localStorage', e);
      throw e;
    }
  }

  public addBlogger(data: Omit<BloggerIntegration, 'id'>): BloggerIntegration {
    const items = this.loadBlogger();
    const id = `blogger-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newEntry: BloggerIntegration = {
      ...data,
      id,
      testStatus: data.testStatus || 'UNTESTED'
    };
    items.push(newEntry);
    this.saveBlogger(items);
    return newEntry;
  }

  public updateBlogger(id: string, updates: Partial<BloggerIntegration>): BloggerIntegration {
    const items = this.loadBlogger();
    const index = items.findIndex((b) => b.id === id);
    if (index === -1) {
      throw new Error(`Blogger integration with ID ${id} not found`);
    }

    const existing = items[index];

    // Masked secret protection for sensitive Blogger credentials
    const cleanClientSecret = updates.clientSecret !== undefined
      ? (isMasked(updates.clientSecret) || updates.clientSecret.trim() === '' ? existing.clientSecret : updates.clientSecret)
      : existing.clientSecret;

    const cleanAccessToken = updates.accessToken !== undefined
      ? (isMasked(updates.accessToken) || updates.accessToken.trim() === '' ? existing.accessToken : updates.accessToken)
      : existing.accessToken;

    const cleanRefreshToken = updates.refreshToken !== undefined
      ? (isMasked(updates.refreshToken) || updates.refreshToken.trim() === '' ? existing.refreshToken : updates.refreshToken)
      : existing.refreshToken;

    const updated: BloggerIntegration = {
      ...existing,
      ...updates,
      clientSecret: cleanClientSecret,
      accessToken: cleanAccessToken,
      refreshToken: cleanRefreshToken
    };

    items[index] = updated;
    this.saveBlogger(items);
    return updated;
  }

  public removeBlogger(id: string): void {
    const items = this.loadBlogger();
    const filtered = items.filter((b) => b.id !== id);
    this.saveBlogger(filtered);
  }

  public toggleBloggerEnabled(id: string, enabled?: boolean): BloggerIntegration {
    const items = this.loadBlogger();
    const index = items.findIndex((b) => b.id === id);
    if (index === -1) {
      throw new Error(`Blogger integration with ID ${id} not found`);
    }
    const current = items[index];
    const newEnabled = enabled !== undefined ? enabled : !current.enabled;
    const updated = { ...current, enabled: newEnabled };
    items[index] = updated;
    this.saveBlogger(items);
    return updated;
  }

  public getBloggerById(id: string): BloggerIntegration | undefined {
    return this.loadBlogger().find((b) => b.id === id);
  }

  public getEnabledBlogger(): BloggerIntegration[] {
    return this.loadBlogger().filter((b) => b.enabled);
  }

  public updateBloggerTestResult(
    id: string, 
    status: 'CONNECTED' | 'FAILED', 
    diagnostics?: string, 
    lastError?: string
  ): BloggerIntegration {
    const items = this.loadBlogger();
    const index = items.findIndex((b) => b.id === id);
    if (index === -1) throw new Error(`Blogger integration ${id} not found`);

    const existing = items[index];
    // Notice: Test result updates DO NOT clear credentials or alter enabled status!
    const updated: BloggerIntegration = {
      ...existing,
      testStatus: status,
      lastTested: Date.now(),
      diagnostics,
      lastError: lastError || (status === 'CONNECTED' ? undefined : existing.lastError)
    };
    items[index] = updated;
    this.saveBlogger(items);
    return updated;
  }

  // ==========================================
  // SOCIAL MEDIA INTEGRATIONS
  // ==========================================

  public loadSocial(): SocialIntegration[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(SOCIAL_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (e) {
      console.error('Safe recovery: corrupt Social localStorage, returning empty array', e);
      return [];
    }
  }

  public saveSocial(items: SocialIntegration[], notify: boolean = true): void {
    if (typeof window === 'undefined') return;
    try {
      const serialized = JSON.stringify(items);
      localStorage.setItem(SOCIAL_KEY, serialized);

      // Synchronous read-back verification
      const verified = localStorage.getItem(SOCIAL_KEY);
      if (verified !== serialized) {
        throw new Error('Read-back verification failed for tara_social_integrations');
      }

      if (notify) {
        this.emitUpdate(SOCIAL_KEY);
      }
    } catch (e) {
      console.error('Critical error writing Social integrations to localStorage', e);
      throw e;
    }
  }

  public addSocial(data: Omit<SocialIntegration, 'id'>): SocialIntegration {
    const items = this.loadSocial();
    const id = `social-${data.platform}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newEntry: SocialIntegration = {
      ...data,
      id,
      testStatus: data.testStatus || 'UNTESTED'
    };
    items.push(newEntry);
    this.saveSocial(items);
    return newEntry;
  }

  public updateSocial(id: string, updates: Partial<SocialIntegration>): SocialIntegration {
    const items = this.loadSocial();
    const index = items.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error(`Social integration with ID ${id} not found`);
    }

    const existing = items[index];
    const newCredentials: Record<string, string> = { ...existing.credentials };

    // Masked secret protection for all credentials passed
    if (updates.credentials) {
      for (const [key, val] of Object.entries(updates.credentials)) {
        if (isMasked(val) || val.trim() === '') {
          // preserve existing secret
          newCredentials[key] = existing.credentials[key] || '';
        } else {
          newCredentials[key] = val;
        }
      }
    }

    const updated: SocialIntegration = {
      ...existing,
      ...updates,
      credentials: newCredentials
    };

    items[index] = updated;
    this.saveSocial(items);
    return updated;
  }

  public removeSocial(id: string): void {
    const items = this.loadSocial();
    const filtered = items.filter((s) => s.id !== id);
    this.saveSocial(filtered);
  }

  public toggleSocialEnabled(id: string, enabled?: boolean): SocialIntegration {
    const items = this.loadSocial();
    const index = items.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error(`Social integration with ID ${id} not found`);
    }
    const current = items[index];
    const newEnabled = enabled !== undefined ? enabled : !current.enabled;
    const updated = { ...current, enabled: newEnabled };
    items[index] = updated;
    this.saveSocial(items);
    return updated;
  }

  public getSocialById(id: string): SocialIntegration | undefined {
    return this.loadSocial().find((s) => s.id === id);
  }

  public getEnabledSocial(): SocialIntegration[] {
    return this.loadSocial().filter((s) => s.enabled);
  }

  public getSocialByPlatform(platform: SocialPlatform): SocialIntegration[] {
    return this.loadSocial().filter((s) => s.platform === platform);
  }

  public updateSocialTestResult(
    id: string, 
    status: 'CONNECTED' | 'FAILED', 
    diagnostics?: string, 
    lastError?: string
  ): SocialIntegration {
    const items = this.loadSocial();
    const index = items.findIndex((s) => s.id === id);
    if (index === -1) throw new Error(`Social integration ${id} not found`);

    const existing = items[index];
    // Notice: Test result updates DO NOT clear credentials or alter enabled status!
    const updated: SocialIntegration = {
      ...existing,
      testStatus: status,
      lastTested: Date.now(),
      diagnostics,
      lastError: lastError || (status === 'CONNECTED' ? undefined : existing.lastError)
    };
    items[index] = updated;
    this.saveSocial(items);
    return updated;
  }

  // Generic methods required by prompt spec: load(), save(), add(), update(), remove(), toggleEnabled(), getById()
  public load(): { blogger: BloggerIntegration[]; social: SocialIntegration[] } {
    return {
      blogger: this.loadBlogger(),
      social: this.loadSocial()
    };
  }
}

export const integrationStore = new IntegrationStore();
