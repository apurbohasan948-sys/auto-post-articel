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
import { normalizeChatCompletionsUrl, normalizeTavilySearchUrl } from './urlHelper.ts';

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
   * Tests an AI provider with either a quick ping or custom playground prompt.
   * Follows strict 8-step server-side validation:
   * 1. Validate provider config
   * 2. Validate Base URL
   * 3. Validate Model Name
   * 4. Validate API key
   * 5. Send minimal test request
   * 6. Receive provider response
   * 7. Validate response
   * 8. Return normalized JSON
   */
  public async testAIProvider(
    provider: AIProviderConfig,
    prompt: string = 'Write one short sentence about technology.'
  ): Promise<AITestResult> {
    const startTime = Date.now();

    // 1. Validate provider configuration
    if (!provider || !provider.name) {
      return {
        success: false,
        status: 'FAILED',
        status_code: 400,
        provider: provider?.name || 'Unknown',
        model: 'unspecified',
        latencyMs: 0,
        latency_ms: 0,
        error: 'Invalid provider configuration payload.',
        timestamp: new Date().toISOString(),
      };
    }

    // 2. Validate Model Name
    const modelName = (provider.modelName || provider.defaultModel || '').trim();
    if (!modelName) {
      const errorMsg = `Model name is required for testing provider "${provider.name}".`;
      return {
        success: false,
        status: 'FAILED',
        status_code: 400,
        provider: provider.name,
        model: 'unspecified',
        latencyMs: 0,
        latency_ms: 0,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }

    // 3. Validate Base URL for HTTP/OpenAI endpoints
    let endpoint = '';
    if (provider.type !== 'gemini') {
      const defaultBase = provider.type === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1';
      const rawBase = (provider.baseUrl || defaultBase).trim();

      try {
        const parsed = new URL(rawBase);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('Base URL protocol must be http:// or https://');
        }
        endpoint = normalizeChatCompletionsUrl(rawBase);
      } catch (urlErr) {
        const errorMsg = `Invalid Base URL: "${rawBase}". Expected a valid URL (e.g. https://openrouter.ai/api/v1).`;
        return {
          success: false,
          status: 'FAILED',
          status_code: 400,
          provider: provider.name,
          model: modelName,
          latencyMs: 0,
          latency_ms: 0,
          error: errorMsg,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 4. Validate API key
    let rawApiKey = decryptSecret(provider.apiKey);
    if (!rawApiKey) {
      if (provider.type === 'gemini') {
        rawApiKey = process.env.GEMINI_API_KEY || '';
      } else if (provider.type === 'openrouter') {
        rawApiKey = process.env.OPENROUTER_API_KEY || '';
      }
    }

    if (!rawApiKey && provider.type !== 'custom') {
      const result: AITestResult = {
        success: false,
        status: 'FAILED',
        status_code: 401,
        provider: provider.name,
        model: modelName,
        latencyMs: 0,
        latency_ms: 0,
        error: `No API key configured for ${provider.name}. Please supply a valid key.`,
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
        error: result.error,
        summary: 'Missing API key',
      });
      return result;
    }

    try {
      if (provider.type === 'gemini') {
        const ai = new GoogleGenAI({ apiKey: rawApiKey });
        const targetGeminiModel = modelName || 'gemini-2.5-flash';

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), provider.timeoutMs || 30000);

        try {
          const response = await ai.models.generateContent({
            model: targetGeminiModel,
            contents: prompt,
            config: {
              maxOutputTokens: 120,
              temperature: 0.3,
            },
          });
          clearTimeout(timeout);

          const latencyMs = Date.now() - startTime;
          const output = response.text || '';

          const testResult: AITestResult = {
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
          clearTimeout(timeout);
          throw genErr;
        }
      }

      // 5. Send minimal test request to OpenAI-compatible / OpenRouter / Custom endpoints
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), provider.timeoutMs || 35000);

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

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 120,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;

      // 6. Receive provider response & handle errors
      if (!res.ok) {
        let errMessage = `HTTP ${res.status} ${res.statusText}`;
        try {
          const errBody = await res.json();
          if (errBody.error?.message) {
            errMessage = errBody.error.message;
          } else if (typeof errBody.error === 'string') {
            errMessage = errBody.error;
          } else if (errBody.message) {
            errMessage = errBody.message;
          }
        } catch {
          const txt = await res.text();
          if (txt) errMessage = txt.substring(0, 200);
        }

        const testResult: AITestResult = {
          success: false,
          status: 'FAILED',
          status_code: res.status,
          provider: provider.name,
          model: modelName,
          latencyMs,
          latency_ms: latencyMs,
          error: errMessage,
          timestamp: new Date().toISOString(),
        };

        this.updateAIProviderStatus(provider.id, 'FAILED', latencyMs, errMessage);
        this.recordHistory({
          providerId: provider.id,
          providerName: provider.name,
          providerType: 'ai',
          modelOrQuery: modelName,
          result: 'FAILED',
          latencyMs,
          httpStatus: res.status,
          error: errMessage,
          summary: `HTTP ${res.status}: ${errMessage}`,
        });

        return testResult;
      }

      // 7. Validate response payload
      const data = await res.json();
      const output = data.choices?.[0]?.message?.content || '';

      // Check usage headers or body
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

      // Check OpenRouter account usage if openrouter
      if (provider.type === 'openrouter') {
        const extraUsage = await this.fetchOpenRouterUsage(rawApiKey);
        if (extraUsage.hasUsageData) {
          usageInfo = { ...usageInfo, ...extraUsage };
        }
      }

      // 8. Return normalized JSON to frontend
      const testResult: AITestResult = {
        success: true,
        status: 'connected',
        status_code: res.status,
        provider: provider.name,
        model: data.model || modelName,
        latencyMs,
        latency_ms: latencyMs,
        message: 'API connection successful',
        output,
        sampleOutput: output,
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

      const testResult: AITestResult = {
        success: false,
        status: 'FAILED',
        status_code: 500,
        provider: provider.name,
        model: modelName,
        latencyMs,
        latency_ms: latencyMs,
        error: errorMsg,
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
        summary: `Network / Timeout Error: ${errorMsg}`,
      });

      return testResult;
    }
  }

  /**
   * Fetches OpenRouter API key limits and credits if available.
   */
  public async fetchOpenRouterUsage(apiKey: string): Promise<ProviderUsageInfo> {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), provider.timeoutMs || 25000);

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
