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
import { StorageService } from './src/services/storage.ts';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

const storage = StorageService.getInstance();
const orchestrator = Orchestrator.getInstance();
const analytics = new AnalyticsMonitorAgent();
const scout = new TopicScoutAgent();
const bloggerAgent = new BloggerPublisherAgent();

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

app.get('/api/providers/ai', (req: Request, res: Response) => {
  // Mask secret keys for safe frontend display
  const providers = storage.getAIProviders().map((p) => ({
    ...p,
    apiKey: p.apiKey ? `***${p.apiKey.slice(-4)}` : '',
    hasKey: Boolean(p.apiKey),
  }));
  res.json({ providers });
});

app.put('/api/providers/ai', (req: Request, res: Response) => {
  const incoming = req.body.providers;
  if (!Array.isArray(incoming)) return res.status(400).json({ error: 'Invalid providers array' });
  const current = storage.getAIProviders();

  // Merge keys if masked
  const updated = incoming.map((inc) => {
    const existing = current.find((c) => c.id === inc.id);
    let key = inc.apiKey;
    if (key && key.startsWith('***')) {
      key = existing?.apiKey || '';
    }
    return { ...inc, apiKey: key };
  });

  storage.updateAIProviders(updated);
  res.json({ success: true });
});

app.get('/api/providers/search', (req: Request, res: Response) => {
  const providers = storage.getSearchProviders().map((p) => ({
    ...p,
    apiKey: p.apiKey ? `***${p.apiKey.slice(-4)}` : '',
    hasKey: Boolean(p.apiKey),
  }));
  res.json({ providers });
});

app.put('/api/providers/search', (req: Request, res: Response) => {
  const incoming = req.body.providers;
  if (!Array.isArray(incoming)) return res.status(400).json({ error: 'Invalid providers array' });
  const current = storage.getSearchProviders();

  const updated = incoming.map((inc) => {
    const existing = current.find((c) => c.id === inc.id);
    let key = inc.apiKey;
    if (key && key.startsWith('***')) {
      key = existing?.apiKey || '';
    }
    return { ...inc, apiKey: key };
  });

  storage.updateSearchProviders(updated);
  res.json({ success: true });
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
  const aiProviders = storage.getAIProviders();
  const searchProviders = storage.getSearchProviders();
  const bloggerCfg = storage.getBloggerConfig();

  const openrouter = aiProviders.find((p) => p.type === 'openrouter');
  const gemini = aiProviders.find((p) => p.type === 'gemini');
  const tavily = searchProviders.find((p) => p.type === 'tavily');

  res.json({
    timestamp: new Date().toISOString(),
    status: 'HEALTHY',
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
