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
      const job = await orchestrator.runCycle(body);
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
    if (path === '/providers/ai' && method === 'GET') {
      const providers = storage.getAIProviders().map((p) => ({
        ...p,
        apiKey: maskApiKey(p.apiKey),
        hasKey: Boolean(p.apiKey),
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ providers }) };
    }

    if (path === '/providers/ai/save' && method === 'POST') {
      const provider = body.provider;
      if (!provider || !provider.name) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid provider payload' }) };
      }
      const existing = storage.getAIProviders().find((p) => p.id === provider.id);
      let finalKey = provider.apiKey;
      if (finalKey && !finalKey.includes('••••')) {
        finalKey = encryptSecret(finalKey);
      } else {
        finalKey = existing?.apiKey || '';
      }
      const saved = storage.saveAIProvider({ ...provider, apiKey: finalKey, hasKey: Boolean(finalKey) });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          provider: { ...saved, apiKey: maskApiKey(saved.apiKey), hasKey: Boolean(saved.apiKey) },
        }),
      };
    }

    if (path.startsWith('/providers/ai/') && method === 'DELETE') {
      const id = path.split('/')[3];
      const success = storage.deleteAIProvider(id);
      return { statusCode: 200, headers, body: JSON.stringify({ success }) };
    }

    if (path === '/providers/ai/reorder' && method === 'POST') {
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
        target = storage.getAIProviders().find((p) => p.id === body.providerId);
      }
      if (!target) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            status: 'FAILED',
            status_code: 404,
            error: 'Provider not found',
            latency_ms: 0,
            latencyMs: 0,
            timestamp: new Date().toISOString(),
          }),
        };
      }
      if (target.apiKey && target.apiKey.includes('••••')) {
        const stored = storage.getAIProviders().find((p) => p.id === target.id);
        if (stored) target.apiKey = stored.apiKey;
      }
      const testResult = await testingService.testAIProvider(target, body.prompt || 'Write one short sentence about technology.');
      const httpStatus = typeof testResult.status === 'number' ? testResult.status : testResult.success ? 200 : 400;
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

    if (path === '/providers/search' && method === 'GET') {
      const providers = storage.getSearchProviders().map((p) => ({
        ...p,
        apiKey: maskApiKey(p.apiKey),
        hasKey: Boolean(p.apiKey),
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ providers }) };
    }

    if (path === '/providers/search/save' && method === 'POST') {
      const provider = body.provider;
      if (!provider || !provider.name) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid search provider payload' }) };
      }
      const existing = storage.getSearchProviders().find((p) => p.id === provider.id);
      let finalKey = provider.apiKey;
      if (finalKey && !finalKey.includes('••••')) {
        finalKey = encryptSecret(finalKey);
      } else {
        finalKey = existing?.apiKey || '';
      }
      const saved = storage.saveSearchProvider({ ...provider, apiKey: finalKey, hasKey: Boolean(finalKey) });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          provider: { ...saved, apiKey: maskApiKey(saved.apiKey), hasKey: Boolean(saved.apiKey) },
        }),
      };
    }

    if (path.startsWith('/providers/search/') && method === 'DELETE') {
      const id = path.split('/')[3];
      const success = storage.deleteSearchProvider(id);
      return { statusCode: 200, headers, body: JSON.stringify({ success }) };
    }

    if (path === '/providers/search/reorder' && method === 'POST') {
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
      if (body.providerId) {
        target = storage.getSearchProviders().find((p) => p.id === body.providerId);
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
        if (stored) target.apiKey = stored.apiKey;
      }
      const result = await testingService.testSearchProvider(target, body.query || 'ai agent verification ping', body.depth || 'basic', body.maxResults || 3);
      const httpStatus = typeof result.status === 'number' ? result.status : result.success ? 200 : 400;
      return { statusCode: httpStatus, headers, body: JSON.stringify(result) };
    }

    if (path === '/providers/search/playground' && method === 'POST') {
      let target = body.provider;
      if (body.providerId) {
        target = storage.getSearchProviders().find((p) => p.id === body.providerId);
      }
      if (!target) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Search provider not found' }) };
      if (target.apiKey && target.apiKey.includes('••••')) {
        const stored = storage.getSearchProviders().find((p) => p.id === target.id);
        if (stored) target.apiKey = stored.apiKey;
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
