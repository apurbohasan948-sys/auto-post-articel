/**
 * Axiom Client-Side API Service
 * Interacts with /api/* routes (Express or Netlify Serverless Functions).
 */

import {
  AgentJob,
  AgentMemory,
  AIProviderConfig,
  AITestResult,
  ApiTestHistoryItem,
  Article,
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

/**
 * Safe JSON parse utility:
 * Validates that response is valid JSON and never blindly fails with cryptic
 * "Unexpected token '<'" when an HTML page or error document is returned.
 */
async function safeParseResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    const preview = text.trim().slice(0, 140);
    throw new Error(
      `Invalid server response: expected JSON but received HTTP ${res.status} (${contentType || 'unknown type'}). Response body: ${preview}`
    );
  }

  return data as T;
}

async function safeJsonFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  return safeParseResponse<T>(res);
}

export const apiClient = {
  // Agent Lifecycle
  runCycle: async (topicId?: string): Promise<{ success: boolean; job: AgentJob }> => {
    const res = await fetch('/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId }),
    });
    const data = await safeParseResponse<any>(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to trigger cycle');
    }
    return data;
  },

  pauseAgent: async () => {
    const res = await fetch('/api/agent/pause', { method: 'POST' });
    return res.json();
  },

  resumeAgent: async () => {
    const res = await fetch('/api/agent/resume', { method: 'POST' });
    return res.json();
  },

  stopAgent: async () => {
    const res = await fetch('/api/agent/stop', { method: 'POST' });
    return res.json();
  },

  getStatus: async (): Promise<{
    status: string;
    mode: string;
    activeJob: AgentJob | null;
    recentJobsCount: number;
    todayStats: SystemSettings['todayStats'];
  }> => {
    const res = await fetch('/api/agent/status');
    return res.json();
  },

  // Topics
  getTopics: async (): Promise<TopicCandidate[]> => {
    const res = await fetch('/api/topics');
    const data = await res.json();
    return data.topics || [];
  },

  scoutTopics: async (): Promise<TopicCandidate[]> => {
    const res = await fetch('/api/topics/scout', { method: 'POST' });
    const data = await res.json();
    return data.candidates || [];
  },

  // Research Packages
  getResearchPackages: async (): Promise<Record<string, ResearchPackage>> => {
    const res = await fetch('/api/research');
    const data = await res.json();
    return data.research || {};
  },

  // Articles
  getArticles: async (): Promise<Article[]> => {
    const res = await fetch('/api/articles');
    const data = await res.json();
    return data.articles || [];
  },

  getArticle: async (id: string): Promise<Article> => {
    const res = await fetch(`/api/articles/${id}`);
    const data = await res.json();
    return data.article;
  },

  approveArticle: async (id: string): Promise<Article> => {
    const res = await fetch(`/api/articles/${id}/approve`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Approval failed');
    return data.article;
  },

  publishArticle: async (id: string): Promise<Article> => {
    const res = await fetch(`/api/articles/${id}/publish`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Publish failed');
    return data.article;
  },

  // Jobs & Logs
  getJobs: async (): Promise<AgentJob[]> => {
    const res = await fetch('/api/jobs');
    const data = await res.json();
    return data.jobs || [];
  },

  getLogs: async (limit = 100): Promise<SystemLog[]> => {
    const res = await fetch(`/api/logs?limit=${limit}`);
    const data = await res.json();
    return data.logs || [];
  },

  // Analytics & Memory
  getAnalytics: async () => {
    const res = await fetch('/api/analytics');
    const data = await res.json();
    return data.analytics;
  },

  getMemory: async (): Promise<AgentMemory> => {
    const res = await fetch('/api/memory');
    const data = await res.json();
    return data.memory;
  },

  // Settings
  getSettings: async (): Promise<SystemSettings> => {
    const res = await fetch('/api/settings');
    const data = await res.json();
    return data.settings;
  },

  updateSettings: async (settings: Partial<SystemSettings>): Promise<SystemSettings> => {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    return data.settings;
  },

  // Providers
  getAIProviders: async (): Promise<AIProviderConfig[]> => {
    try {
      const res = await fetch('/api/providers');
      const data = await safeParseResponse<any>(res);
      if (Array.isArray(data.providers)) return data.providers;
    } catch {
      // Fallback to legacy path
    }
    const res2 = await fetch('/api/providers/ai');
    const data2 = await safeParseResponse<any>(res2);
    return data2.providers || [];
  },

  saveAIProvider: async (provider: Partial<AIProviderConfig>): Promise<{ success: boolean; provider: AIProviderConfig }> => {
    const res = await fetch('/api/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    const data = await safeParseResponse<any>(res);
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to save AI provider');
    }
    return data;
  },

  deleteAIProvider: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/providers/${id}`, { method: 'DELETE' });
    return safeParseResponse<{ success: boolean }>(res);
  },

  reorderAIProviders: async (ids: string[]): Promise<{ success: boolean; providers: AIProviderConfig[] }> => {
    const res = await fetch('/api/providers/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return safeParseResponse<{ success: boolean; providers: AIProviderConfig[] }>(res);
  },

  toggleAIProvider: async (id: string, enabled: boolean): Promise<{ success: boolean; provider: AIProviderConfig }> => {
    const res = await fetch(`/api/providers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    return safeParseResponse<{ success: boolean; provider: AIProviderConfig }>(res);
  },

  testAIProvider: async (params: { providerId?: string; provider?: AIProviderConfig; prompt?: string }): Promise<AITestResult> => {
    return safeJsonFetch<AITestResult>('/api/providers/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  },

  runAIPlayground: async (params: {
    providerId?: string;
    provider?: AIProviderConfig;
    prompt?: string;
  }): Promise<AITestResult> => {
    return safeJsonFetch<AITestResult>('/api/providers/ai/playground', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  },

  getAIProviderUsage: async (id: string): Promise<{ success: boolean; usageInfo: ProviderUsageInfo }> => {
    return safeJsonFetch<{ success: boolean; usageInfo: ProviderUsageInfo }>(`/api/providers/ai/${id}/usage`);
  },

  updateAIProviders: async (providers: AIProviderConfig[]) => {
    return safeJsonFetch<{ success: boolean }>('/api/providers/ai', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providers }),
    });
  },

  getSearchProviders: async (): Promise<SearchProviderConfig[]> => {
    try {
      const res = await fetch('/api/search-providers');
      const data = await safeParseResponse<any>(res);
      if (Array.isArray(data.providers)) return data.providers;
    } catch {
      // Fallback
    }
    const data = await safeJsonFetch<{ providers?: SearchProviderConfig[] }>('/api/providers/search');
    return data.providers || [];
  },

  saveSearchProvider: async (
    provider: Partial<SearchProviderConfig>
  ): Promise<{ success: boolean; provider: SearchProviderConfig }> => {
    const res = await fetch('/api/search-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    const data = await safeParseResponse<any>(res);
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to save search provider');
    }
    return data;
  },

  deleteSearchProvider: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/search-providers/${id}`, { method: 'DELETE' });
    return safeParseResponse<{ success: boolean }>(res);
  },

  reorderSearchProviders: async (ids: string[]): Promise<{ success: boolean; providers: SearchProviderConfig[] }> => {
    const res = await fetch('/api/search-providers/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return safeParseResponse<{ success: boolean; providers: SearchProviderConfig[] }>(res);
  },

  toggleSearchProvider: async (
    id: string,
    enabled: boolean
  ): Promise<{ success: boolean; provider: SearchProviderConfig }> => {
    const res = await fetch(`/api/search-providers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    return safeParseResponse<{ success: boolean; provider: SearchProviderConfig }>(res);
  },

  testSearchProvider: async (params: {
    providerId?: string;
    provider?: SearchProviderConfig;
    query?: string;
    depth?: 'basic' | 'advanced';
    maxResults?: number;
  }): Promise<SearchTestResult> => {
    return safeJsonFetch<SearchTestResult>('/api/search/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  },

  runSearchPlayground: async (params: {
    providerId?: string;
    provider?: SearchProviderConfig;
    query: string;
    depth?: 'basic' | 'advanced';
    maxResults?: number;
  }): Promise<SearchTestResult> => {
    return safeJsonFetch<SearchTestResult>('/api/providers/search/playground', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  },

  updateSearchProviders: async (providers: SearchProviderConfig[]) => {
    return safeJsonFetch<{ success: boolean }>('/api/providers/search', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providers }),
    });
  },

  getTestHistory: async (limit = 25): Promise<{ history: ApiTestHistoryItem[] }> => {
    return safeJsonFetch<{ history: ApiTestHistoryItem[] }>(`/api/providers/test-history?limit=${limit}`);
  },

  getProvidersHealth: async (): Promise<any> => {
    return safeJsonFetch<any>('/api/providers/health');
  },

  exportProvidersConfig: async (includeSecrets = false): Promise<any> => {
    return safeJsonFetch<any>(`/api/providers/export?includeSecrets=${includeSecrets}`);
  },

  importProvidersConfig: async (config: any): Promise<{ success: boolean; aiCount: number; searchCount: number }> => {
    return safeJsonFetch<{ success: boolean; aiCount: number; searchCount: number }>('/api/providers/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
  },

  // Blogger & Health
  getBloggerConfig: async () => {
    const data = await safeJsonFetch<{ config: any }>('/api/blogger');
    return data.config;
  },

  updateBloggerConfig: async (config: any) => {
    return safeJsonFetch<{ success: boolean; config: any }>('/api/blogger', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  },

  getHealth: async (): Promise<HealthCheckResponse> => {
    return safeJsonFetch<HealthCheckResponse>('/api/health');
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
