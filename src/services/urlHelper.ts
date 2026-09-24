/**
 * URL and Diagnostic Utilities for Axiom Provider Services
 * Provides robust URL normalization to prevent duplicate paths like /v1/v1 or duplicate /chat/completions.
 */

/**
 * Normalizes OpenAI-compatible base URL to chat completions endpoint.
 * Handles:
 * - https://example.com -> https://example.com/v1/chat/completions
 * - https://example.com/ -> https://example.com/v1/chat/completions
 * - https://example.com/v1 -> https://example.com/v1/chat/completions
 * - https://example.com/v1/ -> https://example.com/v1/chat/completions
 * - https://example.com/v1/chat/completions -> https://example.com/v1/chat/completions
 * - https://openrouter.ai/api/v1 -> https://openrouter.ai/api/v1/chat/completions
 * - https://openrouter.ai/api/v1/ -> https://openrouter.ai/api/v1/chat/completions
 * - Avoids duplicate /v1/v1 or duplicate /chat/completions
 */
/**
 * Normalizes OpenRouter URL to chat completions endpoint.
 * Always resolves to https://openrouter.ai/api/v1/chat/completions unless an explicit custom proxy is configured.
 */
export function normalizeOpenRouterUrl(rawBaseUrl?: string): string {
  let clean = (rawBaseUrl || '').trim();

  if (
    !clean ||
    clean === 'https://openrouter.ai' ||
    clean === 'https://openrouter.ai/' ||
    clean === 'https://openrouter.ai/api' ||
    clean === 'https://openrouter.ai/api/' ||
    clean === 'https://openrouter.ai/api/v1' ||
    clean === 'https://openrouter.ai/api/v1/' ||
    clean === 'https://openrouter.ai/v1' ||
    clean === 'https://openrouter.ai/v1/'
  ) {
    return 'https://openrouter.ai/api/v1/chat/completions';
  }

  // Remove duplicate slashes (except in protocol ://)
  clean = clean.replace(/([^:]\/)\/+/g, '$1');
  clean = clean.replace(/\/+$/, '');

  if (clean.endsWith('/chat/completions')) {
    return clean;
  }
  if (clean.endsWith('/chat')) {
    return `${clean}/completions`;
  }
  if (clean.endsWith('/api/v1')) {
    return `${clean}/chat/completions`;
  }
  if (clean.endsWith('/v1')) {
    if (clean.includes('openrouter.ai')) {
      return 'https://openrouter.ai/api/v1/chat/completions';
    }
    return `${clean}/chat/completions`;
  }
  if (clean.endsWith('/api')) {
    return `${clean}/v1/chat/completions`;
  }
  if (clean.includes('openrouter.ai') && !clean.includes('/api/v1')) {
    return 'https://openrouter.ai/api/v1/chat/completions';
  }

  return normalizeOpenAICompatibleUrl(clean);
}

/**
 * Normalizes OpenAI-compatible base URL to chat completions endpoint.
 * Handles:
 * - https://example.com/v1 -> https://example.com/v1/chat/completions
 * - https://example.com/v1/ -> https://example.com/v1/chat/completions
 * - https://example.com/v1/chat/completions -> https://example.com/v1/chat/completions
 * - https://example.com -> https://example.com/v1/chat/completions
 * - https://example.com/ -> https://example.com/v1/chat/completions
 * - Avoids duplicate /v1/v1, /chat/completions/chat/completions, or //chat/completions
 */
export function normalizeOpenAICompatibleUrl(rawBaseUrl?: string): string {
  let clean = (rawBaseUrl || '').trim();

  if (!clean) {
    return 'https://api.openai.com/v1/chat/completions';
  }

  // Remove duplicate slashes (except in protocol ://)
  clean = clean.replace(/([^:]\/)\/+/g, '$1');

  // Strip trailing slashes
  clean = clean.replace(/\/+$/, '');

  // Eliminate duplicate /v1 repeated sequences (e.g. /v1/v1 -> /v1)
  clean = clean.replace(/(\/v1)+/g, '/v1');

  // Strip duplicate repeated /chat/completions sequences
  clean = clean.replace(/(\/chat\/completions)+/g, '/chat/completions');

  // If already ends with /chat/completions, return as is
  if (clean.endsWith('/chat/completions')) {
    return clean;
  }

  // If ends with /chat
  if (clean.endsWith('/chat')) {
    return `${clean}/completions`;
  }

  // If ends with /v1
  if (clean.endsWith('/v1')) {
    return `${clean}/chat/completions`;
  }

  // If ends with /v1/chat
  if (clean.endsWith('/v1/chat')) {
    return `${clean}/completions`;
  }

  // If it contains /v1/chat/completions
  if (clean.includes('/v1/chat/completions')) {
    const idx = clean.indexOf('/v1/chat/completions');
    return clean.substring(0, idx + '/v1/chat/completions'.length);
  }

  // If it already contains /chat/completions somewhere in the path
  if (clean.includes('/chat/completions')) {
    const idx = clean.indexOf('/chat/completions');
    return clean.substring(0, idx + '/chat/completions'.length);
  }

  // If it has /v1/ in the path
  if (clean.includes('/v1/')) {
    const v1Index = clean.lastIndexOf('/v1/');
    const afterV1 = clean.substring(v1Index + 4);
    if (afterV1 === 'chat/completions') {
      return clean;
    }
    if (afterV1 === 'chat') {
      return `${clean}/completions`;
    }
    return `${clean.substring(0, v1Index + 3)}/chat/completions`;
  }

  // If it's a domain or standard base without /v1 and without /chat
  if (!clean.includes('/v1') && !clean.includes('/chat')) {
    return `${clean}/v1/chat/completions`;
  }

  return `${clean}/chat/completions`;
}

/**
 * Routes to the correct endpoint normalizer based on provider type.
 */
export function normalizeProviderEndpoint(providerType?: string, rawBaseUrl?: string): string {
  const t = (providerType || '').toLowerCase().trim();
  if (t === 'openrouter' || t.includes('openrouter')) {
    return normalizeOpenRouterUrl(rawBaseUrl);
  }
  return normalizeOpenAICompatibleUrl(rawBaseUrl);
}

// Retain alias for backwards compatibility
export const normalizeChatCompletionsUrl = normalizeOpenAICompatibleUrl;

/**
 * Normalizes Tavily search endpoint.
 * Handles:
 * - https://api.tavily.com -> https://api.tavily.com/search
 * - https://api.tavily.com/ -> https://api.tavily.com/search
 * - https://api.tavily.com/search -> https://api.tavily.com/search
 */
export function normalizeTavilySearchUrl(rawBaseUrl?: string): string {
  let clean = (rawBaseUrl || 'https://api.tavily.com').trim().replace(/\/+$/, '');
  if (clean.endsWith('/search')) {
    return clean;
  }
  return `${clean}/search`;
}

/**
 * Strips secret tokens and sensitive headers from previews to prevent leakage in debug logs.
 */
export function sanitizeDiagnosticsPreview(text: string): string {
  if (!text) return '';
  return text
    .replace(/Bearer\s+[A-Za-z0-9_\-\.]{8,}/gi, 'Bearer [REDACTED]')
    .replace(/api[_\-]?key["']?\s*[:=]\s*["']?[A-Za-z0-9_\-\.]{8,}["']?/gi, 'apiKey: "[REDACTED]"')
    .replace(/sk-[A-Za-z0-9_\-]{15,}/gi, 'sk-[REDACTED]')
    .replace(/tvly-[A-Za-z0-9_\-]{15,}/gi, 'tvly-[REDACTED]');
}
