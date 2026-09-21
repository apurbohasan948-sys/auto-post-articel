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
  ProviderHealth,
  ProviderUsageInfo,
  ResearchPackage,
  SearchProviderConfig,
  SearchTestResult,
  SystemLog,
  SystemSettings,
  TopicCandidate,
} from '../types/agent.ts';

export const apiClient = {
  // Agent Lifecycle
  runCycle: async (topicId?: string): Promise<{ success: boolean; job: AgentJob }> => {
    const res = await fetch('/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to trigger cycle');
    }
    return res.json();
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
    const res = await fetch('/api/providers/ai');
    const data = await res.json();
    return data.providers || [];
  },

  saveAIProvider: async (provider: Partial<AIProviderConfig>): Promise<{ success: boolean; provider: AIProviderConfig }> => {
    const res = await fetch('/api/providers/ai/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to save AI provider' }));
      throw new Error(err.error || 'Failed to save AI provider');
    }
    return res.json();
  },

  deleteAIProvider: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/providers/ai/${id}`, { method: 'DELETE' });
    return res.json();
  },

  reorderAIProviders: async (ids: string[]): Promise<{ success: boolean; providers: AIProviderConfig[] }> => {
    const res = await fetch('/api/providers/ai/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return res.json();
  },

  toggleAIProvider: async (id: string, enabled: boolean): Promise<{ success: boolean; provider: AIProviderConfig }> => {
    const res = await fetch('/api/providers/ai/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    });
    return res.json();
  },

  testAIProvider: async (params: { providerId?: string; provider?: AIProviderConfig }): Promise<AITestResult> => {
    const res = await fetch('/api/providers/ai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  runAIPlayground: async (params: {
    providerId?: string;
    provider?: AIProviderConfig;
    prompt?: string;
  }): Promise<AITestResult> => {
    const res = await fetch('/api/providers/ai/playground', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  getAIProviderUsage: async (id: string): Promise<{ success: boolean; usageInfo: ProviderUsageInfo }> => {
    const res = await fetch(`/api/providers/ai/${id}/usage`);
    return res.json();
  },

  updateAIProviders: async (providers: AIProviderConfig[]) => {
    const res = await fetch('/api/providers/ai', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providers }),
    });
    return res.json();
  },

  getSearchProviders: async (): Promise<SearchProviderConfig[]> => {
    const res = await fetch('/api/providers/search');
    const data = await res.json();
    return data.providers || [];
  },

  saveSearchProvider: async (
    provider: Partial<SearchProviderConfig>
  ): Promise<{ success: boolean; provider: SearchProviderConfig }> => {
    const res = await fetch('/api/providers/search/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to save search provider' }));
      throw new Error(err.error || 'Failed to save search provider');
    }
    return res.json();
  },

  deleteSearchProvider: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/providers/search/${id}`, { method: 'DELETE' });
    return res.json();
  },

  reorderSearchProviders: async (ids: string[]): Promise<{ success: boolean; providers: SearchProviderConfig[] }> => {
    const res = await fetch('/api/providers/search/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return res.json();
  },

  toggleSearchProvider: async (
    id: string,
    enabled: boolean
  ): Promise<{ success: boolean; provider: SearchProviderConfig }> => {
    const res = await fetch('/api/providers/search/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    });
    return res.json();
  },

  testSearchProvider: async (params: {
    providerId?: string;
    provider?: SearchProviderConfig;
  }): Promise<SearchTestResult> => {
    const res = await fetch('/api/providers/search/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  runSearchPlayground: async (params: {
    providerId?: string;
    provider?: SearchProviderConfig;
    query: string;
    depth?: 'basic' | 'advanced';
    maxResults?: number;
  }): Promise<SearchTestResult> => {
    const res = await fetch('/api/providers/search/playground', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  updateSearchProviders: async (providers: SearchProviderConfig[]) => {
    const res = await fetch('/api/providers/search', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providers }),
    });
    return res.json();
  },

  getTestHistory: async (limit = 25): Promise<{ history: ApiTestHistoryItem[] }> => {
    const res = await fetch(`/api/providers/test-history?limit=${limit}`);
    return res.json();
  },

  getProvidersHealth: async (): Promise<any> => {
    const res = await fetch('/api/providers/health');
    return res.json();
  },

  exportProvidersConfig: async (includeSecrets = false): Promise<any> => {
    const res = await fetch(`/api/providers/export?includeSecrets=${includeSecrets}`);
    return res.json();
  },

  importProvidersConfig: async (config: any): Promise<{ success: boolean; aiCount: number; searchCount: number }> => {
    const res = await fetch('/api/providers/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    return res.json();
  },

  // Blogger & Health
  getBloggerConfig: async () => {
    const res = await fetch('/api/blogger');
    const data = await res.json();
    return data.config;
  },

  updateBloggerConfig: async (config: any) => {
    const res = await fetch('/api/blogger', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return res.json();
  },

  getHealth: async (): Promise<{ status: string; providers: ProviderHealth; timestamp: string }> => {
    const res = await fetch('/api/health');
    return res.json();
  },
};
