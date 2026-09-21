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
    const { topicId, isManualApprovalRun } = req.body || {};
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
    apiKey: maskApiKey(p.apiKey),
    hasKey: Boolean(p.apiKey),
  }));
}

function getMaskedSearchProviders() {
  return storage.getSearchProviders().map((p) => ({
    ...p,
    apiKey: maskApiKey(p.apiKey),
    hasKey: Boolean(p.apiKey),
  }));
}

// 7.1 AI Providers
app.get('/api/providers/ai', (req: Request, res: Response) => {
  res.json({ providers: getMaskedAIProviders() });
});

app.post('/api/providers/ai/save', (req: Request, res: Response) => {
  const { provider } = req.body;
  if (!provider || !provider.name) {
    return res.status(400).json({ error: 'Invalid provider payload' });
  }

  const existing = storage.getAIProviders().find((p) => p.id === provider.id);
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
    apiKey: finalKey,
    hasKey: Boolean(finalKey),
  });

  res.json({
    success: true,
    provider: {
      ...saved,
      apiKey: maskApiKey(saved.apiKey),
      hasKey: Boolean(saved.apiKey),
    },
  });
});

app.delete('/api/providers/ai/:id', (req: Request, res: Response) => {
  const success = storage.deleteAIProvider(req.params.id);
  res.json({ success });
});

app.post('/api/providers/ai/reorder', (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  storage.reorderAIProviders(ids);
  res.json({ success: true, providers: getMaskedAIProviders() });
});

app.post('/api/providers/ai/toggle', (req: Request, res: Response) => {
  const { id, enabled } = req.body;
  const updated = storage.toggleAIProvider(id, Boolean(enabled));
  res.json({ success: Boolean(updated), provider: updated });
});

// Alias for Section 1, 6 & 8: /api/providers/test and /api/providers/ai/test
const handleAIProviderTest = async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { providerId, provider } = req.body || {};
    let targetProvider = provider;

    if (providerId) {
      targetProvider = storage.getAIProviders().find((p) => p.id === providerId);
    }

    if (!targetProvider) {
      return res.status(404).json({
        success: false,
        status: 'FAILED',
        status_code: 404,
        error: 'Provider not found',
        latency_ms: 0,
        latencyMs: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // If key is masked in incoming payload, resolve from storage
    if (targetProvider.apiKey && targetProvider.apiKey.includes('••••')) {
      const stored = storage.getAIProviders().find((p) => p.id === targetProvider.id);
      if (stored) targetProvider.apiKey = stored.apiKey;
    }

    const testResult = await testingService.testAIProvider(targetProvider);
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

// 7.2 Search / Research Providers
app.get('/api/providers/search', (req: Request, res: Response) => {
  res.json({ providers: getMaskedSearchProviders() });
});

app.post('/api/providers/search/save', (req: Request, res: Response) => {
  const { provider } = req.body;
  if (!provider || !provider.name) {
    return res.status(400).json({ error: 'Invalid search provider payload' });
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
    apiKey: finalKey,
    hasKey: Boolean(finalKey),
  });

  res.json({
    success: true,
    provider: {
      ...saved,
      apiKey: maskApiKey(saved.apiKey),
      hasKey: Boolean(saved.apiKey),
    },
  });
});

app.delete('/api/providers/search/:id', (req: Request, res: Response) => {
  const success = storage.deleteSearchProvider(req.params.id);
  res.json({ success });
});

app.post('/api/providers/search/reorder', (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  storage.reorderSearchProviders(ids);
  res.json({ success: true, providers: getMaskedSearchProviders() });
});

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

// --- 9. API Health Monitor ---
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
