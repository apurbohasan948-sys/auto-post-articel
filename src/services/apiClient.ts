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
      const errMsg = parsed?.error || parsed?.message || `HTTP request failed with status ${res.status}`;
      return {
        success: false,
        data: (parsed?.data ?? fallback) as T,
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
    const res = await safeApiCall<any>('/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId }),
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

  // AI Providers
  getAIProviders: async (): Promise<AIProviderConfig[]> => {
    // Primary RESTful endpoint
    const res = await safeApiCall<any>('/api/providers');
    if (res.success && Array.isArray(res.data?.providers)) {
      return normalizeAIProviders(res.data.providers);
    }
    // Fallback to legacy path
    const fallbackRes = await safeApiCall<any>('/api/providers/ai');
    if (fallbackRes.success && Array.isArray(fallbackRes.data?.providers)) {
      return normalizeAIProviders(fallbackRes.data.providers);
    }
    return [];
  },

  saveAIProvider: async (
    provider: Partial<AIProviderConfig>
  ): Promise<{ success: boolean; provider: AIProviderConfig }> => {
    const res = await safeApiCall<any>('/api/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    if (!res.success || !res.data?.success) {
      throw new Error(res.error || res.data?.error || 'Failed to save AI provider');
    }
    return {
      success: true,
      provider: normalizeAIProviders([res.data.provider])[0],
    };
  },

  deleteAIProvider: async (id: string): Promise<{ success: boolean }> => {
    const res = await safeApiCall<{ success: boolean }>(`/api/providers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return { success: Boolean(res.data?.success || res.success) };
  },

  reorderAIProviders: async (ids: string[]): Promise<{ success: boolean; providers: AIProviderConfig[] }> => {
    const res = await safeApiCall<any>('/api/providers/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return {
      success: res.success,
      providers: normalizeAIProviders(res.data?.providers),
    };
  },

  toggleAIProvider: async (
    id: string,
    enabled: boolean
  ): Promise<{ success: boolean; provider: AIProviderConfig }> => {
    const res = await safeApiCall<any>(`/api/providers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!res.success) {
      throw new Error(res.error || 'Failed to toggle AI provider');
    }
    return {
      success: true,
      provider: normalizeAIProviders([res.data?.provider])[0],
    };
  },

  testAIProvider: async (params: {
    providerId?: string;
    provider?: AIProviderConfig;
    prompt?: string;
  }): Promise<AITestResult> => {
    const res = await safeApiCall<AITestResult>('/api/providers/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.data) return res.data;
    return {
      success: false,
      status: 'FAILED',
      latencyMs: 0,
      providerId: params.providerId || 'unknown',
      provider: params.provider?.name || 'Unknown',
      model: params.provider?.modelName || params.provider?.defaultModel || '',
      error: res.error || 'Failed to execute test probe',
      timestamp: new Date().toISOString(),
    };
  },

  runAIPlayground: async (params: {
    providerId?: string;
    provider?: AIProviderConfig;
    prompt?: string;
  }): Promise<AITestResult> => {
    const res = await safeApiCall<AITestResult>('/api/providers/ai/playground', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.data) return res.data;
    return {
      success: false,
      status: 'FAILED',
      latencyMs: 0,
      providerId: params.providerId || 'unknown',
      provider: params.provider?.name || 'Unknown',
      model: params.provider?.modelName || params.provider?.defaultModel || '',
      error: res.error || 'Failed to execute playground query',
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
    return safeApiCall<{ success: boolean }>('/api/providers/ai', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providers }),
    });
  },

  // Search Providers
  getSearchProviders: async (): Promise<SearchProviderConfig[]> => {
    const res = await safeApiCall<any>('/api/search-providers');
    if (res.success && Array.isArray(res.data?.providers)) {
      return normalizeSearchProviders(res.data.providers);
    }
    const fallbackRes = await safeApiCall<any>('/api/providers/search');
    if (fallbackRes.success && Array.isArray(fallbackRes.data?.providers)) {
      return normalizeSearchProviders(fallbackRes.data.providers);
    }
    return [];
  },

  saveSearchProvider: async (
    provider: Partial<SearchProviderConfig>
  ): Promise<{ success: boolean; provider: SearchProviderConfig }> => {
    const res = await safeApiCall<any>('/api/search-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    if (!res.success || !res.data?.success) {
      throw new Error(res.error || res.data?.error || 'Failed to save search provider');
    }
    return {
      success: true,
      provider: normalizeSearchProviders([res.data.provider])[0],
    };
  },

  deleteSearchProvider: async (id: string): Promise<{ success: boolean }> => {
    const res = await safeApiCall<{ success: boolean }>(`/api/search-providers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return { success: Boolean(res.data?.success || res.success) };
  },

  reorderSearchProviders: async (ids: string[]): Promise<{ success: boolean; providers: SearchProviderConfig[] }> => {
    const res = await safeApiCall<any>('/api/search-providers/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return {
      success: res.success,
      providers: normalizeSearchProviders(res.data?.providers),
    };
  },

  toggleSearchProvider: async (
    id: string,
    enabled: boolean
  ): Promise<{ success: boolean; provider: SearchProviderConfig }> => {
    const res = await safeApiCall<any>(`/api/search-providers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!res.success) {
      throw new Error(res.error || 'Failed to toggle search provider');
    }
    return {
      success: true,
      provider: normalizeSearchProviders([res.data?.provider])[0],
    };
  },

  testSearchProvider: async (params: {
    providerId?: string;
    provider?: SearchProviderConfig;
    query?: string;
    depth?: 'basic' | 'advanced';
    maxResults?: number;
  }): Promise<SearchTestResult> => {
    const res = await safeApiCall<SearchTestResult>('/api/search/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
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
      error: res.error || 'Search probe failed',
      timestamp: new Date().toISOString(),
    };
  },

  runSearchPlayground: async (params: {
    providerId?: string;
    provider?: SearchProviderConfig;
    query: string;
    depth?: 'basic' | 'advanced';
    maxResults?: number;
  }): Promise<SearchTestResult> => {
    const res = await safeApiCall<SearchTestResult>('/api/providers/search/playground', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
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
    const res = await safeApiCall<any>(`/api/providers/export?includeSecrets=${encodeURIComponent(includeSecrets)}`);
    return res.data || {};
  },

  importProvidersConfig: async (config: any): Promise<{ success: boolean; aiCount: number; searchCount: number }> => {
    const res = await safeApiCall<any>('/api/providers/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    return {
      success: Boolean(res.data?.success),
      aiCount: typeof res.data?.aiCount === 'number' ? res.data.aiCount : 0,
      searchCount: typeof res.data?.searchCount === 'number' ? res.data.searchCount : 0,
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
