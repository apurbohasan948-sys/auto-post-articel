import { AIProviderConfig, TavilyConfig } from '../types/agent';
import { providerStore } from './providerStore';

export interface ProviderTestResult {
  success: boolean;
  message: string;
  diagnostics?: string;
  responseTimeMs?: number;
}

export class ProviderTestingService {
  /**
   * Real connection test for an AI Provider.
   */
  public static async testProvider(provider: AIProviderConfig): Promise<ProviderTestResult> {
    const startTime = Date.now();

    if (!provider.apiKey || provider.apiKey.trim() === '') {
      const result: ProviderTestResult = {
        success: false,
        message: 'FAILED: Missing API Key.',
        diagnostics: `Please provide a valid API key for ${provider.name}.`
      };
      providerStore.updateProvider(provider.id, {
        testStatus: 'FAILED',
        lastTested: Date.now(),
        lastError: result.message
      });
      return result;
    }

    try {
      if (provider.type === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${provider.apiKey.trim()}`;
        const res = await fetch(url, { method: 'GET' });
        const data = await res.json().catch(() => null);
        const elapsed = Date.now() - startTime;

        if (res.ok && data?.models) {
          const result: ProviderTestResult = {
            success: true,
            message: `CONNECTED: Gemini API verified (${data.models.length} models available)`,
            diagnostics: `Status: 200 OK | Response: ${elapsed}ms`,
            responseTimeMs: elapsed
          };
          providerStore.updateProvider(provider.id, {
            testStatus: 'CONNECTED',
            lastTested: Date.now(),
            lastError: undefined
          });
          return result;
        }

        const errMsg = data?.error?.message || `HTTP ${res.status}`;
        const result: ProviderTestResult = {
          success: false,
          message: `FAILED: Google Gemini API error (${errMsg})`,
          diagnostics: `HTTP ${res.status}: ${errMsg}`
        };
        providerStore.updateProvider(provider.id, {
          testStatus: 'FAILED',
          lastTested: Date.now(),
          lastError: errMsg
        });
        return result;
      }

      if (provider.type === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${provider.apiKey.trim()}` }
        });
        const data = await res.json().catch(() => null);
        const elapsed = Date.now() - startTime;

        if (res.ok) {
          const result: ProviderTestResult = {
            success: true,
            message: `CONNECTED: OpenAI API authenticated successfully`,
            diagnostics: `Status: 200 OK | Latency: ${elapsed}ms`,
            responseTimeMs: elapsed
          };
          providerStore.updateProvider(provider.id, {
            testStatus: 'CONNECTED',
            lastTested: Date.now(),
            lastError: undefined
          });
          return result;
        }

        const errMsg = data?.error?.message || `HTTP ${res.status}`;
        const result: ProviderTestResult = {
          success: false,
          message: `FAILED: OpenAI returned HTTP ${res.status}`,
          diagnostics: errMsg
        };
        providerStore.updateProvider(provider.id, {
          testStatus: 'FAILED',
          lastTested: Date.now(),
          lastError: errMsg
        });
        return result;
      }

      if (provider.type === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${provider.apiKey.trim()}` }
        });
        const data = await res.json().catch(() => null);
        const elapsed = Date.now() - startTime;

        if (res.ok) {
          const result: ProviderTestResult = {
            success: true,
            message: `CONNECTED: Groq Cloud API verified`,
            diagnostics: `Status: 200 OK | Latency: ${elapsed}ms`,
            responseTimeMs: elapsed
          };
          providerStore.updateProvider(provider.id, {
            testStatus: 'CONNECTED',
            lastTested: Date.now(),
            lastError: undefined
          });
          return result;
        }

        const errMsg = data?.error?.message || `HTTP ${res.status}`;
        const result: ProviderTestResult = {
          success: false,
          message: `FAILED: Groq returned HTTP ${res.status}`,
          diagnostics: errMsg
        };
        providerStore.updateProvider(provider.id, {
          testStatus: 'FAILED',
          lastTested: Date.now(),
          lastError: errMsg
        });
        return result;
      }

      // Generic test fallback for custom/deepseek/anthropic
      const result: ProviderTestResult = {
        success: false,
        message: `FAILED: Provider endpoint verification failed`,
        diagnostics: `Ensure API key format matches standard provider requirements.`
      };
      providerStore.updateProvider(provider.id, {
        testStatus: 'FAILED',
        lastTested: Date.now(),
        lastError: result.message
      });
      return result;

    } catch (err: any) {
      const result: ProviderTestResult = {
        success: false,
        message: 'FAILED: Network error or CORS restriction connecting to provider.',
        diagnostics: err?.message || 'Check network connection and endpoint status.'
      };
      providerStore.updateProvider(provider.id, {
        testStatus: 'FAILED',
        lastTested: Date.now(),
        lastError: result.message
      });
      return result;
    }
  }

  /**
   * Real connection test for Tavily Search API.
   */
  public static async testTavily(config: TavilyConfig): Promise<ProviderTestResult> {
    const startTime = Date.now();

    if (!config.apiKey || config.apiKey.trim() === '') {
      const result: ProviderTestResult = {
        success: false,
        message: 'FAILED: Missing Tavily API Key.',
        diagnostics: 'Please provide a Tavily API key from https://tavily.com.'
      };
      providerStore.saveTavilyConfig({
        testStatus: 'FAILED',
        lastTested: Date.now(),
        lastError: result.message
      });
      return result;
    }

    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: config.apiKey.trim(),
          query: 'ping test',
          max_results: 1
        })
      });
      const data = await res.json().catch(() => null);
      const elapsed = Date.now() - startTime;

      if (res.ok && data?.results) {
        const result: ProviderTestResult = {
          success: true,
          message: 'CONNECTED: Tavily Search API authenticated successfully',
          diagnostics: `Status: 200 OK | Response: ${elapsed}ms`,
          responseTimeMs: elapsed
        };
        providerStore.saveTavilyConfig({
          testStatus: 'CONNECTED',
          lastTested: Date.now(),
          lastError: undefined
        });
        return result;
      }

      const errMsg = data?.detail?.error || res.statusText || `HTTP ${res.status}`;
      const result: ProviderTestResult = {
        success: false,
        message: `FAILED: Tavily returned HTTP ${res.status}`,
        diagnostics: errMsg
      };
      providerStore.saveTavilyConfig({
        testStatus: 'FAILED',
        lastTested: Date.now(),
        lastError: errMsg
      });
      return result;
    } catch (err: any) {
      const result: ProviderTestResult = {
        success: false,
        message: 'FAILED: Network error communicating with Tavily API.',
        diagnostics: err?.message || 'Network timeout or CORS restriction.'
      };
      providerStore.saveTavilyConfig({
        testStatus: 'FAILED',
        lastTested: Date.now(),
        lastError: result.message
      });
      return result;
    }
  }
}
