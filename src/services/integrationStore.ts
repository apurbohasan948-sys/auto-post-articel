/**
 * Axiom Integrations Store
 * Single Source of Truth for Blogger and Social Media Integrations in browser localStorage.
 *
 * Dedicated keys:
 * - 'tara_blogger_integrations'
 * - 'tara_social_integrations'
 *
 * Features:
 * - Synchronous write + immediate read-back verification
 * - Resilient JSON parsing (no black screen or React crash)
 * - Visual masking ('••••') secret field preservation
 * - Multi-tab real-time sync via browser 'storage' event
 * - In-memory fallback if localStorage is unavailable
 */

import {
  BloggerIntegration,
  IntegrationSettings,
  IntegrationTestResult,
  SocialIntegration,
  SocialPlatform,
} from '../types/integrations.ts';

export const BLOGGER_INTEGRATIONS_KEY = 'tara_blogger_integrations';
export const SOCIAL_INTEGRATIONS_KEY = 'tara_social_integrations';
export const INTEGRATION_SETTINGS_KEY = 'tara_integration_settings';
export const MASKED_SECRET_PLACEHOLDER = '••••••••';

type BloggerSubscriber = (integrations: BloggerIntegration[]) => void;
type SocialSubscriber = (integrations: SocialIntegration[]) => void;
type ErrorSubscriber = (error: string) => void;

function hasMask(val: any): boolean {
  return typeof val === 'string' && val.includes('••••');
}

export class IntegrationStoreService {
  private static instance: IntegrationStoreService;
  private memoryBlogger: BloggerIntegration[] | null = null;
  private memorySocial: SocialIntegration[] | null = null;
  private bloggerSubscribers: Set<BloggerSubscriber> = new Set();
  private socialSubscribers: Set<SocialSubscriber> = new Set();
  private errorSubscribers: Set<ErrorSubscriber> = new Set();
  private isStorageListening = false;

  private constructor() {
    this.initStorageListener();
  }

  public static getInstance(): IntegrationStoreService {
    if (!IntegrationStoreService.instance) {
      IntegrationStoreService.instance = new IntegrationStoreService();
    }
    return IntegrationStoreService.instance;
  }

  /**
   * Safe check for localStorage availability.
   */
  private isStorageAvailable(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    try {
      const testKey = '__axiom_integ_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Multi-tab real-time synchronization listener.
   */
  private initStorageListener(): void {
    if (this.isStorageListening || typeof window === 'undefined') return;
    try {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === BLOGGER_INTEGRATIONS_KEY) {
          const fresh = this.loadBlogger();
          this.notifyBlogger(fresh);
        } else if (event.key === SOCIAL_INTEGRATIONS_KEY) {
          const fresh = this.loadSocial();
          this.notifySocial(fresh);
        }
      });
      this.isStorageListening = true;
    } catch (err) {
      console.warn('[IntegrationStore] Failed to bind storage listener:', err);
    }
  }

  private notifyBlogger(items: BloggerIntegration[]): void {
    this.bloggerSubscribers.forEach((cb) => {
      try {
        cb(items);
      } catch (err) {
        console.error('[IntegrationStore] Subscriber error in Blogger notification:', err);
      }
    });
  }

  private notifySocial(items: SocialIntegration[]): void {
    this.socialSubscribers.forEach((cb) => {
      try {
        cb(items);
      } catch (err) {
        console.error('[IntegrationStore] Subscriber error in Social notification:', err);
      }
    });
  }

  private notifyError(message: string): void {
    this.errorSubscribers.forEach((cb) => {
      try {
        cb(message);
      } catch (err) {
        console.error('[IntegrationStore] Subscriber error in error notification:', err);
      }
    });
  }

  // ==========================================
  // BLOGGER INTEGRATIONS
  // ==========================================

  public loadBlogger(): BloggerIntegration[] {
    if (!this.isStorageAvailable()) {
      return this.memoryBlogger || [];
    }
    try {
      const raw = window.localStorage.getItem(BLOGGER_INTEGRATIONS_KEY);
      if (!raw) {
        this.memoryBlogger = [];
        return [];
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const sanitized = parsed.filter((item): item is BloggerIntegration => {
          return Boolean(item && typeof item === 'object' && typeof item.id === 'string');
        });
        this.memoryBlogger = sanitized;
        return sanitized;
      }
      return [];
    } catch (err) {
      console.warn('[IntegrationStore] Corrupt Blogger data in localStorage, using safe fallback:', err);
      return this.memoryBlogger || [];
    }
  }

  public saveBlogger(items: BloggerIntegration[]): boolean {
    const sanitized = Array.isArray(items) ? items : [];
    this.memoryBlogger = sanitized;

    if (!this.isStorageAvailable()) {
      this.notifyBlogger(sanitized);
      return true;
    }

    try {
      const json = JSON.stringify(sanitized);
      window.localStorage.setItem(BLOGGER_INTEGRATIONS_KEY, json);

      // Synchronous read-back verification
      const verify = window.localStorage.getItem(BLOGGER_INTEGRATIONS_KEY);
      if (verify === null) {
        throw new Error('Read-back verification failed: key was not stored in localStorage.');
      }
      const parsed = JSON.parse(verify);
      if (!Array.isArray(parsed) || parsed.length !== sanitized.length) {
        throw new Error('Read-back verification failed: items length mismatch.');
      }

      this.notifyBlogger(sanitized);
      return true;
    } catch (err: any) {
      const msg = `Failed to save Blogger integrations to localStorage: ${err?.message || 'Storage Quota Exceeded'}`;
      console.error('[IntegrationStore]', msg);
      this.notifyError(msg);
      this.notifyBlogger(sanitized);
      return false;
    }
  }

  public addBlogger(config: Omit<BloggerIntegration, 'id'> & { id?: string }): BloggerIntegration {
    const current = this.loadBlogger();
    const newIntegration: BloggerIntegration = {
      ...config,
      id: config.id || `blogger_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      enabled: config.enabled ?? true,
      defaultStatus: config.defaultStatus || 'DRAFT',
      defaultLabel: config.defaultLabel || '',
      lastTestStatus: 'NOT_CONFIGURED',
    };
    const updated = [...current, newIntegration];
    this.saveBlogger(updated);
    return newIntegration;
  }

  public updateBlogger(id: string, updates: Partial<BloggerIntegration>): BloggerIntegration | null {
    const current = this.loadBlogger();
    const index = current.findIndex((b) => b.id === id);
    if (index === -1) return null;

    const existing = current[index];
    // Secret field protection: preserve un-modified masked credentials
    const updatedItem: BloggerIntegration = {
      ...existing,
      ...updates,
      id: existing.id,
      clientSecret: hasMask(updates.clientSecret) ? existing.clientSecret : (updates.clientSecret ?? existing.clientSecret),
      accessToken: hasMask(updates.accessToken) ? existing.accessToken : (updates.accessToken ?? existing.accessToken),
      refreshToken: hasMask(updates.refreshToken) ? existing.refreshToken : (updates.refreshToken ?? existing.refreshToken),
    };

    current[index] = updatedItem;
    this.saveBlogger(current);
    return updatedItem;
  }

  public removeBlogger(id: string): boolean {
    const current = this.loadBlogger();
    const filtered = current.filter((b) => b.id !== id);
    if (filtered.length === current.length) return false;
    return this.saveBlogger(filtered);
  }

  public toggleBloggerEnabled(id: string, enabled?: boolean): boolean {
    const current = this.loadBlogger();
    const item = current.find((b) => b.id === id);
    if (!item) return false;
    const targetState = typeof enabled === 'boolean' ? enabled : !item.enabled;
    this.updateBlogger(id, { enabled: targetState });
    return true;
  }

  public getBloggerById(id: string): BloggerIntegration | undefined {
    return this.loadBlogger().find((b) => b.id === id);
  }

  public getEnabledBloggers(): BloggerIntegration[] {
    return this.loadBlogger().filter((b) => b.enabled);
  }

  public recordBloggerTestResult(id: string, result: IntegrationTestResult): void {
    const current = this.loadBlogger();
    const target = current.find((b) => b.id === id);
    if (!target) return;

    // Never modify, delete, or wipe credentials on failed test
    target.lastTestedAt = new Date().toISOString();
    target.lastTestStatus = result.status;
    target.lastLatencyMs = result.latencyMs;
    target.lastError = result.status === 'FAILED' ? (result.error || result.message) : undefined;

    this.saveBlogger(current);
  }

  // ==========================================
  // SOCIAL MEDIA INTEGRATIONS
  // ==========================================

  public loadSocial(): SocialIntegration[] {
    if (!this.isStorageAvailable()) {
      return this.memorySocial || [];
    }
    try {
      const raw = window.localStorage.getItem(SOCIAL_INTEGRATIONS_KEY);
      if (!raw) {
        this.memorySocial = [];
        return [];
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const sanitized = parsed.filter((item): item is SocialIntegration => {
          return Boolean(
            item &&
            typeof item === 'object' &&
            typeof item.id === 'string' &&
            typeof item.platform === 'string'
          );
        });
        this.memorySocial = sanitized;
        return sanitized;
      }
      return [];
    } catch (err) {
      console.warn('[IntegrationStore] Corrupt Social data in localStorage, using safe fallback:', err);
      return this.memorySocial || [];
    }
  }

  public saveSocial(items: SocialIntegration[]): boolean {
    const sanitized = Array.isArray(items) ? items : [];
    this.memorySocial = sanitized;

    if (!this.isStorageAvailable()) {
      this.notifySocial(sanitized);
      return true;
    }

    try {
      const json = JSON.stringify(sanitized);
      window.localStorage.setItem(SOCIAL_INTEGRATIONS_KEY, json);

      // Synchronous read-back verification
      const verify = window.localStorage.getItem(SOCIAL_INTEGRATIONS_KEY);
      if (verify === null) {
        throw new Error('Read-back verification failed: social integrations not stored.');
      }
      const parsed = JSON.parse(verify);
      if (!Array.isArray(parsed) || parsed.length !== sanitized.length) {
        throw new Error('Read-back verification failed: social items length mismatch.');
      }

      this.notifySocial(sanitized);
      return true;
    } catch (err: any) {
      const msg = `Failed to save Social integrations to localStorage: ${err?.message || 'Storage Error'}`;
      console.error('[IntegrationStore]', msg);
      this.notifyError(msg);
      this.notifySocial(sanitized);
      return false;
    }
  }

  public addSocial(config: Omit<SocialIntegration, 'id'> & { id?: string }): SocialIntegration {
    const current = this.loadSocial();
    const newIntegration: SocialIntegration = {
      ...config,
      id: config.id || `soc_${config.platform}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      enabled: config.enabled ?? true,
      credentials: config.credentials || {},
      lastTestStatus: 'NOT_CONFIGURED',
    };
    const updated = [...current, newIntegration];
    this.saveSocial(updated);
    return newIntegration;
  }

  public updateSocial(id: string, updates: Partial<SocialIntegration>): SocialIntegration | null {
    const current = this.loadSocial();
    const index = current.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const existing = current[index];
    const newCreds = updates.credentials || {};
    const mergedCreds: Record<string, string> = { ...(existing.credentials || {}) };

    // Secret field protection for social credentials
    for (const [key, val] of Object.entries(newCreds)) {
      if (hasMask(val)) {
        // preserve previous value
        mergedCreds[key] = existing.credentials?.[key] || '';
      } else {
        mergedCreds[key] = String(val ?? '');
      }
    }

    const updatedItem: SocialIntegration = {
      ...existing,
      ...updates,
      id: existing.id,
      credentials: mergedCreds,
    };

    current[index] = updatedItem;
    this.saveSocial(current);
    return updatedItem;
  }

  public removeSocial(id: string): boolean {
    const current = this.loadSocial();
    const filtered = current.filter((s) => s.id !== id);
    if (filtered.length === current.length) return false;
    return this.saveSocial(filtered);
  }

  public toggleSocialEnabled(id: string, enabled?: boolean): boolean {
    const current = this.loadSocial();
    const item = current.find((s) => s.id === id);
    if (!item) return false;
    const targetState = typeof enabled === 'boolean' ? enabled : !item.enabled;
    this.updateSocial(id, { enabled: targetState });
    return true;
  }

  public getSocialById(id: string): SocialIntegration | undefined {
    return this.loadSocial().find((s) => s.id === id);
  }

  public getSocialByPlatform(platform: SocialPlatform): SocialIntegration[] {
    return this.loadSocial().filter((s) => s.platform === platform);
  }

  public getEnabledSocial(): SocialIntegration[] {
    return this.loadSocial().filter((s) => s.enabled);
  }

  public recordSocialTestResult(id: string, result: IntegrationTestResult): void {
    const current = this.loadSocial();
    const target = current.find((s) => s.id === id);
    if (!target) return;

    // Never modify, delete, or wipe credentials on failed test
    target.lastTestedAt = new Date().toISOString();
    target.lastTestStatus = result.status;
    target.lastLatencyMs = result.latencyMs;
    target.lastError = result.status === 'FAILED' ? (result.error || result.message) : undefined;

    this.saveSocial(current);
  }

  // ==========================================
  // GENERAL SETTINGS (tara_integration_settings)
  // ==========================================

  public getSettings(): IntegrationSettings {
    const defaultSettings: IntegrationSettings = {
      autoPublishToBlogger: true,
      autoDistributeToSocial: true,
      notifyOnPublishError: true,
      testBeforePublishing: true,
      defaultBloggerStatus: 'DRAFT',
    };

    if (!this.isStorageAvailable()) {
      return defaultSettings;
    }

    try {
      const raw = window.localStorage.getItem(INTEGRATION_SETTINGS_KEY);
      if (!raw) return defaultSettings;
      const parsed = JSON.parse(raw);
      return { ...defaultSettings, ...(parsed || {}) };
    } catch {
      return defaultSettings;
    }
  }

  public saveSettings(updates: Partial<IntegrationSettings>): IntegrationSettings {
    const current = this.getSettings();
    const merged = { ...current, ...updates };
    if (this.isStorageAvailable()) {
      try {
        window.localStorage.setItem(INTEGRATION_SETTINGS_KEY, JSON.stringify(merged));
      } catch (err: any) {
        console.error('[IntegrationStore] Failed to save settings:', err);
      }
    }
    return merged;
  }

  // ==========================================
  // CONVENIENCE & UNIFIED ALIAS METHODS
  // ==========================================

  public getBloggers(): BloggerIntegration[] {
    return this.loadBlogger();
  }

  public getSocials(): SocialIntegration[] {
    return this.loadSocial();
  }

  public load(): { bloggers: BloggerIntegration[]; socials: SocialIntegration[]; settings: IntegrationSettings } {
    return {
      bloggers: this.loadBlogger(),
      socials: this.loadSocial(),
      settings: this.getSettings(),
    };
  }

  public save(data: { bloggers?: BloggerIntegration[]; socials?: SocialIntegration[]; settings?: Partial<IntegrationSettings> }): void {
    if (data.bloggers) this.saveBlogger(data.bloggers);
    if (data.socials) this.saveSocial(data.socials);
    if (data.settings) this.saveSettings(data.settings);
  }

  public add(type: 'blogger' | 'social', item: any): BloggerIntegration | SocialIntegration {
    if (type === 'blogger') {
      return this.addBlogger(item);
    } else {
      return this.addSocial(item);
    }
  }

  public update(type: 'blogger' | 'social', id: string, updates: any): BloggerIntegration | SocialIntegration | null {
    if (type === 'blogger') {
      return this.updateBlogger(id, updates);
    } else {
      return this.updateSocial(id, updates);
    }
  }

  public remove(type: 'blogger' | 'social', id: string): boolean {
    if (type === 'blogger') {
      return this.removeBlogger(id);
    } else {
      return this.removeSocial(id);
    }
  }

  public getById(type: 'blogger' | 'social', id: string): BloggerIntegration | SocialIntegration | undefined {
    if (type === 'blogger') {
      return this.getBloggerById(id);
    } else {
      return this.getSocialById(id);
    }
  }

  public getEnabled(type: 'blogger' | 'social'): (BloggerIntegration | SocialIntegration)[] {
    if (type === 'blogger') {
      return this.getEnabledBloggers();
    } else {
      return this.getEnabledSocial();
    }
  }

  public toggleEnabled(type: 'blogger' | 'social', id: string, enabled?: boolean): boolean {
    if (type === 'blogger') {
      return this.toggleBloggerEnabled(id, enabled);
    } else {
      return this.toggleSocialEnabled(id, enabled);
    }
  }

  public getByPlatform(platform: SocialPlatform): SocialIntegration[] {
    return this.getSocialByPlatform(platform);
  }

  // ==========================================
  // SUBSCRIPTIONS
  // ==========================================

  public subscribeBlogger(callback: BloggerSubscriber): () => void {
    this.bloggerSubscribers.add(callback);
    return () => {
      this.bloggerSubscribers.delete(callback);
    };
  }

  public subscribeSocial(callback: SocialSubscriber): () => void {
    this.socialSubscribers.add(callback);
    return () => {
      this.socialSubscribers.delete(callback);
    };
  }

  public onError(callback: ErrorSubscriber): () => void {
    this.errorSubscribers.add(callback);
    return () => {
      this.errorSubscribers.delete(callback);
    };
  }
}

export const integrationStore = IntegrationStoreService.getInstance();
