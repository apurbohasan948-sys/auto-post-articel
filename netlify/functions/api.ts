/**
 * Netlify Serverless Function: API Router
 * Handles all /api/* requests when deployed to Netlify Functions.
 */

import { AnalyticsMonitorAgent } from '../../src/agents/AnalyticsMonitorAgent.ts';
import { BloggerPublisherAgent } from '../../src/agents/BloggerPublisherAgent.ts';
import { Orchestrator } from '../../src/agents/Orchestrator.ts';
import { TopicScoutAgent } from '../../src/agents/TopicScoutAgent.ts';
import { StorageService } from '../../src/services/storage.ts';

export const handler = async (event: any) => {
  const storage = StorageService.getInstance();
  const orchestrator = Orchestrator.getInstance();
  const analytics = new AnalyticsMonitorAgent();
  const scout = new TopicScoutAgent();
  const bloggerAgent = new BloggerPublisherAgent();

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
        }),
      };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: `Path not found: ${path}` }) };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: errorMsg }),
    };
  }
};
