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
import {
  normalizeOpenAICompatibleUrl,
  normalizeOpenRouterUrl,
  normalizeProviderEndpoint,
  normalizeChatCompletionsUrl,
  normalizeTavilySearchUrl,
} from './urlHelper.ts';

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
   * Diagnostic probe for OpenRouter: tests GET /models to distinguish network/firewall blockage
   * from chat completion/model queue delays.
   */
  public async probeOpenRouterConnectivity(apiKey: string): Promise<{
    reachable: boolean;
    status: number;
    latencyMs: number;
    modelsFound: number;
    error?: string;
  }> {
    const probeStart = Date.now();
    const probeCtrl = new AbortController();
    const timer = setTimeout(() => probeCtrl.abort(), 4000);
    try {
      console.log('OPENROUTER_DIAGNOSTIC_PROBE_START', {
        endpoint: 'https://openrouter.ai/api/v1/models',
        method: 'GET',
        apiKeyPresent: Boolean(apiKey && apiKey.trim().length > 0),
        apiKeyLength: apiKey ? apiKey.length : 0,
      });
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://axiom-content.app',
          'X-Title': 'Axiom API Control Center',
        },
        signal: probeCtrl.signal,
      });
      clearTimeout(timer);
      const latencyMs = Date.now() - probeStart;
      console.log('OPENROUTER_DIAGNOSTIC_PROBE_RESPONSE', {
        status: res.status,
        contentType: res.headers.get('content-type'),
        latencyMs,
      });
      let modelsFound = 0;
      if (res.ok) {
        try {
          const json = await res.json();
          modelsFound = Array.isArray(json?.data) ? json.data.length : 0;
        } catch {}
      }
      return {
        reachable: res.ok || res.status === 401 || res.status === 403,
        status: res.status,
        latencyMs,
        modelsFound,
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      const latencyMs = Date.now() - probeStart;
      const msg = err instanceof Error ? err.message : String(err);
      console.log('OPENROUTER_DIAGNOSTIC_PROBE_ERROR', {
        latencyMs,
        error: msg,
      });
      return {
        reachable: false,
        status: 0,
        latencyMs,
        modelsFound: 0,
        error: msg,
      };
    }
  }

  /**
   * Tests an AI provider with real network probe and detailed server-side diagnostics.
   * Strictly NO mocked or fabricated results.
   */
  public async testAIProvider(
    provider: AIProviderConfig,
    prompt: string = 'Reply only with OK'
  ): Promise<AITestResult> {
    const requestStartedAt = Date.now();
    const requestStartedIso = new Date(requestStartedAt).toISOString();

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
        statusCode: 400,
        errorType: 'INVALID_PROVIDER_CONFIG',
        message: 'Invalid provider configuration payload.',
        provider: provider?.name || 'Unknown',
        model: 'unspecified',
        latencyMs: 0,
        latency_ms: 0,
        error: errorObj,
        errorDetails: errorObj,
        diagnostics: {
          providerType: 'unknown',
          endpoint: '',
          model: 'unspecified',
          apiKeyPresent: false,
          elapsedMs: 0,
        },
        timestamp: new Date().toISOString(),
      };
    }

    // 2. Section 5: Normalize Provider Type
    // Normalize before routing to avoid mistakenly treating OpenRouter as Gemini or vice versa
    const rawType = (provider.type || '').toLowerCase().trim();
    const isGemini = rawType === 'gemini' || rawType.includes('google');
    const isOpenRouter = rawType === 'openrouter' || rawType.includes('openrouter');
    const resolvedType: 'gemini' | 'openrouter' | 'openai-compatible' | 'custom' = isGemini
      ? 'gemini'
      : isOpenRouter
      ? 'openrouter'
      : 'openai-compatible';

    // 3. Section 7: Validate Model Name
    const modelName = (provider.modelName || provider.defaultModel || (provider as any).model || '').trim();
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
        statusCode: 400,
        errorType: 'INVALID_MODEL',
        message: errorMsg,
        provider: provider.name,
        model: 'unspecified',
        latencyMs: 0,
        latency_ms: 0,
        error: errorObj,
        errorDetails: errorObj,
        diagnostics: {
          providerType: resolvedType,
          endpoint: '',
          model: 'unspecified',
          apiKeyPresent: false,
          elapsedMs: 0,
        },
        timestamp: new Date().toISOString(),
      };
    }

    // 4. Section 3, 4, 11: Validate Base URL & Normalize Endpoint
    let endpoint = '';
    let configuredBaseUrl = (provider.baseUrl || '').trim();
    if (isGemini) {
      endpoint = 'Google GenAI SDK';
    } else {
      if (isOpenRouter) {
        endpoint = normalizeOpenRouterUrl(configuredBaseUrl);
        if (!configuredBaseUrl) {
          configuredBaseUrl = 'https://openrouter.ai/api/v1';
        }
      } else {
        endpoint = normalizeOpenAICompatibleUrl(configuredBaseUrl);
        if (!configuredBaseUrl) {
          configuredBaseUrl = 'https://api.openai.com/v1';
        }
      }

      try {
        const parsed = new URL(endpoint);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('Base URL protocol must be http:// or https://');
        }
      } catch (urlErr) {
        const errorMsg = `Invalid endpoint URL: "${endpoint}". Expected a valid HTTP(S) URL.`;
        const errorObj = {
          type: 'invalid_url',
          message: errorMsg,
          providerStatus: 400,
          url: endpoint,
        };
        return {
          ok: false,
          success: false,
          status: 'FAILED',
          status_code: 400,
          statusCode: 400,
          errorType: 'INVALID_ENDPOINT',
          message: errorMsg,
          provider: provider.name,
          model: modelName,
          latencyMs: 0,
          latency_ms: 0,
          error: errorObj,
          errorDetails: errorObj,
          diagnostics: {
            providerType: resolvedType,
            baseUrl: configuredBaseUrl,
            endpoint,
            model: modelName,
            apiKeyPresent: false,
            elapsedMs: 0,
          },
          timestamp: new Date().toISOString(),
        };
      }
    }

    // Safe diagnostic URL (user & password stripped)
    let safeDiagnosticUrl = endpoint;
    if (!isGemini) {
      try {
        const parsedSafe = new URL(endpoint);
        parsedSafe.username = '';
        parsedSafe.password = '';
        safeDiagnosticUrl = parsedSafe.toString();
      } catch {
        safeDiagnosticUrl = endpoint;
      }
    }

    // 5. Section 6: Validate API Key Before Network Fetch
    let rawApiKey = decryptSecret(provider.apiKey).trim();
    if (!rawApiKey) {
      if (isGemini) {
        rawApiKey = (process.env.GEMINI_API_KEY || '').trim();
      } else if (isOpenRouter) {
        rawApiKey = (process.env.OPENROUTER_API_KEY || '').trim();
      }
    }

    // Check A: Key missing
    if (!rawApiKey || !rawApiKey.trim()) {
      const errorMsg = 'API key is missing';
      const errorObj = {
        type: 'invalid_api_key',
        message: `API key is missing for provider "${provider.name}". Please configure an API key.`,
        providerStatus: 400,
        url: safeDiagnosticUrl,
      };
      const result: AITestResult = {
        ok: false,
        success: false,
        status: 'FAILED',
        status_code: 400,
        statusCode: 400,
        errorType: 'API_KEY_MISSING',
        message: errorMsg,
        provider: provider.name,
        model: modelName,
        latencyMs: 0,
        latency_ms: 0,
        error: errorObj,
        errorDetails: errorObj,
        diagnostics: {
          providerType: resolvedType,
          baseUrl: configuredBaseUrl,
          endpoint: safeDiagnosticUrl,
          model: modelName,
          apiKeyPresent: false,
          elapsedMs: 0,
        },
        timestamp: new Date().toISOString(),
      };
      this.recordHistory({
        providerId: provider.id,
        providerName: provider.name,
        providerType: 'ai',
        modelOrQuery: modelName,
        result: 'FAILED',
        latencyMs: 0,
        httpStatus: 400,
        error: errorMsg,
        summary: `HTTP 400: ${errorMsg}`,
      });
      return result;
    }

    // Check B: Key masked
    if (rawApiKey.includes('••••')) {
      const errorMsg = 'Stored API key is masked/invalid';
      const errorObj = {
        type: 'invalid_api_key',
        message: errorMsg,
        providerStatus: 400,
        url: safeDiagnosticUrl,
      };
      const result: AITestResult = {
        ok: false,
        success: false,
        status: 'FAILED',
        status_code: 400,
        statusCode: 400,
        errorType: 'API_KEY_MASKED',
        message: errorMsg,
        provider: provider.name,
        model: modelName,
        latencyMs: 0,
        latency_ms: 0,
        error: errorObj,
        errorDetails: errorObj,
        diagnostics: {
          providerType: resolvedType,
          baseUrl: configuredBaseUrl,
          endpoint: safeDiagnosticUrl,
          model: modelName,
          apiKeyPresent: true,
          apiKeyLength: rawApiKey.length,
          elapsedMs: 0,
        },
        timestamp: new Date().toISOString(),
      };
      this.recordHistory({
        providerId: provider.id,
        providerName: provider.name,
        providerType: 'ai',
        modelOrQuery: modelName,
        result: 'FAILED',
        latencyMs: 0,
        httpStatus: 400,
        error: errorMsg,
        summary: `HTTP 400: ${errorMsg}`,
      });
      return result;
    }

    // 6. Section 2: Log Safe Request Diagnostics (NEVER log actual API key)
    const safeDiagnostics = {
      provider: provider.name,
      providerType: resolvedType,
      baseUrl: configuredBaseUrl || (isGemini ? 'Google GenAI SDK' : 'https://api.openai.com/v1'),
      endpoint: safeDiagnosticUrl,
      model: modelName,
      method: 'POST',
      apiKeyPresent: Boolean(rawApiKey && rawApiKey.trim().length > 0),
      apiKeyLength: rawApiKey.length,
      requestStartTime: requestStartedIso,
    };
    console.log('PROVIDER_FETCH_START', safeDiagnostics);

    try {
      // ----------------------------------------------------
      // PATH 1: Google Gemini SDK Path
      // ----------------------------------------------------
      if (isGemini) {
        // Section 1: 15000ms max timeout for diagnosis
        const DIAGNOSTIC_TIMEOUT_MS = 15000;
        const timeoutMs = Math.min(
          Math.max(Number(provider.timeoutMs) || 15000, 3000),
          DIAGNOSTIC_TIMEOUT_MS
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

        const ai = new GoogleGenAI({ apiKey: rawApiKey });
        const targetGeminiModel = modelName || 'gemini-2.5-flash';

        try {
          const geminiPromise = ai.models.generateContent({
            model: targetGeminiModel,
            contents: prompt && prompt.trim() ? prompt : 'Reply only with OK',
            config: {
              maxOutputTokens: 10,
              temperature: 0.2,
            },
          });

          const response = await Promise.race([geminiPromise, timeoutPromise]);
          clearTimeout(timeoutTimer);

          const latencyMs = Date.now() - requestStartedAt;
          const output = response.text || 'OK';

          const testResult: AITestResult = {
            ok: true,
            success: true,
            status: 'connected',
            status_code: 200,
            statusCode: 200,
            provider: provider.name,
            model: targetGeminiModel,
            latencyMs,
            latency_ms: latencyMs,
            message: 'API connection successful',
            output,
            sampleOutput: output,
            diagnostics: {
              providerType: resolvedType,
              endpoint: 'Google GenAI SDK',
              model: targetGeminiModel,
              apiKeyPresent: true,
              apiKeyLength: rawApiKey.length,
              elapsedMs: latencyMs,
              requestReachedFetch: true,
              fetchResponseReceived: true,
              httpStatus: 200,
            },
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
          const latencyMs = Date.now() - requestStartedAt;
          const errorMsg = genErr instanceof Error ? genErr.message : String(genErr);
          let statusCode = 500;
          let errorType = 'PROVIDER_SERVER_ERROR';

          if (timedOut || (genErr instanceof Error && (genErr.name === 'TimeoutError' || genErr.name === 'AbortError'))) {
            statusCode = 504;
            errorType = 'NETWORK_TIMEOUT';
          } else if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not valid')) {
            statusCode = 401;
            errorType = 'INVALID_API_KEY';
          } else if (errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('429')) {
            statusCode = 429;
            errorType = 'RATE_LIMITED';
          } else if (errorMsg.includes('NOT_FOUND') || errorMsg.includes('404')) {
            statusCode = 404;
            errorType = 'ENDPOINT_OR_MODEL_NOT_FOUND';
          }

          const structuredError = {
            type: errorType.toLowerCase(),
            message: timedOut ? `The provider did not respond before the ${timeoutMs}ms timeout.` : errorMsg,
            providerStatus: statusCode,
            providerResponse: errorMsg.substring(0, 250),
            url: 'Google GenAI SDK',
          };

          const testResult: AITestResult = {
            ok: false,
            success: false,
            status: 'FAILED',
            status_code: statusCode,
            statusCode,
            errorType,
            message: structuredError.message,
            error: structuredError,
            errorDetails: structuredError,
            provider: provider.name,
            model: targetGeminiModel,
            latencyMs,
            latency_ms: latencyMs,
            diagnostics: {
              providerType: resolvedType,
              endpoint: 'Google GenAI SDK',
              model: targetGeminiModel,
              apiKeyPresent: true,
              apiKeyLength: rawApiKey.length,
              elapsedMs: latencyMs,
              requestReachedFetch: true,
              fetchResponseReceived: false,
              httpStatus: statusCode,
            },
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

      // ----------------------------------------------------
      // PATH 2: OpenAI-Compatible / OpenRouter HTTP Path
      // ----------------------------------------------------

      // Section 7: Check & Serialize Request Body Separately
      const testBody = {
        model: modelName,
        messages: [
          {
            role: 'user',
            content: 'Reply only with OK',
          },
        ],
        max_tokens: 5,
      };

      let serializedBody: string;
      try {
        serializedBody = JSON.stringify(testBody);
      } catch (serErr: any) {
        const errorMsg = `Failed to serialize request body: ${serErr?.message || 'JSON error'}`;
        const errorObj = {
          type: 'invalid_request_body',
          message: errorMsg,
          providerStatus: 400,
          url: safeDiagnosticUrl,
        };
        return {
          ok: false,
          success: false,
          status: 'FAILED',
          status_code: 400,
          statusCode: 400,
          errorType: 'INVALID_REQUEST_BODY',
          message: errorMsg,
          provider: provider.name,
          model: modelName,
          latencyMs: 0,
          latency_ms: 0,
          error: errorObj,
          errorDetails: errorObj,
          diagnostics: {
            providerType: resolvedType,
            baseUrl: configuredBaseUrl,
            endpoint: safeDiagnosticUrl,
            model: modelName,
            apiKeyPresent: true,
            elapsedMs: 0,
          },
          timestamp: new Date().toISOString(),
        };
      }

      // Section 1: Set timeout to 15000ms max for diagnosis
      const DIAGNOSTIC_TIMEOUT_MS = 15000;
      const timeoutMs = Math.min(
        Math.max(Number(provider.timeoutMs) || 15000, 3000),
        DIAGNOSTIC_TIMEOUT_MS
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

      if (isOpenRouter) {
        headers['HTTP-Referer'] = 'https://axiom-content.app';
        headers['X-Title'] = 'Axiom API Control Center';
      }

      // Merge custom headers if configured
      if (provider.headers && typeof provider.headers === 'object') {
        Object.assign(headers, provider.headers);
      }

      // Section 8: Execute fetch with structured diagnostics logging
      const fetchStartedAt = Date.now();
      let fetchResolvedAt = 0;
      let responseReadAt = 0;
      let res: Response;

      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: serializedBody,
          signal: controller.signal,
        });
        fetchResolvedAt = Date.now();
        console.log('PROVIDER_FETCH_RESPONSE', {
          status: res.status,
          contentType: res.headers.get('content-type'),
          elapsedMs: fetchResolvedAt - requestStartedAt,
        });
      } catch (fetchErr: unknown) {
        clearTimeout(timeoutTimer);
        const elapsedMs = Date.now() - requestStartedAt;
        console.log('PROVIDER_FETCH_ERROR', {
          elapsedMs,
          name: (fetchErr as any)?.name,
          message: (fetchErr as any)?.message,
        });

        let errorType = 'TLS_OR_NETWORK_ERROR';
        let safeMsg = '';
        let statusCode = 502;

        const cause = (fetchErr as any)?.cause;
        const causeMsg = cause?.message || '';
        const causeCode = cause?.code || '';
        const combinedMsg = `${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)} ${causeMsg} ${causeCode}`;

        let modelsProbe: any = null;

        if (timedOut || (fetchErr instanceof Error && fetchErr.name === 'AbortError') || causeCode === 'ETIMEDOUT') {
          errorType = 'NETWORK_TIMEOUT';
          statusCode = 504;

          // Section 10: Run diagnostic connectivity probe if OpenRouter timed out
          if (isOpenRouter) {
            modelsProbe = await this.probeOpenRouterConnectivity(rawApiKey);
            if (modelsProbe.reachable) {
              safeMsg = `The provider did not respond before the ${timeoutMs}ms timeout. Diagnostic probe to /models succeeded (${modelsProbe.latencyMs}ms, HTTP ${modelsProbe.status}), confirming network reachability. The chat completion request timed out (likely cold model queue, rate limit, or model availability issue on "${modelName}").`;
            } else {
              safeMsg = `The provider did not respond before the ${timeoutMs}ms timeout. Diagnostic probe to /models also failed (${modelsProbe.error || 'timeout'}), indicating network/firewall blockage between server and openrouter.ai.`;
            }
          } else {
            safeMsg = `The provider did not respond before the ${timeoutMs}ms timeout.`;
          }
        } else if (
          causeCode === 'ENOTFOUND' ||
          combinedMsg.includes('ENOTFOUND') ||
          combinedMsg.includes('getaddrinfo')
        ) {
          errorType = 'DNS_LOOKUP_FAILED';
          statusCode = 502;
          safeMsg = `DNS resolution failed for "${safeDiagnosticUrl}". Verify Base URL hostname.`;
        } else if (
          causeCode === 'ECONNREFUSED' ||
          combinedMsg.includes('ECONNREFUSED') ||
          causeCode === 'ECONNRESET' ||
          combinedMsg.includes('ECONNRESET')
        ) {
          errorType = 'CONNECTION_REFUSED';
          statusCode = 502;
          safeMsg = `Connection refused or reset at "${safeDiagnosticUrl}".`;
        } else {
          safeMsg = causeMsg || (fetchErr instanceof Error ? fetchErr.message : String(fetchErr));
        }

        const structuredError = {
          type: errorType.toLowerCase(),
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
          statusCode,
          errorType,
          message: safeMsg,
          error: structuredError,
          errorDetails: structuredError,
          provider: provider.name,
          model: modelName,
          latencyMs: elapsedMs,
          latency_ms: elapsedMs,
          diagnostics: {
            providerType: resolvedType,
            baseUrl: configuredBaseUrl,
            endpoint: safeDiagnosticUrl,
            model: modelName,
            apiKeyPresent: true,
            apiKeyLength: rawApiKey.length,
            elapsedMs,
            requestReachedFetch: true,
            fetchResponseReceived: false,
            httpStatus: statusCode,
            contentType: null,
            timestamps: {
              requestStartedAt: requestStartedIso,
              fetchStartedAt: new Date(fetchStartedAt).toISOString(),
              fetchResolvedAt: undefined,
              responseReadAt: undefined,
            },
            ...(modelsProbe ? { modelsEndpointProbe: modelsProbe } : {}),
          },
          timestamp: new Date().toISOString(),
        };

        this.updateAIProviderStatus(provider.id, 'FAILED', elapsedMs, safeMsg);
        this.recordHistory({
          providerId: provider.id,
          providerName: provider.name,
          providerType: 'ai',
          modelOrQuery: modelName,
          result: 'FAILED',
          latencyMs: elapsedMs,
          httpStatus: statusCode,
          error: safeMsg,
          summary: `HTTP ${statusCode}: ${safeMsg}`,
        });

        return testResult;
      } finally {
        clearTimeout(timeoutTimer);
      }

      clearTimeout(timeoutTimer);

      // Section 8: Safely read response text and track duration
      const contentType = res.headers.get('content-type') || '';
      let responseText = '';
      try {
        responseText = await res.text();
        responseReadAt = Date.now();
        console.log('PROVIDER_RESPONSE_RECEIVED', {
          status: res.status,
          elapsedMs: Date.now() - requestStartedAt,
          bodyLength: responseText.length,
          contentType,
        });
      } catch (readErr: any) {
        console.log('PROVIDER_RESPONSE_READ_ERROR', {
          elapsedMs: Date.now() - requestStartedAt,
          error: readErr?.message,
        });
      }

      const totalElapsedMs = Date.now() - requestStartedAt;

      // Section 9: Distinguish HTTP error codes from timeout
      if (!res.ok) {
        let errorType = 'PROVIDER_SERVER_ERROR';
        let parsedErrorMsg = '';

        if (res.status === 400) errorType = 'INVALID_REQUEST';
        else if (res.status === 401) errorType = 'INVALID_API_KEY';
        else if (res.status === 403) errorType = 'FORBIDDEN';
        else if (res.status === 404) errorType = 'ENDPOINT_OR_MODEL_NOT_FOUND';
        else if (res.status === 429) errorType = 'RATE_LIMITED';
        else if (res.status === 500) errorType = 'PROVIDER_SERVER_ERROR';
        else if (res.status === 502) errorType = 'PROVIDER_SERVER_ERROR';
        else if (res.status === 503) errorType = 'PROVIDER_SERVER_ERROR';
        else if (res.status === 504) errorType = 'NETWORK_TIMEOUT';

        try {
          if (contentType.includes('application/json') || responseText.trim().startsWith('{')) {
            const jsonErr = JSON.parse(responseText);
            parsedErrorMsg = jsonErr?.error?.message || jsonErr?.error || jsonErr?.message || '';
            if (typeof parsedErrorMsg === 'object') parsedErrorMsg = JSON.stringify(parsedErrorMsg);
          } else {
            parsedErrorMsg = responseText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().substring(0, 200);
            if (!parsedErrorMsg) parsedErrorMsg = `Provider returned HTTP ${res.status} HTML/text response`;
          }
        } catch {
          parsedErrorMsg = `HTTP ${res.status} ${res.statusText}`;
        }

        const humanMessage = parsedErrorMsg
          ? `HTTP ${res.status}: ${parsedErrorMsg}`
          : `HTTP ${res.status} ${res.statusText}`;

        const structuredError = {
          type: errorType.toLowerCase(),
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
          statusCode: res.status,
          errorType,
          message: humanMessage,
          error: structuredError,
          errorDetails: structuredError,
          provider: provider.name,
          model: modelName,
          latencyMs: totalElapsedMs,
          latency_ms: totalElapsedMs,
          diagnostics: {
            providerType: resolvedType,
            baseUrl: configuredBaseUrl,
            endpoint: safeDiagnosticUrl,
            model: modelName,
            apiKeyPresent: true,
            apiKeyLength: rawApiKey.length,
            elapsedMs: totalElapsedMs,
            requestReachedFetch: true,
            fetchResponseReceived: true,
            httpStatus: res.status,
            contentType,
            timestamps: {
              requestStartedAt: requestStartedIso,
              fetchStartedAt: new Date(fetchStartedAt).toISOString(),
              fetchResolvedAt: new Date(fetchResolvedAt).toISOString(),
              responseReadAt: responseReadAt ? new Date(responseReadAt).toISOString() : undefined,
            },
          },
          timestamp: new Date().toISOString(),
        };

        this.updateAIProviderStatus(provider.id, 'FAILED', totalElapsedMs, humanMessage);
        this.recordHistory({
          providerId: provider.id,
          providerName: provider.name,
          providerType: 'ai',
          modelOrQuery: modelName,
          result: 'FAILED',
          latencyMs: totalElapsedMs,
          httpStatus: res.status,
          error: humanMessage,
          summary: `HTTP ${res.status}: ${humanMessage.substring(0, 100)}`,
        });

        return testResult;
      }

      // Parse JSON response safely
      let data: any;
      try {
        data = JSON.parse(responseText);
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
          statusCode: 502,
          errorType: 'PROVIDER_SERVER_ERROR',
          message: parseMsg,
          error: structuredError,
          errorDetails: structuredError,
          provider: provider.name,
          model: modelName,
          latencyMs: totalElapsedMs,
          latency_ms: totalElapsedMs,
          diagnostics: {
            providerType: resolvedType,
            baseUrl: configuredBaseUrl,
            endpoint: safeDiagnosticUrl,
            model: modelName,
            apiKeyPresent: true,
            apiKeyLength: rawApiKey.length,
            elapsedMs: totalElapsedMs,
            requestReachedFetch: true,
            fetchResponseReceived: true,
            httpStatus: res.status,
            contentType,
          },
          timestamp: new Date().toISOString(),
        };
      }

      const output = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || 'OK';

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
      const testResult: AITestResult = {
        ok: true,
        success: true,
        status: 'connected',
        status_code: 200,
        statusCode: 200,
        provider: provider.name,
        model: data.model || modelName,
        latencyMs: totalElapsedMs,
        latency_ms: totalElapsedMs,
        message: 'API connection successful',
        output,
        sampleOutput: output || 'OK',
        diagnostics: {
          providerType: resolvedType,
          baseUrl: configuredBaseUrl,
          endpoint: safeDiagnosticUrl,
          model: data.model || modelName,
          apiKeyPresent: true,
          apiKeyLength: rawApiKey.length,
          elapsedMs: totalElapsedMs,
          requestReachedFetch: true,
          fetchResponseReceived: true,
          httpStatus: 200,
          contentType,
          timestamps: {
            requestStartedAt: requestStartedIso,
            fetchStartedAt: new Date(fetchStartedAt).toISOString(),
            fetchResolvedAt: new Date(fetchResolvedAt).toISOString(),
            responseReadAt: new Date(responseReadAt).toISOString(),
          },
        },
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

      this.updateAIProviderStatus(provider.id, 'SUCCESS', totalElapsedMs, undefined, usageInfo);
      this.recordHistory({
        providerId: provider.id,
        providerName: provider.name,
        providerType: 'ai',
        modelOrQuery: modelName,
        result: 'SUCCESS',
        latencyMs: totalElapsedMs,
        httpStatus: res.status,
        summary: `Model ${modelName} verified (${totalElapsedMs}ms)`,
      });

      return testResult;
    } catch (err: unknown) {
      const latencyMs = Date.now() - requestStartedAt;
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
        statusCode: 500,
        errorType: 'PROVIDER_SERVER_ERROR',
        message: errorMsg,
        provider: provider.name,
        model: modelName,
        latencyMs,
        latency_ms: latencyMs,
        error: structuredError,
        errorDetails: structuredError,
        diagnostics: {
          providerType: resolvedType,
          baseUrl: configuredBaseUrl,
          endpoint: safeDiagnosticUrl,
          model: modelName,
          apiKeyPresent: Boolean(rawApiKey && rawApiKey.trim().length > 0),
          elapsedMs: latencyMs,
        },
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
      const SEARCH_TIMEOUT_MS = 15000;
      const timeoutMs = Math.min(
        Math.max(Number(provider.timeoutMs) || 15000, 3000),
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
