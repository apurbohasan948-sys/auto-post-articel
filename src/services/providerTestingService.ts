/**
 * Axiom Real-Time Provider Testing & Playground Engine
 * Performs actual network ping, model validation, latency measurement, and token extraction.
 * Strictly NO mocked or fabricated results.
 */

import { GoogleGenAI } from '@google/genai';
import {
  AITestResult,
  AIProviderConfig,
  ApiTestHistoryItem,
  ProviderUsageInfo,
  SearchProviderConfig,
  SearchTestResult,
} from '../types/agent.ts';
import { decryptSecret } from './encryption.ts';
import { StorageService } from './storage.ts';
import { normalizeOpenAICompatibleUrl, normalizeChatCompletionsUrl, normalizeTavilySearchUrl } from './urlHelper.ts';

export class ProviderTestingService {
  private static instance: ProviderTestingService;
  private storage: StorageService;

  private constructor() {
    this.storage = StorageService.getInstance();
  }

  public static getInstance(): ProviderTestingService {
    if (!ProviderTestingService.instance) {
      ProviderTestingService.instance = new ProviderTestingService();
    }
    return ProviderTestingService.instance;
  }

  /**
   * Tests an AI provider with real network probe.
   * Strictly NO mocked or fabricated results.
   */
  public async testAIProvider(
    provider: AIProviderConfig,
    prompt: string = 'Reply with OK'
  ): Promise<AITestResult> {
    const startTime = Date.now();

    // 1. Validate provider configuration
    if (!provider || !provider.name) {
      const errorObj = {
        type: 'invalid_provider_config',
        message: 'Invalid provider configuration payload.',
        providerStatus: 400,
        url: '',
      };
      return {
        ok: false,
        success: false,
        status: 'FAILED',
        status_code: 400,
        provider: provider?.name || 'Unknown',
        model: 'unspecified',
        latencyMs: 0,
        latency_ms: 0,
        error: errorObj,
        errorDetails: errorObj,
        timestamp: new Date().toISOString(),
      };
    }

    // 2. Validate Model Name
    const modelName = (provider.modelName || provider.defaultModel || '').trim();
    if (!modelName) {
      const errorMsg = `Model name is required for testing provider "${provider.name}".`;
      const errorObj = {
        type: 'invalid_model',
        message: errorMsg,
        providerStatus: 400,
        url: '',
      };
      return {
        ok: false,
        success: false,
        status: 'FAILED',
        status_code: 400,
        provider: provider.name,
        model: 'unspecified',
        latencyMs: 0,
        latency_ms: 0,
        error: errorObj,
        errorDetails: errorObj,
        timestamp: new Date().toISOString(),
      };
    }

    // 3. Validate Base URL for HTTP/OpenAI endpoints
    let endpoint = '';
    const defaultBase = provider.type === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1';
    if (provider.type !== 'gemini') {
      const rawBase = (provider.baseUrl || defaultBase).trim();

      try {
        const parsed = new URL(rawBase);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('Base URL protocol must be http:// or https://');
        }
        endpoint = normalizeOpenAICompatibleUrl(rawBase);
      } catch (urlErr) {
        const errorMsg = `Invalid Base URL: "${rawBase}". Expected a valid HTTP(S) URL (e.g. https://openrouter.ai/api/v1).`;
        const errorObj = {
          type: 'invalid_url',
          message: errorMsg,
          providerStatus: 400,
          url: rawBase,
        };
        return {
          ok: false,
          success: false,
          status: 'FAILED',
          status_code: 400,
          provider: provider.name,
          model: modelName,
          latencyMs: 0,
          latency_ms: 0,
          error: errorObj,
          errorDetails: errorObj,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 4. Validate API key
    // Crucial: Only fall back to process.env for built-in providers (gemini, openrouter).
    // NEVER fall back to process.env.OPENAI_API_KEY for custom/openai-compatible providers!
    let rawApiKey = decryptSecret(provider.apiKey).trim();
    if (!rawApiKey) {
      if (provider.type === 'gemini') {
        rawApiKey = (process.env.GEMINI_API_KEY || '').trim();
      } else if (provider.type === 'openrouter') {
        rawApiKey = (process.env.OPENROUTER_API_KEY || '').trim();
      }
    }

    if (!rawApiKey) {
      const errorMsg = `HTTP 401: Invalid API key (not configured for ${provider.name})`;
      const errorObj = {
        type: 'invalid_api_key',
        message: `No API key configured for ${provider.name}. Please configure an API key.`,
        providerStatus: 401,
        url: endpoint || 'SDK',
      };
      const result: AITestResult = {
        ok: false,
        success: false,
        status: 'FAILED',
        status_code: 401,
        provider: provider.name,
        model: modelName,
        latencyMs: 0,
        latency_ms: 0,
        error: errorObj,
        errorDetails: errorObj,
        timestamp: new Date().toISOString(),
      };
      this.recordHistory({
        providerId: provider.id,
        providerName: provider.name,
        providerType: 'ai',
        modelOrQuery: modelName,
        result: 'FAILED',
        latencyMs: 0,
        httpStatus: 401,
        error: errorMsg,
        summary: 'Missing API key',
      });
      return result;
    }

    // 5. Safe diagnostic logging (NEVER log the actual API key)
    let safeDiagnosticUrl = endpoint;
    try {
      const parsedSafe = new URL(endpoint);
      parsedSafe.username = '';
      parsedSafe.password = '';
      safeDiagnosticUrl = parsedSafe.toString();
    } catch {
      safeDiagnosticUrl = endpoint;
    }

    console.log('[AI Provider Test] Dispatching probe request:', {
      providerName: provider.name,
      providerType: provider.type,
      baseUrl: provider.baseUrl || defaultBase,
      normalizedRequestUrl: safeDiagnosticUrl,
      modelName,
      hasApiKey: Boolean(rawApiKey && rawApiKey.length > 0),
      requestStartTime: new Date().toISOString(),
    });

    try {
      // Gemini Path
      if (provider.type === 'gemini') {
        const ai = new GoogleGenAI({ apiKey: rawApiKey });
        const targetGeminiModel = modelName || 'gemini-2.5-flash';

        // Maximum outbound provider timeout: strictly 8000ms to stay well below serverless platform timeout
        const TEST_TIMEOUT_MS = 8000;
        const timeoutMs = Math.min(
          Math.max(Number(provider.timeoutMs) || 8000, 3000),
          TEST_TIMEOUT_MS
        );

        let timeoutTimer: NodeJS.Timeout | undefined;
        let timedOut = false;

        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutTimer = setTimeout(() => {
            timedOut = true;
            const err = new Error(`Provider request timed out after ${timeoutMs}ms`);
            err.name = 'TimeoutError';
            reject(err);
          }, timeoutMs);
        });

        try {
          const geminiPromise = ai.models.generateContent({
            model: targetGeminiModel,
            contents: prompt || 'Reply with OK',
            config: {
              maxOutputTokens: 10,
              temperature: 0.2,
            },
          });

          const response = await Promise.race([geminiPromise, timeoutPromise]);
          clearTimeout(timeoutTimer);

          const latencyMs = Date.now() - startTime;
          const output = response.text || 'OK';

          const testResult: AITestResult = {
            ok: true,
            success: true,
            status: 'connected',
            status_code: 200,
            provider: provider.name,
            model: targetGeminiModel,
            latencyMs,
            latency_ms: latencyMs,
            message: 'API connection successful',
            output,
            sampleOutput: output,
            tokenUsage: {
              promptTokens: response.usageMetadata?.promptTokenCount,
              completionTokens: response.usageMetadata?.candidatesTokenCount,
              totalTokens: response.usageMetadata?.totalTokenCount,
            },
            usage: {
              promptTokens: response.usageMetadata?.promptTokenCount,
              completionTokens: response.usageMetadata?.candidatesTokenCount,
              totalTokens: response.usageMetadata?.totalTokenCount,
            },
            usageInfo: {
              hasUsageData: Boolean(response.usageMetadata?.totalTokenCount),
              tokensToday: response.usageMetadata?.totalTokenCount,
              message: response.usageMetadata?.totalTokenCount
                ? `Total tokens used for test: ${response.usageMetadata.totalTokenCount}`
                : 'Usage information unavailable',
            },
            timestamp: new Date().toISOString(),
          };

          this.updateAIProviderStatus(provider.id, 'SUCCESS', latencyMs, undefined, testResult.usageInfo);
          this.recordHistory({
            providerId: provider.id,
            providerName: provider.name,
            providerType: 'ai',
            modelOrQuery: targetGeminiModel,
            result: 'SUCCESS',
            latencyMs,
            httpStatus: 200,
            summary: `Model ${targetGeminiModel} responded (${latencyMs}ms)`,
          });

          return testResult;
        } catch (genErr: unknown) {
          clearTimeout(timeoutTimer);
          const latencyMs = Date.now() - startTime;
          const errorMsg = genErr instanceof Error ? genErr.message : String(genErr);
          let statusCode = 500;
          let errorType = 'gemini_error';

          if (timedOut || (genErr instanceof Error && (genErr.name === 'TimeoutError' || genErr.name === 'AbortError'))) {
            statusCode = 504;
            errorType = 'timeout';
          } else if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not valid')) {
            statusCode = 401;
            errorType = 'invalid_api_key';
          } else if (errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('429')) {
            statusCode = 429;
            errorType = 'rate_limited';
          } else if (errorMsg.includes('NOT_FOUND') || errorMsg.includes('404')) {
            statusCode = 404;
            errorType = 'invalid_model';
          }

          const structuredError = {
            type: errorType,
            message: timedOut ? `Provider request timed out after ${timeoutMs}ms` : errorMsg,
            providerStatus: statusCode,
            providerResponse: errorMsg.substring(0, 250),
            url: 'Google GenAI SDK',
          };

          const testResult: AITestResult = {
            ok: false,
            success: false,
            status: 'FAILED',
            status_code: statusCode,
            error: structuredError,
            errorDetails: structuredError,
            provider: provider.name,
            model: targetGeminiModel,
            latencyMs,
            latency_ms: latencyMs,
            timestamp: new Date().toISOString(),
          };

          this.updateAIProviderStatus(provider.id, 'FAILED', latencyMs, structuredError.message);
          this.recordHistory({
            providerId: provider.id,
            providerName: provider.name,
            providerType: 'ai',
            modelOrQuery: targetGeminiModel,
            result: 'FAILED',
            latencyMs,
            httpStatus: statusCode,
            error: structuredError.message,
            summary: `HTTP ${statusCode}: ${structuredError.message.substring(0, 100)}`,
          });

          return testResult;
        } finally {
          clearTimeout(timeoutTimer);
        }
      }

      // OpenAI-compatible / OpenRouter / Custom endpoints
      // Strict timeout for API connection testing: max 8000ms
      const TEST_TIMEOUT_MS = 8000;
      const timeoutMs = Math.min(
        Math.max(Number(provider.timeoutMs) || 8000, 3000),
        TEST_TIMEOUT_MS
      );
      const controller = new AbortController();
      let timedOut = false;
      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rawApiKey}`,
      };

      if (provider.type === 'openrouter') {
        headers['HTTP-Referer'] = 'https://axiom-content.app';
        headers['X-Title'] = 'Axiom API Control Center';
      }

      // Merge custom headers if configured
      if (provider.headers && typeof provider.headers === 'object') {
        Object.assign(headers, provider.headers);
      }

      const testBody = {
        model: modelName,
        messages: [
          {
            role: 'user',
            content: prompt || 'Reply with OK',
          },
        ],
        max_tokens: 10,
      };

      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(testBody),
          signal: controller.signal,
        });
      } catch (fetchErr: unknown) {
        clearTimeout(timeoutTimer);
        const latencyMs = Date.now() - startTime;
        let errorType = 'network_error';
        let safeMsg = '';
        let statusCode = 502;

        const cause = (fetchErr as any)?.cause;
        const causeMsg = cause?.message || '';
        const causeCode = cause?.code || '';
        const combinedMsg = `${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)} ${causeMsg} ${causeCode}`;

        if (timedOut || (fetchErr instanceof Error && fetchErr.name === 'AbortError') || causeCode === 'ETIMEDOUT') {
          errorType = 'timeout';
          statusCode = 504;
          safeMsg = `Provider request timed out after ${timeoutMs}ms`;
        } else if (
          causeCode === 'ENOTFOUND' ||
          combinedMsg.includes('ENOTFOUND') ||
          combinedMsg.includes('getaddrinfo')
        ) {
          errorType = 'dns_error';
          statusCode = 502;
          safeMsg = `DNS resolution failed for "${safeDiagnosticUrl}". Verify Base URL hostname.`;
        } else if (
          causeCode === 'ECONNREFUSED' ||
          combinedMsg.includes('ECONNREFUSED') ||
          causeCode === 'ECONNRESET' ||
          combinedMsg.includes('ECONNRESET')
        ) {
          errorType = 'connection_refused';
          statusCode = 502;
          safeMsg = `Connection refused or reset at "${safeDiagnosticUrl}".`;
        } else {
          safeMsg = causeMsg || (fetchErr instanceof Error ? fetchErr.message : String(fetchErr));
        }

        const structuredError = {
          type: errorType,
          message: safeMsg,
          providerStatus: statusCode,
          providerResponse: safeMsg,
          url: safeDiagnosticUrl,
        };

        const testResult: AITestResult = {
          ok: false,
          success: false,
          status: 'FAILED',
          status_code: statusCode,
          error: structuredError,
          errorDetails: structuredError,
          provider: provider.name,
          model: modelName,
          latencyMs,
          latency_ms: latencyMs,
          timestamp: new Date().toISOString(),
        };

        this.updateAIProviderStatus(provider.id, 'FAILED', latencyMs, safeMsg);
        this.recordHistory({
          providerId: provider.id,
          providerName: provider.name,
          providerType: 'ai',
          modelOrQuery: modelName,
          result: 'FAILED',
          latencyMs,
          httpStatus: statusCode,
          error: safeMsg,
          summary: `HTTP ${statusCode}: ${safeMsg}`,
        });

        return testResult;
      } finally {
        clearTimeout(timeoutTimer);
      }

      clearTimeout(timeoutTimer);
      const latencyMs = Date.now() - startTime;

      // Upstream HTTP errors (400, 401, 403, 404, 429, 500, 502, etc.)
      if (!res.ok) {
        const contentType = res.headers.get('content-type') || '';
        let parsedErrorMsg = '';
        let errorType = 'upstream_error';

        if (res.status === 400) errorType = 'invalid_request';
        else if (res.status === 401) errorType = 'invalid_api_key';
        else if (res.status === 403) errorType = 'forbidden';
        else if (res.status === 404) errorType = 'endpoint_or_model_not_found';
        else if (res.status === 429) errorType = 'rate_limited';
        else if (res.status === 500) errorType = 'provider_internal_error';
        else if (res.status === 502) errorType = 'upstream_error';
        else if (res.status === 503) errorType = 'provider_unavailable';
        else if (res.status === 504) errorType = 'provider_timeout';

        try {
          const rawErrorText = await res.text();
          if (contentType.includes('application/json') || rawErrorText.trim().startsWith('{')) {
            try {
              const jsonErr = JSON.parse(rawErrorText);
              parsedErrorMsg = jsonErr?.error?.message || jsonErr?.error || jsonErr?.message || '';
              if (typeof parsedErrorMsg === 'object') parsedErrorMsg = JSON.stringify(parsedErrorMsg);
            } catch {
              parsedErrorMsg = rawErrorText.substring(0, 250);
            }
          } else {
            // HTML or non-JSON response from upstream
            parsedErrorMsg = rawErrorText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().substring(0, 200);
            if (!parsedErrorMsg) parsedErrorMsg = `Provider returned HTTP ${res.status} HTML response`;
          }
        } catch {
          parsedErrorMsg = `HTTP ${res.status} ${res.statusText}`;
        }

        const humanMessage = parsedErrorMsg
          ? `HTTP ${res.status}: ${parsedErrorMsg}`
          : `HTTP ${res.status} ${res.statusText}`;

        const structuredError = {
          type: errorType,
          message: humanMessage,
          providerStatus: res.status,
          providerResponse: (parsedErrorMsg || '').substring(0, 250),
          url: safeDiagnosticUrl,
        };

        const testResult: AITestResult = {
          ok: false,
          success: false,
          status: 'FAILED',
          status_code: res.status,
          error: structuredError,
          errorDetails: structuredError,
          provider: provider.name,
          model: modelName,
          latencyMs,
          latency_ms: latencyMs,
          timestamp: new Date().toISOString(),
        };

        this.updateAIProviderStatus(provider.id, 'FAILED', latencyMs, humanMessage);
        this.recordHistory({
          providerId: provider.id,
          providerName: provider.name,
          providerType: 'ai',
          modelOrQuery: modelName,
          result: 'FAILED',
          latencyMs,
          httpStatus: res.status,
          error: humanMessage,
          summary: `HTTP ${res.status}: ${parsedErrorMsg.substring(0, 100)}`,
        });

        return testResult;
      }

      // Parse JSON response safely
      let data: any;
      try {
        data = await res.json();
      } catch {
        const parseMsg = 'Provider returned invalid or malformed JSON payload';
        const structuredError = {
          type: 'malformed_response',
          message: parseMsg,
          providerStatus: res.status,
          providerResponse: parseMsg,
          url: safeDiagnosticUrl,
        };
        return {
          ok: false,
          success: false,
          status: 'FAILED',
          status_code: 502,
          error: structuredError,
          errorDetails: structuredError,
          provider: provider.name,
          model: modelName,
          latencyMs,
          latency_ms: latencyMs,
          timestamp: new Date().toISOString(),
        };
      }

      const output = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';

      // Check usage info
      let usageInfo: ProviderUsageInfo = {
        hasUsageData: false,
        message: 'Usage information unavailable',
      };

      if (data.usage) {
        usageInfo = {
          hasUsageData: true,
          tokensToday: data.usage.total_tokens,
          message: `Prompt: ${data.usage.prompt_tokens || 0}, Completion: ${data.usage.completion_tokens || 0}, Total: ${data.usage.total_tokens || 0} tokens`,
        };
      }

      // Return normalized successful result immediately
      // CRITICAL: Do NOT make secondary network requests (such as OpenRouter usage or credit lookups)
      // during the connection test. The purpose of Test API is ONLY: key + endpoint + model + response.
      const testResult: AITestResult = {
        ok: true,
        success: true,
        status: 'connected',
        status_code: 200,
        provider: provider.name,
        model: data.model || modelName,
        latencyMs,
        latency_ms: latencyMs,
        message: 'API connection successful',
        output,
        sampleOutput: output || 'OK',
        tokenUsage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
        usageInfo,
        timestamp: new Date().toISOString(),
      };

      this.updateAIProviderStatus(provider.id, 'SUCCESS', latencyMs, undefined, usageInfo);
      this.recordHistory({
        providerId: provider.id,
        providerName: provider.name,
        providerType: 'ai',
        modelOrQuery: modelName,
        result: 'SUCCESS',
        latencyMs,
        httpStatus: res.status,
        summary: `Model ${modelName} verified (${latencyMs}ms)`,
      });

      return testResult;
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);

      const structuredError = {
        type: 'internal_error',
        message: errorMsg,
        providerStatus: 500,
        providerResponse: errorMsg,
        url: safeDiagnosticUrl,
      };

      const testResult: AITestResult = {
        ok: false,
        success: false,
        status: 'FAILED',
        status_code: 500,
        provider: provider.name,
        model: modelName,
        latencyMs,
        latency_ms: latencyMs,
        error: structuredError,
        errorDetails: structuredError,
        timestamp: new Date().toISOString(),
      };

      this.updateAIProviderStatus(provider.id, 'FAILED', latencyMs, errorMsg);
      this.recordHistory({
        providerId: provider.id,
        providerName: provider.name,
        providerType: 'ai',
        modelOrQuery: modelName,
        result: 'FAILED',
        latencyMs,
        httpStatus: 500,
        error: errorMsg,
        summary: `Error: ${errorMsg}`,
      });

      return testResult;
    }
  }

  /**
   * Fetches OpenRouter API key limits and credits if available.
   * Standalone optional helper with strict 2500ms AbortController.
   */
  public async fetchOpenRouterUsage(apiKey: string): Promise<ProviderUsageInfo> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        return { hasUsageData: false, message: 'Usage information unavailable' };
      }
      const json = await res.json();
      const d = json.data;
      if (!d) return { hasUsageData: false, message: 'Usage information unavailable' };

      const remaining = d.limit !== null && d.limit !== undefined ? (d.limit - (d.usage || 0)).toFixed(4) : 'Unlimited';
      const rateLimitText = d.rate_limit ? `${d.rate_limit.requests} reqs / ${d.rate_limit.interval}` : 'Standard';

      return {
        hasUsageData: true,
        requestsToday: d.usage_daily || undefined,
        remainingQuota: `$${remaining}`,
        rateLimit: rateLimitText,
        message: `Credits Used: $${(d.usage || 0).toFixed(4)} • Limit: ${d.limit !== null ? `$${d.limit}` : 'Pay-as-you-go'}`,
      };
    } catch {
      return { hasUsageData: false, message: 'Usage information unavailable' };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Tests a Search / Research API provider (Tavily or Custom).
   */
  public async testSearchProvider(
    provider: SearchProviderConfig,
    query: string = 'latest artificial intelligence trends',
    depth: 'basic' | 'advanced' = 'basic',
    maxResults: number = 5
  ): Promise<SearchTestResult> {
    const startTime = Date.now();

    if (!provider || !provider.name) {
      return {
        success: false,
        status: 'FAILED',
        status_code: 400,
        provider: 'Unknown',
        query,
        latencyMs: 0,
        latency_ms: 0,
        resultCount: 0,
        resultsCount: 0,
        results: [],
        error: 'Invalid search provider configuration.',
        timestamp: new Date().toISOString(),
      };
    }

    const rawApiKey = decryptSecret(provider.apiKey) || (provider.type === 'tavily' ? process.env.TAVILY_API_KEY || '' : '');

    if (provider.type === 'tavily') {
      if (!rawApiKey) {
        const res: SearchTestResult = {
          success: false,
          status: 'FAILED',
          status_code: 401,
          provider: provider.name,
          query,
          latencyMs: 0,
          latency_ms: 0,
          resultCount: 0,
          resultsCount: 0,
          results: [],
          error: 'Missing Tavily API key. Provide an API key in settings or set TAVILY_API_KEY.',
          timestamp: new Date().toISOString(),
        };
        this.recordHistory({
          providerId: provider.id,
          providerName: provider.name,
          providerType: 'search',
          modelOrQuery: query,
          result: 'FAILED',
          latencyMs: 0,
          httpStatus: 401,
          error: res.error,
          summary: 'Missing API key',
        });
        return res;
      }

      const endpoint = normalizeTavilySearchUrl(provider.baseUrl);
      const SEARCH_TIMEOUT_MS = 8000;
      const timeoutMs = Math.min(
        Math.max(Number(provider.timeoutMs) || 8000, 3000),
        SEARCH_TIMEOUT_MS
      );
      const controller = new AbortController();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: rawApiKey,
            query,
            search_depth: depth || provider.searchDepth || 'basic',
            max_results: maxResults || provider.maxResults || 5,
            topic: provider.topic || 'general',
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const latencyMs = Date.now() - startTime;

        if (!response.ok) {
          let errorMsg = `HTTP ${response.status} ${response.statusText}`;
          try {
            const errJson = await response.json();
            if (errJson.detail?.error) errorMsg = errJson.detail.error;
            else if (errJson.error) errorMsg = errJson.error;
          } catch {
            const txt = await response.text();
            if (txt) errorMsg = txt.substring(0, 150);
          }

          const result: SearchTestResult = {
            success: false,
            status: 'FAILED',
            status_code: response.status,
            provider: provider.name,
            query,
            latencyMs,
            latency_ms: latencyMs,
            resultCount: 0,
            resultsCount: 0,
            results: [],
            error: errorMsg,
            timestamp: new Date().toISOString(),
          };

          this.updateSearchProviderStatus(provider.id, 'FAILED', latencyMs, errorMsg);
          this.recordHistory({
            providerId: provider.id,
            providerName: provider.name,
            providerType: 'search',
            modelOrQuery: query,
            result: 'FAILED',
            latencyMs,
            httpStatus: response.status,
            error: errorMsg,
            summary: `Tavily failed: ${errorMsg}`,
          });

          return result;
        }

        const data = await response.json();
        const rawResults = data.results || [];
        const formatted = rawResults.map((r: any) => ({
          title: r.title || 'Untitled Source',
          url: r.url || '',
          content: r.content || r.snippet || '',
          snippet: r.snippet || r.content || '',
          score: r.score,
        }));

        const result: SearchTestResult = {
          success: true,
          status: 'connected',
          status_code: 200,
          provider: provider.name,
          query,
          latencyMs,
          latency_ms: latencyMs,
          message: 'Search connection successful',
          resultCount: formatted.length,
          resultsCount: formatted.length,
          results: formatted,
          timestamp: new Date().toISOString(),
        };

        this.updateSearchProviderStatus(provider.id, 'SUCCESS', latencyMs);
        this.recordHistory({
          providerId: provider.id,
          providerName: provider.name,
          providerType: 'search',
          modelOrQuery: query,
          result: 'SUCCESS',
          latencyMs,
          httpStatus: 200,
          summary: `Tavily returned ${formatted.length} verified results (${latencyMs}ms)`,
        });

        return result;
      } catch (err: unknown) {
        clearTimeout(timeout);
        const latencyMs = Date.now() - startTime;
        const msg = err instanceof Error ? err.message : String(err);

        const result: SearchTestResult = {
          success: false,
          status: 500,
          latencyMs,
          resultCount: 0,
          results: [],
          error: msg,
          timestamp: new Date().toISOString(),
        };

        this.updateSearchProviderStatus(provider.id, 'FAILED', latencyMs, msg);
        this.recordHistory({
          providerId: provider.id,
          providerName: provider.name,
          providerType: 'search',
          modelOrQuery: query,
          result: 'FAILED',
          latencyMs,
          httpStatus: 500,
          error: msg,
          summary: `Tavily request error: ${msg}`,
        });

        return result;
      }
    }

    // Custom Search Provider (e.g. CrossRef or generic API)
    const baseUrl = provider.baseUrl || 'https://api.crossref.org';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), provider.timeoutMs || 25000);

    try {
      const url = `${baseUrl.replace(/\/+$/, '')}/works?query=${encodeURIComponent(query)}&rows=${maxResults || 5}`;
      const res = await fetch(url, {
        headers: rawApiKey ? { Authorization: `Bearer ${rawApiKey}` } : {},
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errorMsg = `HTTP ${res.status}: ${res.statusText}`;
        this.updateSearchProviderStatus(provider.id, 'FAILED', latencyMs, errorMsg);
        this.recordHistory({
          providerId: provider.id,
          providerName: provider.name,
          providerType: 'search',
          modelOrQuery: query,
          result: 'FAILED',
          latencyMs,
          httpStatus: res.status,
          error: errorMsg,
          summary: `Custom search failed: ${errorMsg}`,
        });

        return {
          success: false,
          status: res.status,
          latencyMs,
          resultCount: 0,
          results: [],
          error: errorMsg,
          timestamp: new Date().toISOString(),
        };
      }

      const json = await res.json();
      const items = json.message?.items || [];
      const formatted = items.slice(0, maxResults).map((item: any) => ({
        title: item.title?.[0] || 'Academic Paper',
        url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : baseUrl),
        content: item.abstract || item['container-title']?.[0] || 'Peer-reviewed scholarly record.',
      }));

      this.updateSearchProviderStatus(provider.id, 'SUCCESS', latencyMs);
      this.recordHistory({
        providerId: provider.id,
        providerName: provider.name,
        providerType: 'search',
        modelOrQuery: query,
        result: 'SUCCESS',
        latencyMs,
        httpStatus: 200,
        summary: `Custom search returned ${formatted.length} results (${latencyMs}ms)`,
      });

      return {
        success: true,
        status: 200,
        latencyMs,
        resultCount: formatted.length,
        results: formatted,
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);

      this.updateSearchProviderStatus(provider.id, 'FAILED', latencyMs, errorMsg);
      this.recordHistory({
        providerId: provider.id,
        providerName: provider.name,
        providerType: 'search',
        modelOrQuery: query,
        result: 'FAILED',
        latencyMs,
        httpStatus: 500,
        error: errorMsg,
        summary: `Search error: ${errorMsg}`,
      });

      return {
        success: false,
        status: 500,
        latencyMs,
        resultCount: 0,
        results: [],
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private updateAIProviderStatus(
    id: string,
    status: 'SUCCESS' | 'FAILED',
    latencyMs: number,
    error?: string,
    usage?: ProviderUsageInfo
  ): void {
    const list = this.storage.getAIProviders();
    const updated = list.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          lastTestedAt: new Date().toISOString(),
          lastTestStatus: status,
          lastLatencyMs: latencyMs,
          lastError: error || undefined,
          usageInfo: usage || p.usageInfo,
          updatedAt: new Date().toISOString(),
        };
      }
      return p;
    });
    this.storage.updateAIProviders(updated);
  }

  private updateSearchProviderStatus(
    id: string,
    status: 'SUCCESS' | 'FAILED',
    latencyMs: number,
    error?: string
  ): void {
    const list = this.storage.getSearchProviders();
    const updated = list.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          lastTestedAt: new Date().toISOString(),
          lastTestStatus: status,
          lastLatencyMs: latencyMs,
          lastError: error || undefined,
          updatedAt: new Date().toISOString(),
        };
      }
      return p;
    });
    this.storage.updateSearchProviders(updated);
  }

  private recordHistory(item: Omit<ApiTestHistoryItem, 'id' | 'timestamp'>): void {
    const fullItem: ApiTestHistoryItem = {
      ...item,
      id: `test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.storage.addTestHistory(fullItem);
  }
}
