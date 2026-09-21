/**
 * Netlify Function: AI Provider Connection Test Endpoint
 * POST /api/providers/test
 * POST /api/providers/ai/test
 * Performs real server-side provider testing, URL normalization, and model validation.
 * NEVER returns HTML.
 */

import { ProviderTestingService } from '../../src/services/providerTestingService.ts';
import { StorageService } from '../../src/services/storage.ts';

export const handler = async (event: any) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: `Method ${event.httpMethod} not allowed. Use POST.`,
        status_code: 405,
      }),
    };
  }

  try {
    let body: any = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Invalid JSON request body.',
            status_code: 400,
          }),
        };
      }
    }

    const storage = StorageService.getInstance();
    const testingService = ProviderTestingService.getInstance();

    const { providerId, provider, prompt } = body;
    let targetProvider = provider;

    if (providerId) {
      targetProvider = storage.getAIProviders().find((p) => p.id === providerId);
    }

    if (!targetProvider) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          status: 'FAILED',
          status_code: 404,
          error: 'AI Provider configuration or ID not found.',
          latency_ms: 0,
          latencyMs: 0,
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // If key is masked in incoming payload, resolve from storage
    if (targetProvider.apiKey && targetProvider.apiKey.includes('••••')) {
      const stored = storage.getAIProviders().find((p) => p.id === targetProvider.id);
      if (stored) targetProvider.apiKey = stored.apiKey;
    }

    const testResult = await testingService.testAIProvider(
      targetProvider,
      prompt || 'Write one short sentence about technology.'
    );

    const httpStatus = typeof testResult.status === 'number' ? testResult.status : testResult.success ? 200 : 400;

    return {
      statusCode: httpStatus,
      headers,
      body: JSON.stringify(testResult),
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        status: 'FAILED',
        status_code: 500,
        error: `Server-side test error: ${errorMsg}`,
        latency_ms: 0,
        latencyMs: 0,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
