/**
 * Axiom AI Provider Manager
 * Supports OpenRouter, Gemini (via @google/genai), and custom OpenAI-compatible endpoints.
 * Implements fallback chains, exponential backoff, rate limits, and structured JSON parsing.
 */

import { GoogleGenAI } from '@google/genai';
import { AIProviderConfig } from '../types/agent.ts';
import { StorageService } from './storage.ts';

export interface PromptPayload {
  systemPrompt: string;
  userPrompt: string;
  responseSchemaName?: string;
  maxTokens?: number;
  temperature?: number;
}

export class AIProviderManager {
  private static instance: AIProviderManager;
  private storage: StorageService;
  private geminiClient: GoogleGenAI | null = null;

  private constructor() {
    this.storage = StorageService.getInstance();
  }

  public static getInstance(): AIProviderManager {
    if (!AIProviderManager.instance) {
      AIProviderManager.instance = new AIProviderManager();
    }
    return AIProviderManager.instance;
  }

  private getGemini(): GoogleGenAI {
    if (!this.geminiClient) {
      const apiKey = process.env.GEMINI_API_KEY || '';
      this.geminiClient = new GoogleGenAI({ apiKey });
    }
    return this.geminiClient;
  }

  /**
   * Executes structured JSON completion with multi-provider fallback.
   */
  public async executeStructuredCompletion<T>(
    payload: PromptPayload,
    jobId?: string
  ): Promise<{ data: T; providerUsed: string; latencyMs: number }> {
    const settings = this.storage.getSettings();

    // 1. Cost & rate limit check
    if (settings.todayStats.aiCalls >= settings.maxAiCallsPerDay) {
      const err = `Daily AI call ceiling exceeded (${settings.todayStats.aiCalls}/${settings.maxAiCallsPerDay}). Pausing job to prevent unexpected billing.`;
      this.storage.addLog({
        agentName: 'AIProviderManager',
        level: 'WARN',
        message: err,
        jobId,
      });
      throw new Error(err);
    }

    const providers = this.storage
      .getAIProviders()
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    if (providers.length === 0) {
      throw new Error('No AI providers enabled or configured in system settings.');
    }

    const errors: string[] = [];

    for (const provider of providers) {
      const startTime = Date.now();
      try {
        this.storage.addLog({
          agentName: 'AIProviderManager',
          level: 'INFO',
          message: `Attempting completion with [${provider.name}] (${provider.modelName})...`,
          jobId,
        });

        let rawResponse: string;

        if (provider.type === 'gemini') {
          rawResponse = await this.callGemini(provider, payload);
        } else if (provider.type === 'openrouter' || provider.type === 'openai-compatible' || provider.type === 'custom') {
          rawResponse = await this.callOpenAICompatible(provider, payload);
        } else {
          throw new Error(`Unsupported provider type: ${provider.type}`);
        }

        // Increment today's stats
        settings.todayStats.aiCalls += 1;
        this.storage.updateSettings({ todayStats: settings.todayStats });

        // Parse structured JSON cleanly
        const parsed = this.cleanAndParseJSON<T>(rawResponse);
        const latencyMs = Date.now() - startTime;

        this.storage.addLog({
          agentName: 'AIProviderManager',
          level: 'SUCCESS',
          message: `Completion succeeded via [${provider.name}] in ${latencyMs}ms.`,
          jobId,
        });

        return {
          data: parsed,
          providerUsed: provider.name,
          latencyMs,
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push(`[${provider.name}]: ${errorMsg}`);
        this.storage.addLog({
          agentName: 'AIProviderManager',
          level: 'WARN',
          message: `Provider [${provider.name}] failed: ${errorMsg}. Rolling to next fallback...`,
          jobId,
        });
      }
    }

    // If all providers failed, check if we have built-in algorithmic generator as ultimate safety
    throw new Error(`All configured AI providers failed: ${errors.join(' | ')}`);
  }

  private async callGemini(provider: AIProviderConfig, payload: PromptPayload): Promise<string> {
    const apiKey = provider.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing Gemini API Key. Provide it in AI Providers or GEMINI_API_KEY environment variable.');
    }

    const ai = this.getGemini();
    const model = provider.modelName || 'gemini-3.8-flash';

    const promptText = `${payload.systemPrompt}\n\nStrict Requirement: Return ONLY valid, raw JSON matching the required schema. Do NOT enclose in markdown backticks or commentary.\n\n${payload.userPrompt}`;

    const response = await ai.models.generateContent({
      model,
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
        temperature: payload.temperature ?? 0.3,
        maxOutputTokens: payload.maxTokens ?? 3500,
      },
    });

    if (!response.text) {
      throw new Error('Empty response received from Gemini.');
    }

    return response.text;
  }

  private async callOpenAICompatible(
    provider: AIProviderConfig,
    payload: PromptPayload
  ): Promise<string> {
    if (!provider.apiKey) {
      throw new Error(`Missing API Key for [${provider.name}]. Configure it in settings or environment.`);
    }

    const baseUrl = provider.baseUrl || (provider.type === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < provider.maxRetries) {
      attempt++;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), provider.timeoutMs || 45000);

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        };

        if (provider.type === 'openrouter') {
          headers['HTTP-Referer'] = 'https://axiom-content.app';
          headers['X-Title'] = 'Axiom Autonomous Content Agent';
        }

        const body = JSON.stringify({
          model: provider.modelName,
          messages: [
            {
              role: 'system',
              content: `${payload.systemPrompt}\n\nYou MUST respond with valid JSON ONLY. No preamble, no backticks, no explanations.`,
            },
            {
              role: 'user',
              content: payload.userPrompt,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: payload.temperature ?? 0.3,
          max_tokens: payload.maxTokens ?? 3500,
        });

        const res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }

        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('Received malformed response with no choices content.');
        }

        return content;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < provider.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`Failed after ${provider.maxRetries} attempts`);
  }

  private cleanAndParseJSON<T>(raw: string): T {
    let clean = raw.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    try {
      return JSON.parse(clean) as T;
    } catch {
      // Find outermost brace if there is surrounding commentary
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      if (start >= 0 && end > start) {
        const sliced = clean.slice(start, end + 1);
        return JSON.parse(sliced) as T;
      }
      throw new Error(`Failed to parse structured JSON from LLM: ${clean.substring(0, 150)}...`);
    }
  }
}
