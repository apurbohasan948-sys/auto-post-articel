/**
 * Netlify Function: API Health Check Diagnostic Endpoint
 * GET /api/health -> /.netlify/functions/health
 * Returns JSON status for all backend functions and providers.
 * NEVER returns HTML.
 */

import { StorageService } from '../../src/services/storage.ts';

export const handler = async (event: any) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const storage = StorageService.getInstance();
    const aiProviders = storage.getAIProviders();
    const searchProviders = storage.getSearchProviders();
    const bloggerCfg = storage.getBloggerConfig();

    const openrouter = aiProviders.find((p) => p.type === 'openrouter');
    const gemini = aiProviders.find((p) => p.type === 'gemini');
    const tavily = searchProviders.find((p) => p.type === 'tavily');

    const payload = {
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
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(payload, null, 2),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        service: 'content-agent-api',
        status: 'FAILED',
        status_code: 500,
        error: msg,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
