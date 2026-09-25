/**
 * Netlify Serverless Function: API Router
 * Handles all /api/* requests when deployed to Netlify Functions.
 */

import { AnalyticsMonitorAgent } from '../../src/agents/AnalyticsMonitorAgent.ts';
import { BloggerPublisherAgent } from '../../src/agents/BloggerPublisherAgent.ts';
import { Orchestrator } from '../../src/agents/Orchestrator.ts';
import { TopicScoutAgent } from '../../src/agents/TopicScoutAgent.ts';
import { decryptSecret, encryptSecret, maskApiKey } from '../../src/services/encryption.ts';
import { ProviderTestingService } from '../../src/services/providerTestingService.ts';
import { SearchProviderManager } from '../../src/services/searchProvider.ts';
import { StorageService } from '../../src/services/storage.ts';

export const handler = async (event: any) => {
  const storage = StorageService.getInstance();
  const orchestrator = Orchestrator.getInstance();
  const analytics = new AnalyticsMonitorAgent();
  const scout = new TopicScoutAgent();
  const bloggerAgent = new BloggerPublisherAgent();
  const testingService = ProviderTestingService.getInstance();

  const path = event.path.replace(/^\/\.netlify\/functions\/api/, '').replace(/^\/api/, '') || '/';
  const method = event.httpMethod;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    let body: any = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch {
        body = {};
      }
    }

    // Router matching
    if (path === '/agent/run' && method === 'POST') {
      const { topicId, isManualApprovalRun, aiProviders, tavilyConfig } = body || {};
      if (Array.isArray(aiProviders) && aiProviders.length > 0) {
        storage.updateAIProviders(aiProviders);
      }
      if (tavilyConfig && tavilyConfig.apiKey && !tavilyConfig.apiKey.includes('••••')) {
        const cleanKey = tavilyConfig.apiKey.trim();
        SearchProviderManager.getInstance().setRuntimeTavilyApiKey(cleanKey);
        SearchProviderManager.getInstance().setRuntimeTavilyConfig({
          apiKey: cleanKey,
          baseUrl: tavilyConfig.baseUrl,
          enabled: tavilyConfig.enabled ?? true,
        });
        const tavily = storage.getSearchProviders().find((p) => p.type === 'tavily') || {
          id: 'search_tavily',
          name: 'Tavily AI Search',
          type: 'tavily',
          baseUrl: tavilyConfig.baseUrl || 'https://api.tavily.com',
          priority: 1,
        };
        storage.saveSearchProvider({
          ...tavily,
          apiKey: cleanKey,
          enabled: tavilyConfig.enabled ?? true,
          baseUrl: tavilyConfig.baseUrl || 'https://api.tavily.com',
        });
      }
      const job = await orchestrator.runCycle({
        specificTopicId: topicId,
        isManualApprovalRun,
        tavilyConfig,
        aiProviders,
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, job }) };
    }

    if (path === '/agent/pause' && method === 'POST') {
      orchestrator.pauseAgent();
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, status: 'PAUSED' }) };
    }

    if (path === '/agent/resume' && method === 'POST') {
      orchestrator.resumeAgent();
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, status: 'IDLE' }) };
    }

    if (path === '/agent/stop' && method === 'POST') {
      orchestrator.stopEmergency();
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, status: 'STOPPED' }) };
    }

    if (path === '/agent/status' && method === 'GET') {
      const settings = storage.getSettings();
      const jobs = storage.getJobs();
      const activeJob = jobs.find((j) => j.status === 'RUNNING');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: settings.status,
          mode: settings.mode,
          activeJob: activeJob || null,
          recentJobsCount: jobs.length,
          todayStats: settings.todayStats,
        }),
      };
    }

    if (path === '/topics' && method === 'GET') {
      return { statusCode: 200, headers, body: JSON.stringify({ topics: storage.getTopics() }) };
    }

    if (path === '/topics/scout' && method === 'POST') {
      const candidates = await scout.scoutCandidateTopics();
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, candidates }) };
    }

    if (path === '/research' && method === 'GET') {
      return { statusCode: 200, headers, body: JSON.stringify({ research: storage.getAllResearchPackages() }) };
    }

    if (path === '/articles' && method === 'GET') {
      return { statusCode: 200, headers, body: JSON.stringify({ articles: storage.getArticles() }) };
    }

    if (path.startsWith('/articles/') && path.endsWith('/approve') && method === 'POST') {
      const id = path.split('/')[2];
      const article = storage.getArticleById(id);
      if (!article) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
      const pub = await bloggerAgent.handlePublish(article, true);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, article: pub }) };
    }

    if (path === '/jobs' && method === 'GET') {
      return { statusCode: 200, headers, body: JSON.stringify({ jobs: storage.getJobs() }) };
    }

    if (path === '/logs' && method === 'GET') {
      return { statusCode: 200, headers, body: JSON.stringify({ logs: storage.getLogs(100) }) };
    }

    if (path === '/analytics' && method === 'GET') {
      return { statusCode: 200, headers, body: JSON.stringify({ analytics: analytics.getSummaryMetrics() }) };
    }

    if (path === '/memory' && method === 'GET') {
      return { statusCode: 200, headers, body: JSON.stringify({ memory: storage.getMemory() }) };
    }

    // --- API Control Center Routes ---
    if ((path === '/providers' || path === '/providers/ai') && method === 'GET') {
      const providers = storage.getAIProviders().map((p) => ({
        ...p,
        id: p.id,
        name: p.name,
        type: p.type,
        baseUrl: p.baseUrl || '',
        base_url: p.baseUrl || '',
        model: p.modelName || p.defaultModel || 'gpt-4o',
        modelName: p.modelName || p.defaultModel || 'gpt-4o',
        defaultModel: p.defaultModel || p.modelName || 'gpt-4o',
        enabled: Boolean(p.enabled),
        priority: p.priority ?? 1,
        apiKey: maskApiKey(p.apiKey),
        hasKey: Boolean(p.apiKey),
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, providers }) };
    }

    if ((path === '/providers' || path === '/providers/ai' || path === '/providers/ai/save') && method === 'POST') {
      const provider = body.provider || body;
      if (!provider || !provider.name || typeof provider.name !== 'string' || !provider.name.trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Provider name is required' }) };
      }
      const existing = storage.getAIProviders().find((p) => p.id === provider.id);
      let finalKey = provider.apiKey;
      if (finalKey && !finalKey.includes('••••')) {
        finalKey = encryptSecret(finalKey);
      } else {
        finalKey = existing?.apiKey || '';
      }
      const saved = storage.saveAIProvider({
        ...provider,
        id: provider.id,
        modelName: provider.modelName || provider.model || provider.defaultModel || 'gpt-4o',
        baseUrl: provider.baseUrl || provider.base_url || '',
        apiKey: finalKey,
        hasKey: Boolean(finalKey),
      });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          provider: {
            ...saved,
            baseUrl: saved.baseUrl,
            base_url: saved.baseUrl,
            model: saved.modelName,
            modelName: saved.modelName,
            apiKey: maskApiKey(saved.apiKey),
            hasKey: Boolean(saved.apiKey),
          },
        }),
      };
    }

    if (((path.startsWith('/providers/') && !path.startsWith('/providers/search') && !path.startsWith('/providers/ai/')) || path.startsWith('/providers/ai/')) && method === 'PUT') {
      const id = path.split('/')[path.startsWith('/providers/ai/') ? 3 : 2];
      const provider = body.provider || body;
      const existing = storage.getAIProviders().find((p) => p.id === id);
      let finalKey = provider.apiKey;
      if (finalKey && !finalKey.includes('••••')) {
        finalKey = encryptSecret(finalKey);
      } else {
        finalKey = existing?.apiKey || '';
      }
      const saved = storage.saveAIProvider({
        ...provider,
        id,
        apiKey: finalKey,
        hasKey: Boolean(finalKey),
      });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          provider: {
            ...saved,
            baseUrl: saved.baseUrl,
            base_url: saved.baseUrl,
            model: saved.modelName,
            modelName: saved.modelName,
            apiKey: maskApiKey(saved.apiKey),
            hasKey: Boolean(saved.apiKey),
          },
        }),
      };
    }

    if (((path.startsWith('/providers/') && !path.startsWith('/providers/search') && !path.startsWith('/providers/ai/')) || path.startsWith('/providers/ai/')) && method === 'PATCH') {
      const id = path.split('/')[path.startsWith('/providers/ai/') ? 3 : 2];
      const patch = body || {};
      const current = storage.getAIProviders().find((p) => p.id === id);
      if (!current) {
        return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Provider not found' }) };
      }
      let finalKey = current.apiKey;
      if (patch.apiKey && !patch.apiKey.includes('••••')) {
        finalKey = encryptSecret(patch.apiKey);
      }
      const updated = storage.saveAIProvider({
        ...current,
        ...patch,
        id,
        apiKey: finalKey,
      });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          provider: {
            ...updated,
            baseUrl: updated.baseUrl,
            base_url: updated.baseUrl,
            model: updated.modelName,
            modelName: updated.modelName,
            apiKey: maskApiKey(updated.apiKey),
            hasKey: Boolean(updated.apiKey),
          },
        }),
      };
    }

    if (((path.startsWith('/providers/') && !path.startsWith('/providers/search') && !path.startsWith('/providers/ai/')) || path.startsWith('/providers/ai/')) && method === 'DELETE') {
      const id = path.split('/')[path.startsWith('/providers/ai/') ? 3 : 2];
      const success = storage.deleteAIProvider(id);
      return { statusCode: 200, headers, body: JSON.stringify({ success, deletedId: id }) };
    }

    if ((path === '/providers/reorder' || path === '/providers/ai/reorder') && method === 'POST') {
      if (!Array.isArray(body.ids)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'ids array required' }) };
      storage.reorderAIProviders(body.ids);
      const providers = storage.getAIProviders().map((p) => ({
        ...p,
        apiKey: maskApiKey(p.apiKey),
        hasKey: Boolean(p.apiKey),
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, providers }) };
    }

    if (path === '/providers/ai/toggle' && method === 'POST') {
      const updated = storage.toggleAIProvider(body.id, Boolean(body.enabled));
      return { statusCode: 200, headers, body: JSON.stringify({ success: Boolean(updated), provider: updated }) };
    }

    if ((path === '/providers/test' || path === '/providers/ai/test') && method === 'POST') {
      let target = body.provider;
      if (body.providerId) {
        const stored = storage.getAIProviders().find((p) => p.id === body.providerId);
        if (stored) {
          target = { ...stored, ...(body.provider || {}) };
          if (target.apiKey && target.apiKey.includes('••••') && stored.apiKey) {
            target.apiKey = stored.apiKey;
          }
        }
      }
      if (!target) {
        const errorObj = {
          type: 'provider_not_found',
          message: 'Provider not found',
          providerStatus: 404,
          url: '',
        };
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            ok: false,
            success: false,
            status: 'FAILED',
            status_code: 404,
            error: errorObj,
            errorDetails: errorObj,
            latency_ms: 0,
            latencyMs: 0,
            timestamp: new Date().toISOString(),
          }),
        };
      }
      if (target.apiKey && target.apiKey.includes('••••')) {
        const stored = storage.getAIProviders().find((p) => p.id === target.id);
        if (stored && stored.apiKey && !stored.apiKey.includes('••••')) {
          target.apiKey = stored.apiKey;
        }
      }
      const testResult = await testingService.testAIProvider(target, body.prompt || 'Reply with OK');
      const httpStatus =
        typeof testResult.status_code === 'number'
          ? testResult.status_code
          : typeof testResult.status === 'number'
          ? testResult.status
          : testResult.success
          ? 200
          : 400;
      return { statusCode: httpStatus, headers, body: JSON.stringify(testResult) };
    }

    if (path === '/providers/ai/playground' && method === 'POST') {
      let target = body.provider;
      if (body.providerId) {
        target = storage.getAIProviders().find((p) => p.id === body.providerId);
      }
      if (!target) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Provider not found' }) };
      if (target.apiKey && target.apiKey.includes('••••')) {
        const stored = storage.getAIProviders().find((p) => p.id === target.id);
        if (stored) target.apiKey = stored.apiKey;
      }
      const result = await testingService.testAIProvider(target, body.prompt || 'Write one short sentence about technology.');
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    if (path.startsWith('/providers/ai/') && path.endsWith('/usage') && method === 'GET') {
      const id = path.split('/')[3];
      const p = storage.getAIProviders().find((item) => item.id === id);
      if (!p) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Provider not found' }) };
      if (p.type === 'openrouter' && p.apiKey) {
        const raw = decryptSecret(p.apiKey);
        const usage = await testingService.fetchOpenRouterUsage(raw);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, usageInfo: usage }) };
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          usageInfo: p.usageInfo || { hasUsageData: false, message: 'Usage information unavailable' },
        }),
      };
    }

    if ((path === '/search-providers' || path === '/providers/search') && method === 'GET') {
      const providers = storage.getSearchProviders().map((p) => ({
        ...p,
        id: p.id,
        name: p.name,
        type: p.type,
        baseUrl: p.baseUrl || 'https://api.tavily.com',
        base_url: p.baseUrl || 'https://api.tavily.com',
        enabled: Boolean(p.enabled),
        priority: p.priority ?? 1,
        apiKey: maskApiKey(p.apiKey),
        hasKey: Boolean(p.apiKey),
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, providers }) };
    }

    if ((path === '/search-providers' || path === '/providers/search' || path === '/providers/search/save') && method === 'POST') {
      const provider = body.provider || body;
      if (!provider || !provider.name || typeof provider.name !== 'string' || !provider.name.trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Search provider name is required' }) };
      }
      const existing = storage.getSearchProviders().find((p) => p.id === provider.id);
      let finalKey = provider.apiKey;
      if (finalKey && !finalKey.includes('••••')) {
        finalKey = encryptSecret(finalKey);
      } else {
        finalKey = existing?.apiKey || '';
      }
      const saved = storage.saveSearchProvider({
        ...provider,
        id: provider.id,
        baseUrl: provider.baseUrl || provider.base_url || 'https://api.tavily.com',
        apiKey: finalKey,
        hasKey: Boolean(finalKey),
      });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          provider: {
            ...saved,
            baseUrl: saved.baseUrl,
            base_url: saved.baseUrl,
            apiKey: maskApiKey(saved.apiKey),
            hasKey: Boolean(saved.apiKey),
          },
        }),
      };
    }

    if ((path.startsWith('/search-providers/') || (path.startsWith('/providers/search/') && !path.endsWith('/test'))) && method === 'PUT') {
      const parts = path.split('/');
      const id = path.startsWith('/search-providers/') ? parts[2] : parts[3];
      const provider = body.provider || body;
      const existing = storage.getSearchProviders().find((p) => p.id === id);
      let finalKey = provider.apiKey;
      if (finalKey && !finalKey.includes('••••')) {
        finalKey = encryptSecret(finalKey);
      } else {
        finalKey = existing?.apiKey || '';
      }
      const saved = storage.saveSearchProvider({
        ...provider,
        id,
        apiKey: finalKey,
        hasKey: Boolean(finalKey),
      });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          provider: {
            ...saved,
            baseUrl: saved.baseUrl,
            base_url: saved.baseUrl,
            apiKey: maskApiKey(saved.apiKey),
            hasKey: Boolean(saved.apiKey),
          },
        }),
      };
    }

    if ((path.startsWith('/search-providers/') || (path.startsWith('/providers/search/') && !path.endsWith('/test'))) && method === 'PATCH') {
      const parts = path.split('/');
      const id = path.startsWith('/search-providers/') ? parts[2] : parts[3];
      const patch = body || {};
      const current = storage.getSearchProviders().find((p) => p.id === id);
      if (!current) {
        return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Search provider not found' }) };
      }
      let finalKey = current.apiKey;
      if (patch.apiKey && !patch.apiKey.includes('••••')) {
        finalKey = encryptSecret(patch.apiKey);
      }
      const updated = storage.saveSearchProvider({
        ...current,
        ...patch,
        id,
        apiKey: finalKey,
      });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          provider: {
            ...updated,
            baseUrl: updated.baseUrl,
            base_url: updated.baseUrl,
            apiKey: maskApiKey(updated.apiKey),
            hasKey: Boolean(updated.apiKey),
          },
        }),
      };
    }

    if ((path.startsWith('/search-providers/') || (path.startsWith('/providers/search/') && !path.endsWith('/test'))) && method === 'DELETE') {
      const parts = path.split('/');
      const id = path.startsWith('/search-providers/') ? parts[2] : parts[3];
      const success = storage.deleteSearchProvider(id);
      return { statusCode: 200, headers, body: JSON.stringify({ success, deletedId: id }) };
    }

    if ((path === '/search-providers/reorder' || path === '/providers/search/reorder') && method === 'POST') {
      if (!Array.isArray(body.ids)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'ids array required' }) };
      storage.reorderSearchProviders(body.ids);
      const providers = storage.getSearchProviders().map((p) => ({
        ...p,
        apiKey: maskApiKey(p.apiKey),
        hasKey: Boolean(p.apiKey),
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, providers }) };
    }

    if (path === '/providers/search/toggle' && method === 'POST') {
      const updated = storage.toggleSearchProvider(body.id, Boolean(body.enabled));
      return { statusCode: 200, headers, body: JSON.stringify({ success: Boolean(updated), provider: updated }) };
    }

    if ((path === '/search/test' || path === '/providers/search/test') && method === 'POST') {
      let target = body.provider;
      if (!target && body.providerId) {
        target = storage.getSearchProviders().find((p) => p.id === body.providerId);
      } else if (target && body.providerId) {
        const stored = storage.getSearchProviders().find((p) => p.id === body.providerId);
        if (stored) {
          target = {
            ...stored,
            ...target,
            apiKey: target.apiKey && !target.apiKey.includes('••••')
              ? target.apiKey
              : (stored.apiKey || process.env.TAVILY_API_KEY || ''),
          };
        }
      }

      if (body.tavilyConfig && body.tavilyConfig.apiKey && !body.tavilyConfig.apiKey.includes('••••')) {
        if (!target || target.type === 'tavily') {
          target = {
            ...(target || {}),
            id: 'search_tavily',
            name: 'Tavily AI Search',
            type: 'tavily',
            baseUrl: body.tavilyConfig.baseUrl || 'https://api.tavily.com',
            apiKey: body.tavilyConfig.apiKey.trim(),
            searchDepth: body.tavilyConfig.searchDepth || 'advanced',
            maxResults: body.tavilyConfig.maxResults || 6,
            priority: 1,
            enabled: true,
          };
        }
      }

      if (!target) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            status: 'FAILED',
            status_code: 404,
            error: 'Search provider not found',
            latency_ms: 0,
            latencyMs: 0,
            result_count: 0,
            resultsCount: 0,
            results: [],
            timestamp: new Date().toISOString(),
          }),
        };
      }

      if (target.apiKey && target.apiKey.includes('••••')) {
        const stored = storage.getSearchProviders().find((p) => p.id === target.id);
        if (stored && stored.apiKey && !stored.apiKey.includes('••••')) {
          target.apiKey = stored.apiKey;
        } else if (process.env.TAVILY_API_KEY) {
          target.apiKey = process.env.TAVILY_API_KEY;
        }
      }

      if (target.type === 'tavily' && target.apiKey && !target.apiKey.includes('••••')) {
        storage.saveSearchProvider(target);
        SearchProviderManager.getInstance().setRuntimeTavilyApiKey(target.apiKey);
      }

      const result = await testingService.testSearchProvider(target, body.query || 'ai agent verification ping', body.depth || 'basic', body.maxResults || 3);
      const httpStatus = typeof result.status === 'number' ? result.status : result.success ? 200 : 400;
      return { statusCode: httpStatus, headers, body: JSON.stringify(result) };
    }

    if (path === '/providers/search/playground' && method === 'POST') {
      let target = body.provider;
      if (!target && body.providerId) {
        target = storage.getSearchProviders().find((p) => p.id === body.providerId);
      } else if (target && body.providerId) {
        const stored = storage.getSearchProviders().find((p) => p.id === body.providerId);
        if (stored) {
          target = {
            ...stored,
            ...target,
            apiKey: target.apiKey && !target.apiKey.includes('••••')
              ? target.apiKey
              : (stored.apiKey || process.env.TAVILY_API_KEY || ''),
          };
        }
      }

      if (body.tavilyConfig && body.tavilyConfig.apiKey && !body.tavilyConfig.apiKey.includes('••••')) {
        if (!target || target.type === 'tavily') {
          target = {
            ...(target || {}),
            id: 'search_tavily',
            name: 'Tavily AI Search',
            type: 'tavily',
            baseUrl: body.tavilyConfig.baseUrl || 'https://api.tavily.com',
            apiKey: body.tavilyConfig.apiKey.trim(),
            searchDepth: body.tavilyConfig.searchDepth || 'advanced',
            maxResults: body.tavilyConfig.maxResults || 6,
            priority: 1,
            enabled: true,
          };
        }
      }

      if (!target) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Search provider not found' }) };

      if (target.apiKey && target.apiKey.includes('••••')) {
        const stored = storage.getSearchProviders().find((p) => p.id === target.id);
        if (stored && stored.apiKey && !stored.apiKey.includes('••••')) {
          target.apiKey = stored.apiKey;
        } else if (process.env.TAVILY_API_KEY) {
          target.apiKey = process.env.TAVILY_API_KEY;
        }
      }

      if (target.type === 'tavily' && target.apiKey && !target.apiKey.includes('••••')) {
        storage.saveSearchProvider(target);
        SearchProviderManager.getInstance().setRuntimeTavilyApiKey(target.apiKey);
      }

      const result = await testingService.testSearchProvider(
        target,
        body.query || 'latest artificial intelligence trends',
        body.depth || 'basic',
        body.maxResults || 5
      );
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    if (path === '/providers/test-history' && method === 'GET') {
      const limit = event.queryStringParameters?.limit ? Number(event.queryStringParameters.limit) : 25;
      return { statusCode: 200, headers, body: JSON.stringify({ history: storage.getTestHistory(limit) }) };
    }

    if (path === '/providers/health' && method === 'GET') {
      const aiList = storage.getAIProviders();
      const searchList = storage.getSearchProviders();
      const bloggerCfg = storage.getBloggerConfig();
      const primaryAI = aiList.filter((p) => p.enabled).sort((a, b) => a.priority - b.priority)[0];
      const primarySearch = searchList.filter((p) => p.enabled).sort((a, b) => a.priority - b.priority)[0];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          primaryAI: primaryAI ? { id: primaryAI.id, name: primaryAI.name, model: primaryAI.modelName } : null,
          primarySearch: primarySearch ? { id: primarySearch.id, name: primarySearch.name } : null,
          aiProviders: aiList.map((p) => ({
            id: p.id,
            name: p.name,
            type: p.type,
            model: p.modelName,
            priority: p.priority,
            enabled: p.enabled,
            hasKey: Boolean(p.apiKey),
            status: p.lastTestStatus || 'NEVER_TESTED',
            latencyMs: p.lastLatencyMs,
            lastTestedAt: p.lastTestedAt,
            error: p.lastError,
          })),
          searchProviders: searchList.map((p) => ({
            id: p.id,
            name: p.name,
            type: p.type,
            priority: p.priority,
            enabled: p.enabled,
            hasKey: Boolean(p.apiKey),
            status: p.lastTestStatus || 'NEVER_TESTED',
            latencyMs: p.lastLatencyMs,
            lastTestedAt: p.lastTestedAt,
            error: p.lastError,
          })),
          blogger: {
            isConnected: bloggerCfg.isConnected || Boolean(process.env.BLOGGER_REFRESH_TOKEN),
            blogName: bloggerCfg.blogName,
            blogUrl: bloggerCfg.blogUrl,
            mode: bloggerCfg.publishingMode,
          },
          social: {
            facebook: Boolean(process.env.FACEBOOK_PAGE_ACCESS_TOKEN),
            telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
            linkedin: Boolean(process.env.LINKEDIN_ACCESS_TOKEN),
            x: Boolean(process.env.X_ACCESS_TOKEN),
            threads: Boolean(process.env.THREADS_ACCESS_TOKEN),
          },
        }),
      };
    }

    if (path === '/providers/export' && method === 'GET') {
      const includeSecrets = event.queryStringParameters?.includeSecrets === 'true';
      return { statusCode: 200, headers, body: JSON.stringify(storage.exportConfiguration(includeSecrets)) };
    }

    if (path === '/providers/import' && method === 'POST') {
      if (!body.config) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing config payload' }) };
      const res = storage.importConfiguration(body.config);
      return { statusCode: 200, headers, body: JSON.stringify(res) };
    }

    if (path === '/settings' && method === 'GET') {
      return { statusCode: 200, headers, body: JSON.stringify({ settings: storage.getSettings() }) };
    }

    if (path === '/settings' && method === 'PUT') {
      const updated = storage.updateSettings(body);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, settings: updated }) };
    }

    if (path === '/health' && method === 'GET') {
      const aiProviders = storage.getAIProviders();
      const searchProviders = storage.getSearchProviders();
      const bloggerCfg = storage.getBloggerConfig();
      const openrouter = aiProviders.find((p) => p.type === 'openrouter');
      const gemini = aiProviders.find((p) => p.type === 'gemini');
      const tavily = searchProviders.find((p) => p.type === 'tavily');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          service: 'content-agent-api',
          status: 'HEALTHY',
          status_code: 200,
          timestamp: new Date().toISOString(),
          functions: {
            providers_test: true,
            search_test: true,
          },
          providers: {
            openrouter: openrouter?.apiKey || process.env.OPENROUTER_API_KEY ? 'ONLINE' : 'NOT_CONFIGURED',
            gemini: gemini?.apiKey || process.env.GEMINI_API_KEY ? 'ONLINE' : 'NOT_CONFIGURED',
            tavily: tavily?.apiKey || process.env.TAVILY_API_KEY ? 'ONLINE' : 'NOT_CONFIGURED',
            blogger: bloggerCfg.isConnected ? 'CONNECTED' : process.env.BLOGGER_REFRESH_TOKEN ? 'CONNECTED' : 'DISCONNECTED',
            facebook: process.env.FACEBOOK_PAGE_ACCESS_TOKEN ? 'CONNECTED' : 'NOT_CONFIGURED',
            telegram: process.env.TELEGRAM_BOT_TOKEN ? 'CONNECTED' : 'NOT_CONFIGURED',
            linkedin: process.env.LINKEDIN_ACCESS_TOKEN ? 'CONNECTED' : 'NOT_CONFIGURED',
            x: process.env.X_ACCESS_TOKEN ? 'CONNECTED' : 'NOT_CONFIGURED',
            threads: process.env.THREADS_ACCESS_TOKEN ? 'CONNECTED' : 'NOT_CONFIGURED',
          },
        }),
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        error: `API route not found: ${path}`,
        status_code: 404,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: errorMsg }),
    };
  }
};
