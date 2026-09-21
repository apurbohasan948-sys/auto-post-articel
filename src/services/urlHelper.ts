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
export function normalizeChatCompletionsUrl(rawBaseUrl?: string): string {
  let clean = (rawBaseUrl || '').trim();

  // Strip trailing slashes
  clean = clean.replace(/\/+$/, '');

  if (!clean) {
    return 'https://api.openai.com/v1/chat/completions';
  }

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

  // If it has /v1/ in the middle, check what follows
  if (clean.includes('/v1/')) {
    const afterV1 = clean.substring(clean.lastIndexOf('/v1/') + 4);
    if (afterV1 === 'chat/completions') {
      return clean;
    }
    if (afterV1 === 'chat') {
      return `${clean}/completions`;
    }
    return `${clean}/chat/completions`;
  }

  // If it's a known domain or standard base without /v1 (e.g., https://api.openai.com or https://openrouter.ai/api)
  if (!clean.includes('/v1') && !clean.includes('/chat')) {
    return `${clean}/v1/chat/completions`;
  }

  return `${clean}/chat/completions`;
}

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
