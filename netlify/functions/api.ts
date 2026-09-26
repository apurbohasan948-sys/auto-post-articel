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
import { testBloggerIntegrationHandler, createBloggerPostHandler } from '../../src/services/bloggerPostingService.ts';

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
      const { topicId, isManualApprovalRun, aiProviders, tavilyConfig, bloggerIntegrations } = body || {};
      if (Array.isArray(bloggerIntegrations)) {
        const activeBlogger = bloggerIntegrations.find((b: any) => b.enabled) || bloggerIntegrations[0];
        if (activeBlogger && activeBlogger.blogId) {
          storage.updateBloggerConfig({
            blogId: activeBlogger.blogId,
            blogUrl: activeBlogger.publicBlogUrl || activeBlogger.blogUrl || '',
            isConnected: activeBlogger.lastTestStatus === 'CONNECTED',
            publishingMode: activeBlogger.defaultStatus || 'DRAFT',
            accessToken: activeBlogger.accessToken,
            refreshToken: activeBlogger.refreshToken,
            clientId: activeBlogger.clientId,
            clientSecret: activeBlogger.clientSecret,
          });
        }
      }
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

    if (path.startsWith('/articles/') && path.endsWith('/publish') && method === 'POST') {
      const id = path.split('/')[2];
      const article = storage.getArticleById(id);
      if (!article) return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Article not found' }) };

      const { integration, isDraft, blogId } = body || {};
      if (integration || blogId) {
        const postRes = await createBloggerPostHandler({
          articleId: article.id,
          blogId: blogId || integration?.blogId,
          title: article.title,
          content: article.bloggerHtml || article.cleanContent,
          labels: article.focusKeywords && article.focusKeywords.length > 0 ? article.focusKeywords.slice(0, 5) : (integration?.defaultLabels || ['Technology', 'AI']),
          isDraft: typeof isDraft === 'boolean' ? isDraft : false,
          integration,
          accessToken: integration?.accessToken,
          refreshToken: integration?.refreshToken,
          clientId: integration?.clientId,
          clientSecret: integration?.clientSecret,
        });

        const status = postRes.success ? 200 : (postRes.status || 400);
        if (!postRes.success) {
          return { statusCode: status, headers, body: JSON.stringify(postRes) };
        }
        const updated = storage.getArticleById(id) || article;
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, article: updated, post: postRes }) };
      }

      try {
        const pub = await bloggerAgent.handlePublish(article, true, undefined, integration);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, article: pub }) };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: msg }) };
      }
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

    // --- Blogger OAuth Routes for Netlify ---
    if (path === '/blogger/oauth/url' && method === 'GET') {
      const q = event.queryStringParameters || {};
      const clientId = q.clientId?.trim() || process.env.BLOGGER_CLIENT_ID;
      const host = event.headers?.host || event.headers?.Host || 'localhost';
      const proto = event.headers?.['x-forwarded-proto'] || 'https';
      const redirectUri =
        q.redirectUri?.trim() ||
        process.env.BLOGGER_REDIRECT_URI ||
        `${proto}://${host}/api/blogger/oauth/callback`;

      if (!clientId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Google OAuth Client ID is missing. Please configure BLOGGER_CLIENT_ID or specify under Advanced Options.',
            instructions: 'Add BLOGGER_CLIENT_ID and BLOGGER_CLIENT_SECRET to environment variables or settings.',
          }),
        };
      }

      const scope = encodeURIComponent('https://www.googleapis.com/auth/blogger https://www.googleapis.com/auth/userinfo.email openid');
      const state = q.state ? encodeURIComponent(q.state) : '';
      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
        clientId
      )}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=code&scope=${scope}&access_type=offline&prompt=consent${state ? `&state=${state}` : ''}`;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, url: oauthUrl, redirectUri }),
      };
    }

    if ((path === '/blogger/oauth/callback' || path === '/blogger/oauth/callback/') && method === 'GET') {
      const q = event.queryStringParameters || {};
      const code = q.code;
      const error = q.error;
      const state = q.state;
      const htmlHeaders = {
        ...headers,
        'Content-Type': 'text/html; charset=utf-8',
      };

      if (error) {
        return {
          statusCode: 400,
          headers: htmlHeaders,
          body: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f172a;color:#f87171;padding:24px;text-align:center;"><h2>Google Authorization Denied</h2><p>${error}</p><script>if(window.opener){window.opener.postMessage({type:'BLOGGER_OAUTH_ERROR',error:${JSON.stringify(error)}},'*');setTimeout(()=>window.close(),1500);}</script></body></html>`,
        };
      }

      if (!code) {
        return {
          statusCode: 400,
          headers: htmlHeaders,
          body: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f172a;color:#f87171;padding:24px;text-align:center;"><h2>Authorization Code Missing</h2><script>if(window.opener){window.opener.postMessage({type:'BLOGGER_OAUTH_ERROR',error:'No authorization code received from Google'},'*');setTimeout(()=>window.close(),1500);}</script></body></html>`,
        };
      }

      let clientId = process.env.BLOGGER_CLIENT_ID;
      let clientSecret = process.env.BLOGGER_CLIENT_SECRET;
      const host = event.headers?.host || event.headers?.Host || 'localhost';
      const proto = event.headers?.['x-forwarded-proto'] || 'https';
      let redirectUri = process.env.BLOGGER_REDIRECT_URI || `${proto}://${host}/api/blogger/oauth/callback`;

      if (state) {
        try {
          const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
          if (decoded.clientId) clientId = decoded.clientId;
          if (decoded.clientSecret) clientSecret = decoded.clientSecret;
          if (decoded.redirectUri) redirectUri = decoded.redirectUri;
        } catch {
          // ignore
        }
      }

      if (!clientId || !clientSecret) {
        return {
          statusCode: 200,
          headers: htmlHeaders,
          body: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f172a;color:#38bdf8;padding:24px;text-align:center;"><h2>Authorization Code Received</h2><script>if(window.opener){window.opener.postMessage({type:'BLOGGER_OAUTH_CODE',payload:{code:${JSON.stringify(code)},redirectUri:${JSON.stringify(redirectUri)}}},'*');window.close();}</script></body></html>`,
        };
      }

      try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }).toString(),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || tokenData.error) {
          const errMsg = tokenData.error_description || tokenData.error || 'Token exchange failed';
          return {
            statusCode: 400,
            headers: htmlHeaders,
            body: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f172a;color:#f87171;padding:24px;text-align:center;"><h2>Google Token Exchange Failed</h2><p>${errMsg}</p><script>if(window.opener){window.opener.postMessage({type:'BLOGGER_OAUTH_ERROR',error:${JSON.stringify(errMsg)}},'*');setTimeout(()=>window.close(),2500);}</script></body></html>`,
          };
        }

        return {
          statusCode: 200,
          headers: htmlHeaders,
          body: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f172a;color:#4ade80;padding:24px;text-align:center;"><h2>Google Authorization Successful!</h2><script>if(window.opener){window.opener.postMessage({type:'BLOGGER_OAUTH_SUCCESS',payload:{accessToken:${JSON.stringify(tokenData.access_token)},refreshToken:${JSON.stringify(tokenData.refresh_token||'')},expiresIn:${JSON.stringify(tokenData.expires_in||3600)},scope:${JSON.stringify(tokenData.scope||'')}}},'*');window.close();}else{window.location.href='/';}</script></body></html>`,
        };
      } catch (exchangeErr: any) {
        const errText = exchangeErr?.message || 'Network error during Google OAuth exchange';
        return {
          statusCode: 500,
          headers: htmlHeaders,
          body: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f172a;color:#f87171;padding:24px;text-align:center;"><h2>OAuth Network Error</h2><p>${errText}</p><script>if(window.opener){window.opener.postMessage({type:'BLOGGER_OAUTH_ERROR',error:${JSON.stringify(errText)}},'*');setTimeout(()=>window.close(),2500);}</script></body></html>`,
        };
      }
    }

    if (path === '/blogger/oauth/exchange' && method === 'POST') {
      const { code, redirectUri, clientId: customClientId, clientSecret: customClientSecret } = body || {};
      if (!code) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Authorization code is required' }) };
      }

      const clientId = customClientId?.trim() || process.env.BLOGGER_CLIENT_ID;
      const clientSecret = customClientSecret?.trim() || process.env.BLOGGER_CLIENT_SECRET;
      const host = event.headers?.host || event.headers?.Host || 'localhost';
      const proto = event.headers?.['x-forwarded-proto'] || 'https';
      const targetRedirectUri =
        redirectUri?.trim() ||
        process.env.BLOGGER_REDIRECT_URI ||
        `${proto}://${host}/api/blogger/oauth/callback`;

      if (!clientId || !clientSecret) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'BLOGGER_CLIENT_ID and BLOGGER_CLIENT_SECRET are required for token exchange.',
          }),
        };
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: targetRedirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || tokenData.error) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: tokenData.error_description || tokenData.error || 'Failed to exchange authorization code with Google',
            details: tokenData,
          }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
          scope: tokenData.scope,
        }),
      };
    }

    if ((path === '/blogger/test' || path === '/integrations/blogger/test') && method === 'POST') {
      const payload = body?.integration || body || {};
      if (!payload || (!payload.blogId && !payload.accessToken)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            stage: 'invalid_configuration',
            status: 400,
            error: 'Missing Blogger integration payload or Blog ID',
            message: 'Missing Blogger integration payload or Blog ID',
          }),
        };
      }
      const testRes = await testBloggerIntegrationHandler(payload);
      const code = testRes.success ? 200 : (testRes.status || 400);
      return { statusCode: code, headers, body: JSON.stringify(testRes) };
    }

    if (path === '/blogger/posts' && method === 'POST') {
      const postRes = await createBloggerPostHandler(body || {});
      const code = postRes.success ? 200 : (postRes.status || 400);
      return { statusCode: code, headers, body: JSON.stringify(postRes) };
    }

    if (path === '/integrations/blogger/verify' && method === 'POST') {
      const payload = body?.integration || body || {};
      const { blogId: rawBlogId, publicBlogUrl: rawUrl, accessToken: rawToken, refreshToken: rawRefresh, clientId: customClientId, clientSecret: customClientSecret } = payload;
      let accessToken = rawToken?.trim();
      const clientId = customClientId?.trim() || process.env.BLOGGER_CLIENT_ID;
      const clientSecret = customClientSecret?.trim() || process.env.BLOGGER_CLIENT_SECRET;
      const refreshToken = rawRefresh?.trim();

      if (!accessToken && refreshToken && clientId && clientSecret) {
        try {
          const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: refreshToken,
              grant_type: 'refresh_token',
            }).toString(),
          });
          if (refreshRes.ok) {
            const refreshJson = await refreshRes.json();
            accessToken = refreshJson.access_token;
          }
        } catch {}
      }

      const cleanBlogId = (rawBlogId || '').trim();
      const noSpacesUrl = (rawUrl || '').trim().replace(/\s+/g, '');
      let normalizedUrl = noSpacesUrl;
      if (normalizedUrl && !/^https?:\/\//i.test(normalizedUrl)) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      let targetHostname = '';
      if (normalizedUrl) {
        try {
          targetHostname = new URL(normalizedUrl).hostname.toLowerCase();
        } catch {
          targetHostname = normalizedUrl.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
        }
      }

      if (!accessToken) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: false,
            status: 'FAILED',
            error: 'OAuth Access Token is missing from this session.',
            diagnostics: {
              oauthAccount: null,
              requestedBlogId: cleanBlogId,
              requestedBlogUrl: normalizedUrl,
              getBlogIdStatus: 0,
              getByUrlStatus: 0,
              listByUserStatus: 0,
              listByUserCount: 0,
              returnedBlogIds: [],
              returnedBlogUrls: [],
              explanation: 'OAuth Access Token is missing from this session.',
            },
          }),
        };
      }

      let oauthAccount: string | null = null;
      try {
        const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
        if (tokenInfoRes.ok) {
          const tokenInfo = await tokenInfoRes.json();
          oauthAccount = tokenInfo.email || tokenInfo.sub || null;
        }
      } catch {}

      try {
        const userRes = await fetch('https://www.googleapis.com/blogger/v3/users/self', {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          if (!oauthAccount && userData.displayName) oauthAccount = userData.displayName;
          else if (oauthAccount && userData.displayName && !oauthAccount.includes(userData.displayName)) {
            oauthAccount = `${oauthAccount} (${userData.displayName})`;
          }
        }
      } catch {}

      let getBlogIdStatus = 0;
      let getBlogData: any = null;
      if (cleanBlogId) {
        try {
          const res1 = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(cleanBlogId)}`, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
          });
          getBlogIdStatus = res1.status;
          if (res1.ok) getBlogData = await res1.json();
        } catch {
          getBlogIdStatus = 500;
        }
      }

      let getByUrlStatus = 0;
      let getByUrlData: any = null;
      if (normalizedUrl) {
        try {
          let res2 = await fetch(`https://www.googleapis.com/blogger/v3/blogs/byurl?url=${encodeURIComponent(normalizedUrl)}`, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
          });
          getByUrlStatus = res2.status;
          if (res2.ok) {
            getByUrlData = await res2.json();
          } else if (!normalizedUrl.endsWith('/')) {
            const retryRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/byurl?url=${encodeURIComponent(normalizedUrl + '/')}`, {
              headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
            });
            if (retryRes.ok) {
              getByUrlStatus = retryRes.status;
              getByUrlData = await retryRes.json();
            }
          }
        } catch {
          getByUrlStatus = 500;
        }
      }

      let listByUserStatus = 0;
      let listByUserItems: any[] = [];
      try {
        const res3 = await fetch('https://www.googleapis.com/blogger/v3/users/self/blogs', {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        });
        listByUserStatus = res3.status;
        if (res3.ok) {
          const data3 = await res3.json();
          listByUserItems = Array.isArray(data3.items) ? data3.items : [];
        }
      } catch {
        listByUserStatus = 500;
      }

      const listByUserCount = listByUserItems.length;
      const returnedBlogIds = listByUserItems.map((b: any) => String(b.id || '').trim());
      const returnedBlogUrls = listByUserItems.map((b: any) => String(b.url || '').trim());

      let matchedBlog: any = null;
      if (cleanBlogId) {
        matchedBlog = listByUserItems.find((b: any) => String(b.id || '').trim() === cleanBlogId);
      }
      if (!matchedBlog && getByUrlData?.id) {
        matchedBlog = listByUserItems.find((b: any) => String(b.id || '').trim() === String(getByUrlData.id).trim());
      }
      if (!matchedBlog && targetHostname) {
        matchedBlog = listByUserItems.find((b: any) => {
          try {
            return new URL(b.url).hostname.toLowerCase() === targetHostname;
          } catch {
            return false;
          }
        });
      }
      if (!matchedBlog && getByUrlData?.id && getBlogIdStatus !== 200) {
        try {
          const getByUrlIdRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(String(getByUrlData.id).trim())}`, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
          });
          if (getByUrlIdRes.ok) matchedBlog = await getByUrlIdRes.json();
        } catch {}
      }
      if (!matchedBlog && getBlogIdStatus === 200 && getBlogData?.id) {
        matchedBlog = getBlogData;
      }

      if (matchedBlog) {
        const verifiedBlogId = String(matchedBlog.id).trim();
        const verifiedBlogUrl = String(matchedBlog.url || normalizedUrl).trim();
        const verifiedBlogName = String(matchedBlog.name || 'Blogger Blog').trim();
        const postsCount = matchedBlog.posts?.totalItems ?? 0;

        let explanation = '';
        if (cleanBlogId && cleanBlogId !== verifiedBlogId) {
          explanation = `Requested Blog ID "${cleanBlogId}" returned HTTP ${getBlogIdStatus}, but blog was resolved by URL / Google account to Blog ID "${verifiedBlogId}" ("${verifiedBlogName}"). Automatically using verified Blog ID.`;
        } else if (getBlogIdStatus === 404 && verifiedBlogId === cleanBlogId) {
          explanation = `Direct get(${cleanBlogId}) returned HTTP 404, but blog was verified in your Google account blogs list.`;
        } else {
          explanation = `Verified access to "${verifiedBlogName}" (${postsCount} posts).`;
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            status: 'CONNECTED',
            blogId: verifiedBlogId,
            blogName: verifiedBlogName,
            blogUrl: verifiedBlogUrl,
            postsCount,
            diagnostics: {
              oauthAccount,
              requestedBlogId: cleanBlogId,
              requestedBlogUrl: normalizedUrl,
              getBlogIdStatus,
              getByUrlStatus,
              listByUserStatus,
              listByUserCount,
              returnedBlogIds,
              returnedBlogUrls,
              explanation,
            },
            message: explanation,
          }),
        };
      }

      const accountPrefix = oauthAccount ? `The Google account (${oauthAccount})` : 'The Google account';
      const errorMessage = `${accountPrefix} used for OAuth does not have access to this Blogger blog.`;
      const explanation = `Verification failed: get(${cleanBlogId || 'N/A'}) returned HTTP ${getBlogIdStatus}, getByUrl returned HTTP ${getByUrlStatus}, and blogs.listByUser returned ${listByUserCount} blog(s). None matched the requested blog.`;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          status: 'FAILED',
          error: errorMessage,
          message: errorMessage,
          diagnostics: {
            oauthAccount,
            requestedBlogId: cleanBlogId,
            requestedBlogUrl: normalizedUrl,
            getBlogIdStatus,
            getByUrlStatus,
            listByUserStatus,
            listByUserCount,
            returnedBlogIds,
            returnedBlogUrls,
            explanation,
          },
        }),
      };
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
