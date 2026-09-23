/**
 * Axiom Autonomous AI Content Agent - Server Entry Point
 * Implements Express REST API with full agent control, Blogger integration,
 * health checks, Vite development middleware, and production static fallback.
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { AnalyticsMonitorAgent } from './src/agents/AnalyticsMonitorAgent.ts';
import { BloggerPublisherAgent } from './src/agents/BloggerPublisherAgent.ts';
import { Orchestrator } from './src/agents/Orchestrator.ts';
import { TopicScoutAgent } from './src/agents/TopicScoutAgent.ts';
import { decryptSecret, encryptSecret, maskApiKey } from './src/services/encryption.ts';
import { ProviderTestingService } from './src/services/providerTestingService.ts';
import { StorageService } from './src/services/storage.ts';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

const storage = StorageService.getInstance();
const orchestrator = Orchestrator.getInstance();
const analytics = new AnalyticsMonitorAgent();
const scout = new TopicScoutAgent();
const bloggerAgent = new BloggerPublisherAgent();
const testingService = ProviderTestingService.getInstance();

// --- 1. Agent Lifecycle & Controls ---

// Trigger Run Now
app.post('/api/agent/run', async (req: Request, res: Response) => {
  try {
    const { topicId, isManualApprovalRun, aiProviders, tavilyConfig } = req.body || {};
    if (Array.isArray(aiProviders) && aiProviders.length > 0) {
      storage.updateAIProviders(aiProviders);
    }
    if (tavilyConfig && tavilyConfig.apiKey) {
      const tavily = storage.getSearchProviders().find((p) => p.type === 'tavily') || {
        id: 'search_tavily',
        name: 'Tavily AI Search',
        type: 'tavily',
        baseUrl: tavilyConfig.baseUrl || 'https://api.tavily.com',
        priority: 1,
      };
      storage.saveSearchProvider({
        ...tavily,
        apiKey: tavilyConfig.apiKey,
        enabled: tavilyConfig.enabled ?? true,
        baseUrl: tavilyConfig.baseUrl || 'https://api.tavily.com',
      });
    }
    const { bloggerIntegrations } = req.body || {};
    if (Array.isArray(bloggerIntegrations)) {
      const activeBlogger = bloggerIntegrations.find((b: any) => b.enabled);
      if (activeBlogger && activeBlogger.blogId) {
        storage.updateBloggerConfig({
          blogId: activeBlogger.blogId,
          blogUrl: activeBlogger.blogUrl || '',
          isConnected: activeBlogger.lastTestStatus === 'CONNECTED',
          publishingMode: activeBlogger.defaultStatus || 'DRAFT',
        });
      }
    }

    // Run cycle asynchronously or await based on query
    const runPromise = orchestrator.runCycle({ specificTopicId: topicId, isManualApprovalRun });
    
    // In dev / preview, we wait up to 8 seconds or return job ID immediately if still running
    let finished = false;
    const timeoutPromise = new Promise<{ isAsync: boolean }>((resolve) =>
      setTimeout(() => resolve({ isAsync: true }), 4000)
    );

    const race = await Promise.race([runPromise.then((j) => ({ job: j, isAsync: false })), timeoutPromise]);

    if ('job' in race) {
      return res.json({ success: true, job: race.job });
    }

    // Job continues running in background
    const currentJobs = storage.getJobs();
    res.json({
      success: true,
      message: 'Autonomous pipeline initiated in background task.',
      job: currentJobs[0],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ success: false, error: msg });
  }
});

// Pause Agent
app.post('/api/agent/pause', (req: Request, res: Response) => {
  orchestrator.pauseAgent();
  res.json({ success: true, status: 'PAUSED' });
});

// Resume Agent
app.post('/api/agent/resume', (req: Request, res: Response) => {
  orchestrator.resumeAgent();
  res.json({ success: true, status: 'IDLE' });
});

// Emergency Stop
app.post('/api/agent/stop', (req: Request, res: Response) => {
  orchestrator.stopEmergency();
  res.json({ success: true, status: 'STOPPED' });
});

// Current Agent & Lock Status
app.get('/api/agent/status', (req: Request, res: Response) => {
  const settings = storage.getSettings();
  const jobs = storage.getJobs();
  const activeJob = jobs.find((j) => j.status === 'RUNNING');
  res.json({
    status: settings.status,
    mode: settings.mode,
    activeJob: activeJob || null,
    recentJobsCount: jobs.length,
    todayStats: settings.todayStats,
  });
});

// --- 2. Topics ---
app.get('/api/topics', (req: Request, res: Response) => {
  res.json({ topics: storage.getTopics() });
});

app.post('/api/topics/scout', async (req: Request, res: Response) => {
  try {
    const candidates = await scout.scoutCandidateTopics();
    res.json({ success: true, candidates });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

// --- 3. Research Packages ---
app.get('/api/research', (req: Request, res: Response) => {
  res.json({ research: storage.getAllResearchPackages() });
});

app.get('/api/research/:topicId', (req: Request, res: Response) => {
  const pkg = storage.getResearchPackage(req.params.topicId);
  if (!pkg) return res.status(404).json({ error: 'Research package not found' });
  res.json({ research: pkg });
});

// --- 4. Articles & Reviews ---
app.get('/api/articles', (req: Request, res: Response) => {
  res.json({ articles: storage.getArticles() });
});

app.get('/api/articles/:id', (req: Request, res: Response) => {
  const article = storage.getArticleById(req.params.id);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  res.json({ article });
});

// Approve article in manual approval mode
app.post('/api/articles/:id/approve', async (req: Request, res: Response) => {
  const article = storage.getArticleById(req.params.id);
  if (!article) return res.status(404).json({ error: 'Article not found' });

  try {
    const published = await bloggerAgent.handlePublish(article, true);
    res.json({ success: true, article: published });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ success: false, error: msg });
  }
});

// Trigger manual publish to Blogger
app.post('/api/articles/:id/publish', async (req: Request, res: Response) => {
  const article = storage.getArticleById(req.params.id);
  if (!article) return res.status(404).json({ error: 'Article not found' });

  try {
    const published = await bloggerAgent.handlePublish(article, true);
    res.json({ success: true, article: published });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ success: false, error: msg });
  }
});

// --- 5. Jobs & Telemetry ---
app.get('/api/jobs', (req: Request, res: Response) => {
  res.json({ jobs: storage.getJobs() });
});

app.get('/api/jobs/:id', (req: Request, res: Response) => {
  const job = storage.getJobById(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ job });
});

app.get('/api/logs', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 100;
  res.json({ logs: storage.getLogs(limit) });
});

// --- 6. Analytics & Memory ---
app.get('/api/analytics', (req: Request, res: Response) => {
  res.json({ analytics: analytics.getSummaryMetrics() });
});

app.get('/api/memory', (req: Request, res: Response) => {
  res.json({ memory: storage.getMemory() });
});

// --- 7. Settings & Providers ---
app.get('/api/settings', (req: Request, res: Response) => {
  res.json({ settings: storage.getSettings() });
});

app.put('/api/settings', (req: Request, res: Response) => {
  const updated = storage.updateSettings(req.body);
  res.json({ success: true, settings: updated });
});

// --- 7. API Control Center: AI & Search Providers ---

// Helper to mask provider lists for safe frontend delivery
function getMaskedAIProviders() {
  return storage.getAIProviders().map((p) => ({
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
}

function getMaskedSearchProviders() {
  return storage.getSearchProviders().map((p) => ({
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
}

// 7.1 AI Providers - Full RESTful API (GET, POST, PUT, DELETE, PATCH)
const handleGetAIProviders = (req: Request, res: Response) => {
  const providers = getMaskedAIProviders();
  res.json({ success: true, providers });
};

app.get('/api/providers', handleGetAIProviders);
app.get('/api/providers/ai', handleGetAIProviders);

const handleSaveAIProvider = (req: Request, res: Response) => {
  const provider = req.body?.provider || req.body;
  if (!provider || !provider.name || typeof provider.name !== 'string' || !provider.name.trim()) {
    return res.status(400).json({ success: false, error: 'Provider name is required and cannot be empty' });
  }

  const existingId = req.params?.id || provider.id;
  const existing = existingId ? storage.getAIProviders().find((p) => p.id === existingId) : undefined;
  let finalKey = provider.apiKey;

  // If user entered a new unmasked key, encrypt it
  if (finalKey && !finalKey.includes('••••')) {
    finalKey = encryptSecret(finalKey);
  } else {
    // Preserve existing encrypted/stored key
    finalKey = existing?.apiKey || '';
  }

  const saved = storage.saveAIProvider({
    ...provider,
    id: existingId || provider.id,
    modelName: provider.modelName || provider.model || provider.defaultModel || 'gpt-4o',
    baseUrl: provider.baseUrl || provider.base_url || '',
    apiKey: finalKey,
    hasKey: Boolean(finalKey),
  });

  const responseProvider = {
    ...saved,
    baseUrl: saved.baseUrl,
    base_url: saved.baseUrl,
    model: saved.modelName,
    modelName: saved.modelName,
    apiKey: maskApiKey(saved.apiKey),
    hasKey: Boolean(saved.apiKey),
  };

  res.status(200).json({
    success: true,
    provider: responseProvider,
  });
};

app.post('/api/providers', handleSaveAIProvider);
app.post('/api/providers/ai', handleSaveAIProvider);
app.post('/api/providers/ai/save', handleSaveAIProvider);

// Update existing AI provider by ID
app.put('/api/providers/:id', handleSaveAIProvider);
app.put('/api/providers/ai/:id', handleSaveAIProvider);

// Delete AI provider by ID
const handleDeleteAIProvider = (req: Request, res: Response) => {
  const id = req.params.id;
  const success = storage.deleteAIProvider(id);
  res.json({ success, deletedId: id });
};
app.delete('/api/providers/:id', handleDeleteAIProvider);
app.delete('/api/providers/ai/:id', handleDeleteAIProvider);

// Patch / Partial update AI provider by ID (e.g. toggle enabled, change priority, model)
const handlePatchAIProvider = (req: Request, res: Response) => {
  const id = req.params.id;
  const patch = req.body || {};
  const current = storage.getAIProviders().find((p) => p.id === id);
  if (!current) {
    return res.status(404).json({ success: false, error: `Provider ${id} not found` });
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

  res.json({
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
  });
};
app.patch('/api/providers/:id', handlePatchAIProvider);
app.patch('/api/providers/ai/:id', handlePatchAIProvider);

const handleReorderAI = (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  storage.reorderAIProviders(ids);
  res.json({ success: true, providers: getMaskedAIProviders() });
};
app.post('/api/providers/reorder', handleReorderAI);
app.post('/api/providers/ai/reorder', handleReorderAI);

app.post('/api/providers/ai/toggle', (req: Request, res: Response) => {
  const { id, enabled } = req.body;
  const updated = storage.toggleAIProvider(id, Boolean(enabled));
  res.json({ success: Boolean(updated), provider: updated });
});

// Alias for Section 1, 6 & 8: /api/providers/test and /api/providers/ai/test
const handleAIProviderTest = async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { providerId, provider, prompt } = req.body || {};
    let targetProvider = provider;

    if (providerId) {
      const stored = storage.getAIProviders().find((p) => p.id === providerId);
      if (stored) {
        targetProvider = { ...stored, ...(provider || {}) };
        // Prioritize client's authoritative key from providerStore if unmasked
        if (provider?.apiKey && !provider.apiKey.includes('••••')) {
          targetProvider.apiKey = provider.apiKey.trim();
        } else if (targetProvider.apiKey && targetProvider.apiKey.includes('••••') && stored.apiKey) {
          targetProvider.apiKey = stored.apiKey;
        }
      }
    }

    if (!targetProvider) {
      const errorObj = {
        type: 'provider_not_found',
        message: 'Provider not found',
        providerStatus: 404,
        url: '',
      };
      return res.status(404).json({
        ok: false,
        success: false,
        status: 'FAILED',
        status_code: 404,
        error: errorObj,
        errorDetails: errorObj,
        latency_ms: 0,
        latencyMs: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // If key is masked in incoming payload, resolve from storage
    if (targetProvider.apiKey && targetProvider.apiKey.includes('••••')) {
      const stored = storage.getAIProviders().find((p) => p.id === targetProvider.id);
      if (stored && stored.apiKey && !stored.apiKey.includes('••••')) {
        targetProvider.apiKey = stored.apiKey;
      }
    }

    const testResult = await testingService.testAIProvider(targetProvider, prompt || 'Reply with OK');
    const httpStatus =
      typeof testResult.status_code === 'number'
        ? testResult.status_code
        : typeof testResult.status === 'number'
        ? testResult.status
        : testResult.success
        ? 200
        : 400;
    res.status(httpStatus).json(testResult);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const errorObj = {
      type: 'internal_error',
      message: msg,
      providerStatus: 500,
      url: '',
    };
    res.status(500).json({
      ok: false,
      success: false,
      status: 'FAILED',
      status_code: 500,
      error: errorObj,
      errorDetails: errorObj,
      latency_ms: 0,
      latencyMs: 0,
      timestamp: new Date().toISOString(),
    });
  }
};

app.post('/api/providers/test', handleAIProviderTest);
app.post('/api/providers/ai/test', handleAIProviderTest);

app.post('/api/providers/ai/playground', async (req: Request, res: Response) => {
  try {
    const { providerId, provider, prompt } = req.body;
    let targetProvider = provider;

    if (providerId) {
      targetProvider = storage.getAIProviders().find((p) => p.id === providerId);
    }

    if (!targetProvider) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }

    if (targetProvider.apiKey && targetProvider.apiKey.includes('••••')) {
      const stored = storage.getAIProviders().find((p) => p.id === targetProvider.id);
      if (stored) targetProvider.apiKey = stored.apiKey;
    }

    const result = await testingService.testAIProvider(
      targetProvider,
      prompt || 'Write one short sentence about technology.'
    );
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

app.get('/api/providers/ai/:id/usage', async (req: Request, res: Response) => {
  const p = storage.getAIProviders().find((item) => item.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Provider not found' });

  if (p.type === 'openrouter' && p.apiKey) {
    const raw = decryptSecret(p.apiKey);
    const usage = await testingService.fetchOpenRouterUsage(raw);
    return res.json({ success: true, usageInfo: usage });
  }

  res.json({
    success: true,
    usageInfo: p.usageInfo || { hasUsageData: false, message: 'Usage information unavailable' },
  });
});

// Legacy PUT support for backward compatibility
app.put('/api/providers/ai', (req: Request, res: Response) => {
  const incoming = req.body.providers;
  if (!Array.isArray(incoming)) return res.status(400).json({ error: 'Invalid providers array' });
  const current = storage.getAIProviders();

  const updated = incoming.map((inc) => {
    const existing = current.find((c) => c.id === inc.id);
    let key = inc.apiKey;
    if (key && key.includes('••••')) {
      key = existing?.apiKey || '';
    } else if (key && !key.startsWith('enc:v1:')) {
      key = encryptSecret(key);
    }
    return { ...inc, apiKey: key };
  });

  storage.updateAIProviders(updated);
  res.json({ success: true });
});

// 7.2 Search / Research Providers - Full RESTful API
const handleGetSearchProviders = (req: Request, res: Response) => {
  res.json({ success: true, providers: getMaskedSearchProviders() });
};
app.get('/api/search-providers', handleGetSearchProviders);
app.get('/api/providers/search', handleGetSearchProviders);

const handleSaveSearchProvider = (req: Request, res: Response) => {
  const provider = req.body?.provider || req.body;
  if (!provider || !provider.name || typeof provider.name !== 'string' || !provider.name.trim()) {
    return res.status(400).json({ success: false, error: 'Search provider name is required and cannot be empty' });
  }

  const existingId = req.params?.id || provider.id;
  const existing = existingId ? storage.getSearchProviders().find((p) => p.id === existingId) : undefined;
  let finalKey = provider.apiKey;

  if (finalKey && !finalKey.includes('••••')) {
    finalKey = encryptSecret(finalKey);
  } else {
    finalKey = existing?.apiKey || '';
  }

  const saved = storage.saveSearchProvider({
    ...provider,
    id: existingId || provider.id,
    baseUrl: provider.baseUrl || provider.base_url || 'https://api.tavily.com',
    apiKey: finalKey,
    hasKey: Boolean(finalKey),
  });

  const responseProvider = {
    ...saved,
    baseUrl: saved.baseUrl,
    base_url: saved.baseUrl,
    apiKey: maskApiKey(saved.apiKey),
    hasKey: Boolean(saved.apiKey),
  };

  res.status(200).json({
    success: true,
    provider: responseProvider,
  });
};

app.post('/api/search-providers', handleSaveSearchProvider);
app.post('/api/providers/search', handleSaveSearchProvider);
app.post('/api/providers/search/save', handleSaveSearchProvider);

// Update search provider by ID
app.put('/api/search-providers/:id', handleSaveSearchProvider);
app.put('/api/providers/search/:id', handleSaveSearchProvider);

// Delete search provider by ID
const handleDeleteSearchProvider = (req: Request, res: Response) => {
  const id = req.params.id;
  const success = storage.deleteSearchProvider(id);
  res.json({ success, deletedId: id });
};
app.delete('/api/search-providers/:id', handleDeleteSearchProvider);
app.delete('/api/providers/search/:id', handleDeleteSearchProvider);

// Patch search provider by ID (e.g. toggle enabled, change priority)
const handlePatchSearchProvider = (req: Request, res: Response) => {
  const id = req.params.id;
  const patch = req.body || {};
  const current = storage.getSearchProviders().find((p) => p.id === id);
  if (!current) {
    return res.status(404).json({ success: false, error: `Search provider ${id} not found` });
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

  res.json({
    success: true,
    provider: {
      ...updated,
      baseUrl: updated.baseUrl,
      base_url: updated.baseUrl,
      apiKey: maskApiKey(updated.apiKey),
      hasKey: Boolean(updated.apiKey),
    },
  });
};
app.patch('/api/search-providers/:id', handlePatchSearchProvider);
app.patch('/api/providers/search/:id', handlePatchSearchProvider);

const handleReorderSearch = (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  storage.reorderSearchProviders(ids);
  res.json({ success: true, providers: getMaskedSearchProviders() });
};
app.post('/api/search-providers/reorder', handleReorderSearch);
app.post('/api/providers/search/reorder', handleReorderSearch);

app.post('/api/providers/search/toggle', (req: Request, res: Response) => {
  const { id, enabled } = req.body;
  const updated = storage.toggleSearchProvider(id, Boolean(enabled));
  res.json({ success: Boolean(updated), provider: updated });
});

const handleSearchProviderTest = async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { providerId, provider, query } = req.body || {};
    let targetProvider = provider;

    if (providerId) {
      targetProvider = storage.getSearchProviders().find((p) => p.id === providerId);
    }

    if (!targetProvider) {
      return res.status(404).json({
        success: false,
        status: 'FAILED',
        status_code: 404,
        error: 'Search provider not found',
        latency_ms: 0,
        latencyMs: 0,
        timestamp: new Date().toISOString(),
      });
    }

    if (targetProvider.apiKey && targetProvider.apiKey.includes('••••')) {
      const stored = storage.getSearchProviders().find((p) => p.id === targetProvider.id);
      if (stored) targetProvider.apiKey = stored.apiKey;
    }

    const testResult = await testingService.testSearchProvider(
      targetProvider,
      query || 'ai agent verification ping',
      'basic',
      3
    );
    res.json(testResult);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      success: false,
      status: 'FAILED',
      status_code: 500,
      error: msg,
      latency_ms: 0,
      latencyMs: 0,
      timestamp: new Date().toISOString(),
    });
  }
};

app.post('/api/search/test', handleSearchProviderTest);
app.post('/api/providers/search/test', handleSearchProviderTest);

app.post('/api/providers/search/playground', async (req: Request, res: Response) => {
  try {
    const { providerId, provider, query, depth, maxResults } = req.body;
    let targetProvider = provider;

    if (providerId) {
      targetProvider = storage.getSearchProviders().find((p) => p.id === providerId);
    }

    if (!targetProvider) {
      return res.status(404).json({ success: false, error: 'Search provider not found' });
    }

    if (targetProvider.apiKey && targetProvider.apiKey.includes('••••')) {
      const stored = storage.getSearchProviders().find((p) => p.id === targetProvider.id);
      if (stored) targetProvider.apiKey = stored.apiKey;
    }

    const result = await testingService.testSearchProvider(
      targetProvider,
      query || 'latest artificial intelligence trends',
      depth || 'basic',
      maxResults || 5
    );
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

// Legacy search PUT support
app.put('/api/providers/search', (req: Request, res: Response) => {
  const incoming = req.body.providers;
  if (!Array.isArray(incoming)) return res.status(400).json({ error: 'Invalid providers array' });
  const current = storage.getSearchProviders();

  const updated = incoming.map((inc) => {
    const existing = current.find((c) => c.id === inc.id);
    let key = inc.apiKey;
    if (key && key.includes('••••')) {
      key = existing?.apiKey || '';
    } else if (key && !key.startsWith('enc:v1:')) {
      key = encryptSecret(key);
    }
    return { ...inc, apiKey: key };
  });

  storage.updateSearchProviders(updated);
  res.json({ success: true });
});

// 7.3 Test History & Global Health
app.get('/api/providers/test-history', (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 25;
  res.json({ history: storage.getTestHistory(limit) });
});

app.get('/api/providers/health', (req: Request, res: Response) => {
  const aiList = storage.getAIProviders();
  const searchList = storage.getSearchProviders();
  const bloggerCfg = storage.getBloggerConfig();

  const primaryAI = aiList.filter((p) => p.enabled).sort((a, b) => a.priority - b.priority)[0];
  const primarySearch = searchList.filter((p) => p.enabled).sort((a, b) => a.priority - b.priority)[0];

  res.json({
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
  });
});

// 7.4 Import & Export Configuration
app.get('/api/providers/export', (req: Request, res: Response) => {
  const includeSecrets = req.query.includeSecrets === 'true';
  const exported = storage.exportConfiguration(includeSecrets);
  res.json(exported);
});

app.post('/api/providers/import', (req: Request, res: Response) => {
  const { config } = req.body;
  if (!config) return res.status(400).json({ error: 'Missing configuration payload' });
  const result = storage.importConfiguration(config);
  res.json(result);
});

// --- 8. Blogger & Social Settings ---
app.get('/api/blogger', (req: Request, res: Response) => {
  const cfg = storage.getBloggerConfig();
  res.json({
    config: {
      ...cfg,
      hasCredentials: Boolean(process.env.BLOGGER_REFRESH_TOKEN || process.env.BLOGGER_CLIENT_ID),
    },
  });
});

app.put('/api/blogger', (req: Request, res: Response) => {
  const updated = storage.updateBloggerConfig(req.body);
  res.json({ success: true, config: updated });
});

// Blogger OAuth Authorization Initiation
app.get('/api/blogger/oauth/url', (req: Request, res: Response) => {
  const clientId = process.env.BLOGGER_CLIENT_ID;
  const redirectUri = process.env.BLOGGER_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/blogger/oauth/callback`;
  if (!clientId) {
    return res.status(400).json({
      error: 'BLOGGER_CLIENT_ID not configured in environment variables.',
      instructions: 'Add BLOGGER_CLIENT_ID and BLOGGER_CLIENT_SECRET to .env or Netlify settings.',
    });
  }

  const scope = encodeURIComponent('https://www.googleapis.com/auth/blogger');
  const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

  res.json({ url: oauthUrl });
});

// --- 8.1 Blogger & Social Integrations Test & Dispatch ---
app.post('/api/integrations/blogger/test', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  const startTime = Date.now();
  try {
    const { integration } = req.body || {};
    if (!integration) {
      return res.status(400).json({ success: false, status: 'FAILED', error: 'Missing integration payload' });
    }

    const blogId = integration.blogId?.trim();
    if (!blogId) {
      return res.status(400).json({
        success: false,
        status: 'FAILED',
        error: 'Blog ID is required.',
        latencyMs: Date.now() - startTime,
      });
    }

    let accessToken = integration.accessToken?.trim();
    const clientId = integration.clientId?.trim() || process.env.BLOGGER_CLIENT_ID;
    const clientSecret = integration.clientSecret?.trim() || process.env.BLOGGER_CLIENT_SECRET;
    const refreshToken = integration.refreshToken?.trim() || process.env.BLOGGER_REFRESH_TOKEN;

    // If refresh token exists and no fresh access token, attempt exchange
    if (!accessToken && refreshToken && clientId && clientSecret) {
      try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
          }).toString(),
        });
        if (tokenRes.ok) {
          const tokenJson = await tokenRes.json();
          accessToken = tokenJson.access_token;
        } else {
          const errText = await tokenRes.text();
          return res.status(400).json({
            success: false,
            status: 'FAILED',
            latencyMs: Date.now() - startTime,
            error: `OAuth token refresh failed: ${errText}`,
          });
        }
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          status: 'FAILED',
          latencyMs: Date.now() - startTime,
          error: `Network error exchanging refresh token: ${err?.message}`,
        });
      }
    }

    // Now query Blogger API v3
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const bloggerEndpoint = `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(blogId)}`;
    const googleRes = await fetch(bloggerEndpoint, { headers });
    const latencyMs = Date.now() - startTime;

    if (!googleRes.ok) {
      const errBody = await googleRes.json().catch(() => ({ error: { message: `HTTP ${googleRes.status}` } }));
      const errorMsg = errBody?.error?.message || `Google Blogger API error: HTTP ${googleRes.status}`;
      return res.status(200).json({
        success: false,
        status: 'FAILED',
        latencyMs,
        error: errorMsg,
        details: errBody,
      });
    }

    const blogData = await googleRes.json();
    return res.json({
      success: true,
      status: 'CONNECTED',
      latencyMs,
      message: `Connected to blog "${blogData.name || blogId}"`,
      blogName: blogData.name,
      blogUrl: blogData.url,
      postsCount: blogData.posts?.totalItems,
      details: {
        id: blogData.id,
        name: blogData.name,
        url: blogData.url,
        published: blogData.published,
      },
    });
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      status: 'FAILED',
      latencyMs: Date.now() - startTime,
      error: err?.message || 'Server error testing Blogger connection',
    });
  }
});

app.post('/api/integrations/social/test', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  const startTime = Date.now();
  try {
    const { platform, credentials } = req.body || {};
    if (!platform || !credentials) {
      return res.status(400).json({ success: false, status: 'FAILED', error: 'platform and credentials required' });
    }

    if (platform === 'facebook') {
      const pageId = credentials.pageId?.trim();
      const accessToken = credentials.accessToken?.trim();
      if (!pageId || !accessToken) {
        return res.json({
          success: false,
          status: 'FAILED',
          latencyMs: Date.now() - startTime,
          error: 'Facebook Page ID and Access Token are required.',
        });
      }

      const fbUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}?fields=id,name,category,link&access_token=${encodeURIComponent(accessToken)}`;
      const fbRes = await fetch(fbUrl);
      const latencyMs = Date.now() - startTime;
      const fbData = await fbRes.json().catch(() => null);

      if (!fbRes.ok || fbData?.error) {
        return res.json({
          success: false,
          status: 'FAILED',
          latencyMs,
          error: fbData?.error?.message || `Meta Graph API error: HTTP ${fbRes.status}`,
          details: fbData?.error,
        });
      }

      return res.json({
        success: true,
        status: 'CONNECTED',
        latencyMs,
        message: `Connected to Facebook Page: "${fbData.name}"`,
        pageName: fbData.name,
        details: fbData,
      });
    }

    if (platform === 'instagram') {
      const accountId = credentials.instagramAccountId?.trim();
      const accessToken = credentials.accessToken?.trim();
      if (!accountId || !accessToken) {
        return res.json({
          success: false,
          status: 'FAILED',
          latencyMs: Date.now() - startTime,
          error: 'Instagram Business Account ID and Access Token are required.',
        });
      }

      const igUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(accountId)}?fields=id,username,name&access_token=${encodeURIComponent(accessToken)}`;
      const igRes = await fetch(igUrl);
      const latencyMs = Date.now() - startTime;
      const igData = await igRes.json().catch(() => null);

      if (!igRes.ok || igData?.error) {
        return res.json({
          success: false,
          status: 'FAILED',
          latencyMs,
          error: igData?.error?.message || `Instagram Graph API error: HTTP ${igRes.status}`,
          details: igData?.error,
        });
      }

      return res.json({
        success: true,
        status: 'CONNECTED',
        latencyMs,
        message: `Connected to Instagram @${igData.username || igData.id}`,
        username: igData.username,
        details: igData,
      });
    }

    if (platform === 'youtube') {
      const channelId = credentials.channelId?.trim();
      const apiKey = credentials.apiKey?.trim();
      const accessToken = credentials.accessToken?.trim();

      if (!channelId && !accessToken && !apiKey) {
        return res.json({
          success: false,
          status: 'FAILED',
          latencyMs: Date.now() - startTime,
          error: 'YouTube Channel ID and API Key or Access Token are required.',
        });
      }

      let ytUrl = '';
      const headers: Record<string, string> = {};
      if (accessToken) {
        ytUrl = 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true';
        headers['Authorization'] = `Bearer ${accessToken}`;
      } else if (apiKey && channelId) {
        ytUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(apiKey)}`;
      } else {
        ytUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${encodeURIComponent(channelId || '')}`;
      }

      const ytRes = await fetch(ytUrl, { headers });
      const latencyMs = Date.now() - startTime;
      const ytData = await ytRes.json().catch(() => null);

      if (!ytRes.ok || ytData?.error) {
        return res.json({
          success: false,
          status: 'FAILED',
          latencyMs,
          error: ytData?.error?.message || `YouTube API error: HTTP ${ytRes.status}`,
          details: ytData?.error,
        });
      }

      const item = ytData.items?.[0];
      if (!item) {
        return res.json({
          success: false,
          status: 'FAILED',
          latencyMs,
          error: 'Channel not found with specified credentials.',
        });
      }

      return res.json({
        success: true,
        status: 'CONNECTED',
        latencyMs,
        message: `Connected to YouTube Channel: "${item.snippet?.title}"`,
        channelTitle: item.snippet?.title,
        details: item.snippet,
      });
    }

    if (platform === 'tiktok') {
      const accessToken = credentials.accessToken?.trim();
      const openId = credentials.openId?.trim();

      if (!accessToken) {
        return res.json({
          success: false,
          status: 'FAILED',
          latencyMs: Date.now() - startTime,
          error: 'TikTok Access Token is required.',
        });
      }

      const ttUrl = 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name';
      const ttRes = await fetch(ttUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      const latencyMs = Date.now() - startTime;
      const ttData = await ttRes.json().catch(() => null);

      if (!ttRes.ok || ttData?.error?.code) {
        return res.json({
          success: false,
          status: 'FAILED',
          latencyMs,
          error: ttData?.error?.message || `TikTok API error: HTTP ${ttRes.status}`,
          details: ttData?.error,
        });
      }

      const user = ttData.data?.user;
      return res.json({
        success: true,
        status: 'CONNECTED',
        latencyMs,
        message: `Connected to TikTok creator: "${user?.display_name || openId || 'Verified'}"`,
        creatorName: user?.display_name,
        details: user,
      });
    }

    return res.status(400).json({
      success: false,
      status: 'FAILED',
      latencyMs: Date.now() - startTime,
      error: `Unsupported platform: ${platform}`,
    });
  } catch (err: any) {
    return res.json({
      success: false,
      status: 'FAILED',
      latencyMs: Date.now() - startTime,
      error: err?.message || 'Server error testing social media integration',
    });
  }
});
app.get('/api/health', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  const aiProviders = storage.getAIProviders();
  const searchProviders = storage.getSearchProviders();
  const bloggerCfg = storage.getBloggerConfig();

  const openrouter = aiProviders.find((p) => p.type === 'openrouter');
  const gemini = aiProviders.find((p) => p.type === 'gemini');
  const tavily = searchProviders.find((p) => p.type === 'tavily');

  res.json({
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
  });
});

// --- 9.1 CRITICAL: Explicit API 404 Route Handler ---
// Ensures that ANY request to /api/* that does not match an Express route returns a JSON 404,
// completely preventing Vite or the SPA index.html fallback from serving HTML.
app.all('/api/*', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(404).json({
    success: false,
    error: `API endpoint not found: ${req.method} ${req.originalUrl || req.path}`,
    status: 'NOT_FOUND',
    status_code: 404,
    timestamp: new Date().toISOString(),
  });
});

// --- 10. Vite Middleware (Dev) & Static Serving (Prod) ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Axiom] Content Agent Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
