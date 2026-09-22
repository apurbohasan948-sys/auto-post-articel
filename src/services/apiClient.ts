/**
 * Axiom Client-Side API Service
 * Interacts with /api/* routes (Express or Netlify Serverless Functions).
 *
 * Fully protected against:
 * 1. Non-200 HTTP statuses
 * 2. Unexpected HTML responses (e.g. SPA fallback, 404, or 502 error pages)
 * 3. Empty or malformed JSON payloads
 * 4. Missing properties, null values, or uninitialized arrays
 */

import {
  AgentJob,
  AgentMemory,
  AIProviderConfig,
  AITestResult,
  ApiTestHistoryItem,
  Article,
  BloggerConfig,
  HealthCheckResponse,
  ProviderHealth,
  ProviderUsageInfo,
  ResearchPackage,
  SearchProviderConfig,
  SearchTestResult,
  SystemLog,
  SystemSettings,
  TopicCandidate,
} from '../types/agent.ts';
import { providerStore } from './providerStore.ts';

export interface SafeApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
  statusCode?: number;
  isHtml?: boolean;
}

/**
 * Universal safe API caller that never throws uncaught syntax or type errors.
 */
export async function safeApiCall<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallback: T | null = null
): Promise<SafeApiResult<T>> {
  try {
    const res = await fetch(input, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
    });

    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    if (!text || text.trim().length === 0) {
      return {
        success: res.ok,
        data: fallback as T,
        statusCode: res.status,
        error: res.ok ? undefined : `Server returned empty response (HTTP ${res.status})`,
      };
    }

    const trimmed = text.trim();
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || contentType.includes('text/html')) {
      return {
        success: false,
        data: fallback as T,
        statusCode: res.status,
        isHtml: true,
        error: `Server returned an HTML page instead of API JSON (HTTP ${res.status})`,
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        success: false,
        data: fallback as T,
        statusCode: res.status,
        error: `Invalid JSON response format (HTTP ${res.status})`,
      };
    }

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      if (typeof parsed?.error === 'string') {
        errMsg = parsed.error;
      } else if (parsed?.error?.message) {
        errMsg = parsed.error.message;
      } else if (parsed?.message) {
        errMsg = parsed.message;
      } else {
        errMsg = `HTTP request failed with status ${res.status}`;
      }

      // If parsed contains valid result payload (such as status, error, ok, provider), retain parsed as data
      const dataPayload = (parsed?.data ??
        (parsed && typeof parsed === 'object' && ('status' in parsed || 'error' in parsed || 'ok' in parsed || 'status_code' in parsed)
          ? parsed
          : fallback)) as T;

      return {
        success: false,
        data: dataPayload,
        statusCode: res.status,
        error: errMsg,
      };
    }

    return {
      success: true,
      data: parsed as T,
      statusCode: res.status,
    };
  } catch (err: any) {
    return {
      success: false,
      data: fallback as T,
      statusCode: 0,
      error: err?.message || 'Network connection unavailable',
    };
  }
}

// Normalization Helpers
export function normalizeAIProviders(raw: any): AIProviderConfig[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.providers)
    ? raw.providers
    : [];
  return list
    .filter((p: any) => p && typeof p === 'object' && p.id)
    .map((p: any) => ({
      id: String(p.id),
      name: String(p.name || 'Unnamed Provider'),
      type: p.type || 'custom',
      baseUrl: p.baseUrl || p.base_url || '',
      apiKey: p.apiKey || '',
      priority: typeof p.priority === 'number' ? p.priority : 1,
      enabled: p.enabled !== false,
      models: Array.isArray(p.models) ? p.models : [],
      selectedModel: p.selectedModel || (Array.isArray(p.models) && p.models[0]) || '',
      hasKey: Boolean(p.hasKey),
      createdAt: p.createdAt || new Date().toISOString(),
      updatedAt: p.updatedAt || new Date().toISOString(),
    }));
}

export function normalizeSearchProviders(raw: any): SearchProviderConfig[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.providers)
    ? raw.providers
    : [];
  return list
    .filter((p: any) => p && typeof p === 'object' && p.id)
    .map((p: any) => ({
      id: String(p.id),
      name: String(p.name || 'Unnamed Search Provider'),
      type: p.type || 'tavily',
      baseUrl: p.baseUrl || p.base_url || '',
      apiKey: p.apiKey || '',
      priority: typeof p.priority === 'number' ? p.priority : 1,
      enabled: p.enabled !== false,
      timeoutMs: p.timeoutMs || 30000,
      maxRetries: p.maxRetries || 3,
      searchDepth: p.searchDepth || 'basic',
      maxResults: p.maxResults || 5,
      includeDomains: Array.isArray(p.includeDomains) ? p.includeDomains : [],
      excludeDomains: Array.isArray(p.excludeDomains) ? p.excludeDomains : [],
      lastTestStatus: p.lastTestStatus || 'NEVER_TESTED',
      hasKey: Boolean(p.hasKey),
      createdAt: p.createdAt || new Date().toISOString(),
      updatedAt: p.updatedAt || new Date().toISOString(),
    }));
}

export function normalizeSettings(raw: any): SystemSettings {
  const defaultSettings: SystemSettings = {
    status: 'IDLE',
    mode: 'AUTO',
    language: 'English',
    niche: 'Autonomous AI Systems & Cloud Infrastructure',
    contentNiche: 'Autonomous AI Systems & Cloud Infrastructure',
    subNiches: ['Multi-Agent Architecture', 'Serverless Cron', 'Empirical Research'],
    targetAudience: 'Software Engineers, Architects, and Tech Leaders',
    countryRegion: 'Global',
    keywords: ['Autonomous AI', 'Agent Orchestration', 'Netlify Serverless'],
    excludedKeywords: ['crypto pumps', 'get rich quick', 'unverified rumors'],
    articleFrequencyPerDay: 3,
    maxArticlesPerDay: 3,
    maxAiCallsPerDay: 60,
    maxAICallsPerDay: 60,
    maxResearchCallsPerDay: 20,
    maxWebSearchesPerDay: 20,
    maxTokensPerArticle: 4000,
    maxRewriteAttempts: 2,
    timezone: 'UTC',
    activeDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    quietHoursStart: 23,
    quietHoursEnd: 6,
    todayStats: {
      aiCalls: 0,
      researchCalls: 0,
      articlesPublished: 0,
      socialPostsCreated: 0,
      date: new Date().toISOString().slice(0, 10),
    },
  };

  if (!raw || typeof raw !== 'object') return defaultSettings;
  const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : raw;

  return {
    ...defaultSettings,
    ...s,
    status: s.status || defaultSettings.status,
    mode: s.mode || defaultSettings.mode,
    language: s.language || defaultSettings.language,
    niche: s.niche || defaultSettings.niche,
    contentNiche: s.contentNiche || s.niche || defaultSettings.contentNiche,
    subNiches: Array.isArray(s.subNiches) ? s.subNiches : defaultSettings.subNiches,
    targetAudience: s.targetAudience || defaultSettings.targetAudience,
    countryRegion: s.countryRegion || defaultSettings.countryRegion,
    keywords: Array.isArray(s.keywords) ? s.keywords : defaultSettings.keywords,
    excludedKeywords: Array.isArray(s.excludedKeywords) ? s.excludedKeywords : defaultSettings.excludedKeywords,
    articleFrequencyPerDay: typeof s.articleFrequencyPerDay === 'number' ? s.articleFrequencyPerDay : defaultSettings.articleFrequencyPerDay,
    maxArticlesPerDay: typeof s.maxArticlesPerDay === 'number' ? s.maxArticlesPerDay : defaultSettings.maxArticlesPerDay,
    maxAiCallsPerDay: typeof s.maxAiCallsPerDay === 'number' ? s.maxAiCallsPerDay : defaultSettings.maxAiCallsPerDay,
    maxAICallsPerDay: typeof s.maxAICallsPerDay === 'number' ? s.maxAICallsPerDay : defaultSettings.maxAICallsPerDay,
    maxResearchCallsPerDay: typeof s.maxResearchCallsPerDay === 'number' ? s.maxResearchCallsPerDay : defaultSettings.maxResearchCallsPerDay,
    maxWebSearchesPerDay: typeof s.maxWebSearchesPerDay === 'number' ? s.maxWebSearchesPerDay : defaultSettings.maxWebSearchesPerDay,
    maxTokensPerArticle: typeof s.maxTokensPerArticle === 'number' ? s.maxTokensPerArticle : defaultSettings.maxTokensPerArticle,
    maxRewriteAttempts: typeof s.maxRewriteAttempts === 'number' ? s.maxRewriteAttempts : defaultSettings.maxRewriteAttempts,
    timezone: s.timezone || defaultSettings.timezone,
    activeDays: Array.isArray(s.activeDays) ? s.activeDays : defaultSettings.activeDays,
    quietHoursStart: typeof s.quietHoursStart === 'number' ? s.quietHoursStart : defaultSettings.quietHoursStart,
    quietHoursEnd: typeof s.quietHoursEnd === 'number' ? s.quietHoursEnd : defaultSettings.quietHoursEnd,
    todayStats: {
      aiCalls: typeof s.todayStats?.aiCalls === 'number' ? s.todayStats.aiCalls : 0,
      researchCalls: typeof s.todayStats?.researchCalls === 'number' ? s.todayStats.researchCalls : 0,
      articlesPublished: typeof s.todayStats?.articlesPublished === 'number' ? s.todayStats.articlesPublished : 0,
      socialPostsCreated: typeof s.todayStats?.socialPostsCreated === 'number' ? s.todayStats.socialPostsCreated : 0,
      date: s.todayStats?.date || defaultSettings.todayStats.date,
    },
  };
}

export function normalizeBloggerConfig(raw: any): BloggerConfig {
  const defaultBlogger: BloggerConfig = {
    blogId: '',
    blogUrl: '',
    defaultLabels: ['Technology', 'AI Systems'],
    isConnected: false,
  };
  if (!raw || typeof raw !== 'object') return defaultBlogger;
  const b = raw.config && typeof raw.config === 'object' ? raw.config : raw;
  return {
    blogId: b.blogId || '',
    blogUrl: b.blogUrl || '',
    defaultLabels: Array.isArray(b.defaultLabels) ? b.defaultLabels : ['Technology', 'AI Systems'],
    isConnected: Boolean(b.isConnected),
  };
}

export function normalizeMemory(raw: any): AgentMemory {
  const defaultMemory: AgentMemory = {
    publishedTopics: [],
    successfulPatterns: [],
    failedPatterns: [],
    gapKeywords: [],
    totalArticlesPublished: 0,
    lastCycleTimestamp: new Date().toISOString(),
  };
  if (!raw || typeof raw !== 'object') return defaultMemory;
  const m = raw.memory && typeof raw.memory === 'object' ? raw.memory : raw;
  return {
    publishedTopics: Array.isArray(m.publishedTopics) ? m.publishedTopics : [],
    successfulPatterns: Array.isArray(m.successfulPatterns) ? m.successfulPatterns : [],
    failedPatterns: Array.isArray(m.failedPatterns) ? m.failedPatterns : [],
    gapKeywords: Array.isArray(m.gapKeywords) ? m.gapKeywords : [],
    totalArticlesPublished: typeof m.totalArticlesPublished === 'number' ? m.totalArticlesPublished : 0,
    lastCycleTimestamp: m.lastCycleTimestamp || new Date().toISOString(),
  };
}

export function normalizeHealth(raw: any): ProviderHealth {
  const defaultHealth: ProviderHealth = {
    openrouter: 'OFFLINE',
    gemini: 'OFFLINE',
    tavily: 'OFFLINE',
    blogger: 'NOT_CONFIGURED',
    facebook: 'NOT_CONFIGURED',
    telegram: 'NOT_CONFIGURED',
    linkedin: 'NOT_CONFIGURED',
    x: 'NOT_CONFIGURED',
    threads: 'NOT_CONFIGURED',
  };
  if (!raw || typeof raw !== 'object') return defaultHealth;
  const p = raw.providers || raw;
  return {
    ...defaultHealth,
    ...(typeof p === 'object' ? p : {}),
  };
}

export const apiClient = {
  // Agent Lifecycle
  runCycle: async (topicId?: string): Promise<{ success: boolean; job?: AgentJob; error?: string }> => {
    const enabledProviders = providerStore.getEnabledProviders();
    const tavilyConfig = providerStore.loadTavilyConfig();
    const res = await safeApiCall<any>('/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicId,
        aiProviders: enabledProviders,
        tavilyConfig,
      }),
    });
    if (!res.success) {
      throw new Error(res.error || 'Failed to trigger cycle');
    }
    return res.data;
  },

  pauseAgent: async () => {
    const res = await safeApiCall<any>('/api/agent/pause', { method: 'POST' });
    return res.data || { success: true, status: 'PAUSED' };
  },

  resumeAgent: async () => {
    const res = await safeApiCall<any>('/api/agent/resume', { method: 'POST' });
    return res.data || { success: true, status: 'IDLE' };
  },

  stopAgent: async () => {
    const res = await safeApiCall<any>('/api/agent/stop', { method: 'POST' });
    return res.data || { success: true, status: 'STOPPED' };
  },

  getStatus: async (): Promise<{
    status: string;
    mode: string;
    activeJob: AgentJob | null;
    recentJobsCount: number;
    todayStats: SystemSettings['todayStats'];
  }> => {
    const res = await safeApiCall<any>('/api/agent/status');
    const data = res.data || {};
    return {
      status: data.status || 'IDLE',
      mode: data.mode || 'AUTO',
      activeJob: data.activeJob || null,
      recentJobsCount: typeof data.recentJobsCount === 'number' ? data.recentJobsCount : 0,
      todayStats: {
        aiCalls: 0,
        researchCalls: 0,
        articlesPublished: 0,
        socialPostsCreated: 0,
        date: new Date().toISOString().slice(0, 10),
        ...(data.todayStats || {}),
      },
    };
  },

  // Topics
  getTopics: async (): Promise<TopicCandidate[]> => {
    const res = await safeApiCall<any>('/api/topics');
    const topics = res.data?.topics;
    return Array.isArray(topics) ? topics : [];
  },

  scoutTopics: async (): Promise<TopicCandidate[]> => {
    const res = await safeApiCall<any>('/api/topics/scout', { method: 'POST' });
    const candidates = res.data?.candidates;
    return Array.isArray(candidates) ? candidates : [];
  },

  // Research Packages
  getResearchPackages: async (): Promise<Record<string, ResearchPackage>> => {
    const res = await safeApiCall<any>('/api/research');
    const research = res.data?.research;
    return research && typeof research === 'object' ? research : {};
  },

  // Articles
  getArticles: async (): Promise<Article[]> => {
    const res = await safeApiCall<any>('/api/articles');
    const articles = res.data?.articles;
    return Array.isArray(articles) ? articles : [];
  },

  getArticle: async (id: string): Promise<Article | null> => {
    const res = await safeApiCall<any>(`/api/articles/${encodeURIComponent(id)}`);
    return res.data?.article || null;
  },

  approveArticle: async (id: string): Promise<Article> => {
    const res = await safeApiCall<any>(`/api/articles/${encodeURIComponent(id)}/approve`, { method: 'POST' });
    if (!res.success || !res.data?.article) {
      throw new Error(res.error || 'Approval failed');
    }
    return res.data.article;
  },

  publishArticle: async (id: string): Promise<Article> => {
    const res = await safeApiCall<any>(`/api/articles/${encodeURIComponent(id)}/publish`, { method: 'POST' });
    if (!res.success || !res.data?.article) {
      throw new Error(res.error || 'Publish failed');
    }
    return res.data.article;
  },

  // Jobs & Logs
  getJobs: async (): Promise<AgentJob[]> => {
    const res = await safeApiCall<any>('/api/jobs');
    const jobs = res.data?.jobs;
    return Array.isArray(jobs) ? jobs : [];
  },

  getLogs: async (limit = 100): Promise<SystemLog[]> => {
    const res = await safeApiCall<any>(`/api/logs?limit=${encodeURIComponent(limit)}`);
    const logs = res.data?.logs;
    return Array.isArray(logs) ? logs : [];
  },

  // Analytics & Memory
  getAnalytics: async () => {
    const res = await safeApiCall<any>('/api/analytics');
    return res.data?.analytics || null;
  },

  getMemory: async (): Promise<AgentMemory> => {
    const res = await safeApiCall<any>('/api/memory');
    return normalizeMemory(res.data);
  },

  // Settings
  getSettings: async (): Promise<SystemSettings> => {
    const res = await safeApiCall<any>('/api/settings');
    return normalizeSettings(res.data);
  },

  updateSettings: async (settings: Partial<SystemSettings>): Promise<SystemSettings> => {
    const res = await safeApiCall<any>('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return normalizeSettings(res.data);
  },

  // AI Providers (Backed by browser localStorage via providerStore as single source of truth)
  getAIProviders: async (): Promise<AIProviderConfig[]> => {
    return providerStore.loadProviders();
  },

  saveAIProvider: async (
    provider: Partial<AIProviderConfig>
  ): Promise<{ success: boolean; provider: AIProviderConfig }> => {
    let saved: AIProviderConfig | null = null;
    if (provider.id && providerStore.getProviderById(provider.id)) {
      saved = providerStore.updateProvider(provider.id, provider);
    } else {
      saved = providerStore.addProvider(provider);
    }

    if (!saved) {
      throw new Error('Failed to save AI provider configuration to localStorage');
    }

    return {
      success: true,
      provider: saved,
    };
  },

  deleteAIProvider: async (id: string): Promise<{ success: boolean }> => {
    const success = providerStore.deleteProvider(id);
    return { success };
  },

  reorderAIProviders: async (ids: string[]): Promise<{ success: boolean; providers: AIProviderConfig[] }> => {
    const reordered = providerStore.reorderProviders(ids);
    return {
      success: true,
      providers: reordered,
    };
  },

  toggleAIProvider: async (
    id: string,
    enabled: boolean
  ): Promise<{ success: boolean; provider: AIProviderConfig }> => {
    const updated = providerStore.toggleProvider(id, enabled);
    if (!updated) {
      throw new Error('Provider not found');
    }
    return {
      success: true,
      provider: updated,
    };
  },

  testAIProvider: async (params: {
    providerId?: string;
    provider?: AIProviderConfig;
    prompt?: string;
  }): Promise<AITestResult> => {
    // 1. Resolve provider directly from ProviderStore/localStorage (never stale state)
    let targetProvider = params.providerId ? providerStore.getProviderById(params.providerId) : null;
    if (!targetProvider && params.provider?.id) {
      targetProvider = providerStore.getProviderById(params.provider.id);
    }
    if (!targetProvider && params.provider) {
      targetProvider = params.provider;
    }

    if (params.provider && targetProvider) {
      // If modal passed an explicit new key (unmasked), use it
      if (params.provider.apiKey && !params.provider.apiKey.includes('••••')) {
        targetProvider = { ...targetProvider, ...params.provider };
      } else {
        // preserve unmasked key from storage
        targetProvider = { ...targetProvider, ...params.provider, apiKey: targetProvider.apiKey };
      }
    }

    const payload = {
      providerId: targetProvider?.id || params.providerId,
      provider: targetProvider,
      prompt: params.prompt,
    };

    const res = await safeApiCall<AITestResult>('/api/providers/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let resultData: AITestResult;
    if (res.data) {
      const data = { ...res.data };
      if (typeof data.error === 'object' && data.error !== null) {
        data.errorDetails = data.error as any;
        data.error = (data.error as any).message || JSON.stringify(data.error);
      }
      resultData = data;
    } else {
      resultData = {
        ok: false,
        success: false,
        status: 'FAILED',
        status_code: res.statusCode || 500,
        latencyMs: 0,
        providerId: targetProvider?.id || params.providerId || 'unknown',
        provider: targetProvider?.name || 'Unknown',
        model: targetProvider?.modelName || targetProvider?.model || '',
        error: res.error || `HTTP request failed with status ${res.statusCode || 500}`,
        errorDetails: {
          type: 'network_error',
          message: res.error || `HTTP request failed with status ${res.statusCode || 500}`,
          providerStatus: res.statusCode || 500,
        },
        timestamp: new Date().toISOString(),
      };
    }

    // Update test diagnostics in localStorage (failure MUST NEVER delete or clear the provider)
    if (targetProvider?.id) {
      providerStore.updateProvider(targetProvider.id, {
        lastTestedAt: new Date().toISOString(),
        lastTestStatus: resultData.success ? 'SUCCESS' : 'FAILED',
        lastLatencyMs: resultData.latencyMs || resultData.latency_ms || 0,
        lastError: resultData.success
          ? undefined
          : typeof resultData.error === 'string'
          ? resultData.error
          : resultData.errorDetails?.message,
      });
    }

    return resultData;
  },

  runAIPlayground: async (params: {
    providerId?: string;
    provider?: AIProviderConfig;
    prompt?: string;
  }): Promise<AITestResult> => {
    const provider = params.providerId ? providerStore.getProviderById(params.providerId) : params.provider;
    const res = await safeApiCall<AITestResult>('/api/providers/ai/playground', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        provider: provider || params.provider,
      }),
    });
    if (res.data) {
      const data = { ...res.data };
      if (typeof data.error === 'object' && data.error !== null) {
        data.errorDetails = data.error as any;
        data.error = (data.error as any).message || JSON.stringify(data.error);
      }
      return data;
    }
    return {
      ok: false,
      success: false,
      status: 'FAILED',
      status_code: res.statusCode || 500,
      latencyMs: 0,
      providerId: params.providerId || params.provider?.id || 'unknown',
      provider: params.provider?.name || 'Unknown',
      model: params.provider?.modelName || params.provider?.defaultModel || '',
      error: res.error || `HTTP request failed with status ${res.statusCode || 500}`,
      timestamp: new Date().toISOString(),
    };
  },

  getAIProviderUsage: async (id: string): Promise<{ success: boolean; usageInfo: ProviderUsageInfo }> => {
    const res = await safeApiCall<any>(`/api/providers/ai/${encodeURIComponent(id)}/usage`);
    return {
      success: res.success,
      usageInfo: res.data?.usageInfo || {
        providerId: id,
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalTokens: 0,
        averageLatencyMs: 0,
        errorRatePercent: 0,
      },
    };
  },

  updateAIProviders: async (providers: AIProviderConfig[]) => {
    providerStore.saveProviders(providers);
    return { success: true };
  },

  // Search Providers (Backed by browser localStorage & tara_tavily_config)
  getSearchProviders: async (): Promise<SearchProviderConfig[]> => {
    return providerStore.loadSearchProviders();
  },

  saveSearchProvider: async (
    provider: Partial<SearchProviderConfig>
  ): Promise<{ success: boolean; provider: SearchProviderConfig }> => {
    const list = providerStore.loadSearchProviders();
    const existingIndex = list.findIndex((p) => p.id === provider.id);
    let updatedList: SearchProviderConfig[];
    let savedProvider: SearchProviderConfig;

    if (existingIndex >= 0) {
      const existing = list[existingIndex];
      let resolvedKey = existing.apiKey;
      if (typeof provider.apiKey === 'string') {
        const trimmed = provider.apiKey.trim();
        if (trimmed && !trimmed.includes('••••')) {
          resolvedKey = trimmed;
        }
      }
      savedProvider = {
        ...existing,
        ...provider,
        apiKey: resolvedKey,
        hasKey: Boolean(resolvedKey),
        updatedAt: new Date().toISOString(),
      } as SearchProviderConfig;
      list[existingIndex] = savedProvider;
      updatedList = [...list];
    } else {
      savedProvider = {
        id: provider.id || `search-${Date.now()}`,
        name: provider.name || 'Custom Search Provider',
        type: provider.type || 'custom',
        apiKey: provider.apiKey || '',
        hasKey: Boolean(provider.apiKey),
        baseUrl: provider.baseUrl || 'https://api.tavily.com',
        searchDepth: provider.searchDepth || 'advanced',
        maxResults: provider.maxResults || 6,
        priority: provider.priority || list.length + 1,
        enabled: provider.enabled !== undefined ? provider.enabled : true,
      } as SearchProviderConfig;
      updatedList = [...list, savedProvider];
    }

    providerStore.saveSearchProviders(updatedList);
    return {
      success: true,
      provider: savedProvider,
    };
  },

  deleteSearchProvider: async (id: string): Promise<{ success: boolean }> => {
    const list = providerStore.loadSearchProviders();
    const filtered = list.filter((p) => p.id !== id);
    providerStore.saveSearchProviders(filtered);
    return { success: true };
  },

  reorderSearchProviders: async (ids: string[]): Promise<{ success: boolean; providers: SearchProviderConfig[] }> => {
    const list = providerStore.loadSearchProviders();
    const map = new Map(list.map((p) => [p.id, p]));
    const reordered: SearchProviderConfig[] = [];
    ids.forEach((id, idx) => {
      const p = map.get(id);
      if (p) {
        reordered.push({ ...p, priority: idx + 1 });
        map.delete(id);
      }
    });
    map.forEach((p) => reordered.push({ ...p, priority: reordered.length + 1 }));
    providerStore.saveSearchProviders(reordered);
    return { success: true, providers: reordered };
  },

  toggleSearchProvider: async (
    id: string,
    enabled: boolean
  ): Promise<{ success: boolean; provider: SearchProviderConfig }> => {
    const list = providerStore.loadSearchProviders();
    const target = list.find((p) => p.id === id);
    if (!target) throw new Error('Search provider not found');
    target.enabled = enabled;
    providerStore.saveSearchProviders(list);
    return { success: true, provider: target };
  },

  testSearchProvider: async (params: {
    providerId?: string;
    provider?: SearchProviderConfig;
    query?: string;
    depth?: 'basic' | 'advanced';
    maxResults?: number;
  }): Promise<SearchTestResult> => {
    let targetProvider = params.provider;
    if (!targetProvider && (params.providerId === 'search_tavily' || !params.providerId)) {
      const tavily = providerStore.loadTavilyConfig();
      targetProvider = {
        id: 'search_tavily',
        name: 'Tavily AI Search',
        type: 'tavily',
        apiKey: tavily.apiKey,
        baseUrl: tavily.baseUrl || 'https://api.tavily.com',
        searchDepth: tavily.searchDepth || 'advanced',
        maxResults: tavily.maxResults || 6,
        priority: 1,
        enabled: tavily.enabled,
      };
    } else if (!targetProvider && params.providerId) {
      const list = providerStore.loadSearchProviders();
      targetProvider = list.find((p) => p.id === params.providerId);
    }

    const payload = {
      ...params,
      provider: targetProvider,
    };

    const res = await safeApiCall<SearchTestResult>('/api/search/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const resultData: SearchTestResult = res.data || {
      success: false,
      status: 'FAILED',
      latencyMs: 0,
      providerId: targetProvider?.id || 'unknown',
      provider: targetProvider?.name || 'Unknown Search Provider',
      resultsCount: 0,
      results: [],
      error: res.error || 'Search probe failed',
      timestamp: new Date().toISOString(),
    };

    // Update test status in localStorage
    if (targetProvider?.type === 'tavily' || targetProvider?.id === 'search_tavily') {
      providerStore.saveTavilyConfig({
        lastTestedAt: new Date().toISOString(),
        lastTestStatus: resultData.success ? 'SUCCESS' : 'FAILED',
        lastLatencyMs: resultData.latencyMs,
        lastError: resultData.success ? undefined : typeof resultData.error === 'string' ? resultData.error : 'Failed',
      });
    }

    return resultData;
  },

  runSearchPlayground: async (params: {
    providerId?: string;
    provider?: SearchProviderConfig;
    query: string;
    depth?: 'basic' | 'advanced';
    maxResults?: number;
  }): Promise<SearchTestResult> => {
    let targetProvider = params.provider;
    if (!targetProvider && params.providerId) {
      const list = providerStore.loadSearchProviders();
      targetProvider = list.find((p) => p.id === params.providerId);
    }
    const res = await safeApiCall<SearchTestResult>('/api/providers/search/playground', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        provider: targetProvider,
      }),
    });
    if (res.data) return res.data;
    return {
      success: false,
      status: 'FAILED',
      latencyMs: 0,
      providerId: params.providerId || 'unknown',
      provider: params.provider?.name || 'Unknown Search Provider',
      resultsCount: 0,
      results: [],
      error: res.error || 'Search playground query failed',
      timestamp: new Date().toISOString(),
    };
  },

  updateSearchProviders: async (providers: SearchProviderConfig[]) => {
    return safeApiCall<{ success: boolean }>('/api/providers/search', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providers }),
    });
  },

  getTestHistory: async (limit = 25): Promise<{ history: ApiTestHistoryItem[] }> => {
    const res = await safeApiCall<any>(`/api/providers/test-history?limit=${encodeURIComponent(limit)}`);
    return {
      history: Array.isArray(res.data?.history) ? res.data.history : [],
    };
  },

  getProvidersHealth: async (): Promise<any> => {
    const res = await safeApiCall<any>('/api/providers/health');
    return res.data || {};
  },

  exportProvidersConfig: async (includeSecrets = false): Promise<any> => {
    const aiProviders = providerStore.loadProviders().map((p) => ({
      ...p,
      apiKey: includeSecrets ? p.apiKey : p.apiKey ? '••••••••' : '',
    }));
    const tavilyConfig = providerStore.loadTavilyConfig();
    const searchProviders = providerStore.loadSearchProviders().map((p) => ({
      ...p,
      apiKey: includeSecrets ? p.apiKey : p.apiKey ? '••••••••' : '',
    }));
    return {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      aiProviders,
      searchProviders,
      tavilyConfig: {
        ...tavilyConfig,
        apiKey: includeSecrets ? tavilyConfig.apiKey : tavilyConfig.apiKey ? '••••••••' : '',
      },
    };
  },

  importProvidersConfig: async (config: any): Promise<{ success: boolean; aiCount: number; searchCount: number }> => {
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid configuration object');
    }
    let aiCount = 0;
    let searchCount = 0;
    if (Array.isArray(config.aiProviders)) {
      providerStore.saveProviders(config.aiProviders);
      aiCount = config.aiProviders.length;
    }
    if (Array.isArray(config.searchProviders)) {
      providerStore.saveSearchProviders(config.searchProviders);
      searchCount = config.searchProviders.length;
    }
    if (config.tavilyConfig) {
      providerStore.saveTavilyConfig(config.tavilyConfig);
    }
    return {
      success: true,
      aiCount,
      searchCount,
    };
  },

  // Blogger & Health
  getBloggerConfig: async (): Promise<BloggerConfig> => {
    const res = await safeApiCall<any>('/api/blogger');
    return normalizeBloggerConfig(res.data);
  },

  updateBloggerConfig: async (config: any): Promise<{ success: boolean; config: BloggerConfig }> => {
    const res = await safeApiCall<any>('/api/blogger', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return {
      success: res.success,
      config: normalizeBloggerConfig(res.data),
    };
  },

  getHealth: async (): Promise<HealthCheckResponse> => {
    const res = await safeApiCall<any>('/api/health');
    const data = res.data || {};
    return {
      success: res.success && data.status !== 'FAILED',
      service: data.service || 'Axiom Autonomous Operations System',
      status: data.status || (res.success ? 'HEALTHY' : 'DEGRADED'),
      status_code: res.statusCode || 200,
      timestamp: data.timestamp || new Date().toISOString(),
      functions: {
        providers_test: Boolean(data.functions?.providers_test),
        search_test: Boolean(data.functions?.search_test),
      },
      providers: normalizeHealth(data),
      error: res.error,
    };
  },

  // Raw Diagnostic Endpoint Testers for the API Diagnostics Page
  diagnostics: {
    testHealthEndpoint: async (): Promise<{
      status_code: number;
      latency_ms: number;
      data: any;
      contentType: string;
      isJson: boolean;
      rawText: string;
    }> => {
      const startTime = performance.now();
      try {
        const res = await fetch('/api/health', {
          headers: { Accept: 'application/json' },
        });
        const latency_ms = Math.round(performance.now() - startTime);
        const contentType = res.headers.get('content-type') || '';
        const rawText = await res.text();
        let data: any = null;
        let isJson = false;
        try {
          data = JSON.parse(rawText);
          isJson = true;
        } catch {
          isJson = false;
        }
        return {
          status_code: res.status,
          latency_ms,
          data,
          contentType,
          isJson,
          rawText,
        };
      } catch (err: any) {
        return {
          status_code: 0,
          latency_ms: Math.round(performance.now() - startTime),
          data: null,
          contentType: '',
          isJson: false,
          rawText: err.message,
        };
      }
    },

    testAIEndpoint: async (payload: any): Promise<{
      status_code: number;
      latency_ms: number;
      data: any;
      contentType: string;
      isJson: boolean;
      rawText: string;
    }> => {
      const startTime = performance.now();
      try {
        const res = await fetch('/api/providers/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const latency_ms = Math.round(performance.now() - startTime);
        const contentType = res.headers.get('content-type') || '';
        const rawText = await res.text();
        let data: any = null;
        let isJson = false;
        try {
          data = JSON.parse(rawText);
          isJson = true;
        } catch {
          isJson = false;
        }
        return {
          status_code: res.status,
          latency_ms,
          data,
          contentType,
          isJson,
          rawText,
        };
      } catch (err: any) {
        return {
          status_code: 0,
          latency_ms: Math.round(performance.now() - startTime),
          data: null,
          contentType: '',
          isJson: false,
          rawText: err.message,
        };
      }
    },

    testSearchEndpoint: async (payload: any): Promise<{
      status_code: number;
      latency_ms: number;
      data: any;
      contentType: string;
      isJson: boolean;
      rawText: string;
    }> => {
      const startTime = performance.now();
      try {
        const res = await fetch('/api/search/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const latency_ms = Math.round(performance.now() - startTime);
        const contentType = res.headers.get('content-type') || '';
        const rawText = await res.text();
        let data: any = null;
        let isJson = false;
        try {
          data = JSON.parse(rawText);
          isJson = true;
        } catch {
          isJson = false;
        }
        return {
          status_code: res.status,
          latency_ms,
          data,
          contentType,
          isJson,
          rawText,
        };
      } catch (err: any) {
        return {
          status_code: 0,
          latency_ms: Math.round(performance.now() - startTime),
          data: null,
          contentType: '',
          isJson: false,
          rawText: err.message,
        };
      }
    },

    testUnknownRoute: async (routePath: string): Promise<{
      status_code: number;
      latency_ms: number;
      data: any;
      contentType: string;
      isJson: boolean;
      rawText: string;
    }> => {
      const startTime = performance.now();
      try {
        const res = await fetch(routePath, {
          headers: { Accept: 'application/json' },
        });
        const latency_ms = Math.round(performance.now() - startTime);
        const contentType = res.headers.get('content-type') || '';
        const rawText = await res.text();
        let data: any = null;
        let isJson = false;
        try {
          data = JSON.parse(rawText);
          isJson = true;
        } catch {
          isJson = false;
        }
        return {
          status_code: res.status,
          latency_ms,
          data,
          contentType,
          isJson,
          rawText,
        };
      } catch (err: any) {
        return {
          status_code: 0,
          latency_ms: Math.round(performance.now() - startTime),
          data: null,
          contentType: '',
          isJson: false,
          rawText: err.message,
        };
      }
    },
  },
};
