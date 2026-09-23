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
      const stored = storage.getAIProviders().find((p) => p.id === providerId);
      if (stored) {
        targetProvider = { ...stored, ...(provider || {}) };
        if (targetProvider.apiKey && targetProvider.apiKey.includes('••••') && stored.apiKey) {
          targetProvider.apiKey = stored.apiKey;
        }
      }
    }

    if (!targetProvider) {
      const errorObj = {
        type: 'provider_not_found',
        message: 'AI Provider configuration or ID not found.',
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

    // If key is masked in incoming payload, resolve from storage
    if (targetProvider.apiKey && targetProvider.apiKey.includes('••••')) {
      const stored = storage.getAIProviders().find((p) => p.id === targetProvider.id);
      if (stored && stored.apiKey && !stored.apiKey.includes('••••')) {
        targetProvider.apiKey = stored.apiKey;
      }
    }

    // Function-level safety guard: return structured JSON before Netlify platform 10s limit
    let functionTimer: NodeJS.Timeout | undefined;
    const safetyTimeoutPromise = new Promise<any>((resolve) => {
      functionTimer = setTimeout(() => {
        resolve({
          ok: false,
          success: false,
          status: 'FAILED',
          status_code: 504,
          error: {
            type: 'timeout',
            message: 'Provider test timed out after 9000ms',
            providerStatus: 504,
            url: targetProvider.baseUrl || '',
          },
          errorDetails: {
            type: 'timeout',
            message: 'Provider test timed out after 9000ms',
            providerStatus: 504,
            url: targetProvider.baseUrl || '',
          },
          provider: targetProvider.name || 'AI Provider',
          model: targetProvider.modelName || targetProvider.defaultModel || 'unknown',
          latencyMs: 9000,
          latency_ms: 9000,
          timestamp: new Date().toISOString(),
        });
      }, 9000);
    });

    const testResult = await Promise.race([
      testingService.testAIProvider(targetProvider, prompt || 'Reply with OK'),
      safetyTimeoutPromise,
    ]);
    clearTimeout(functionTimer);

    const httpStatus =
      typeof testResult.status_code === 'number'
        ? testResult.status_code
        : typeof testResult.status === 'number'
        ? testResult.status
        : testResult.success
        ? 200
        : 400;

    return {
      statusCode: httpStatus,
      headers,
      body: JSON.stringify(testResult),
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorObj = {
      type: 'internal_error',
      message: `Server-side test error: ${errorMsg}`,
      providerStatus: 500,
      url: '',
    };
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        success: false,
        status: 'FAILED',
        status_code: 500,
        error: errorObj,
        errorDetails: errorObj,
        latency_ms: 0,
        latencyMs: 0,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
