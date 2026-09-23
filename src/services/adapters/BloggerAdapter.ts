/**
 * Axiom Blogger Adapter
 * Supports Blogger API v3 operations: testConnection, publishPost
 */

import { BloggerIntegration, IntegrationTestResult } from '../../types/integrations.ts';

export class BloggerAdapter {
  private static instance: BloggerAdapter;

  public static getInstance(): BloggerAdapter {
    if (!BloggerAdapter.instance) {
      BloggerAdapter.instance = new BloggerAdapter();
    }
    return BloggerAdapter.instance;
  }

  /**
   * Tests connection to Google Blogger API v3.
   * Real connection test with latency measurement and error diagnostics.
   */
  public async testConnection(integration: BloggerIntegration): Promise<IntegrationTestResult> {
    const startTime = performance.now();
    try {
      if (!integration.blogId) {
        return {
          success: false,
          status: 'FAILED',
          latencyMs: Math.round(performance.now() - startTime),
          error: 'Blog ID is required to test Blogger connection.',
        };
      }

      const res = await fetch('/api/integrations/blogger/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration }),
      });

      const latencyMs = Math.round(performance.now() - startTime);
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        return {
          success: false,
          status: 'FAILED',
          latencyMs,
          error: data?.error || `Blogger API responded with HTTP ${res.status}`,
          details: data?.details,
        };
      }

      return {
        success: true,
        status: 'CONNECTED',
        latencyMs: data.latencyMs || latencyMs,
        message: data.message || `Successfully connected to blog "${data.blogName || integration.name}"`,
        details: data.details,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED',
        latencyMs: Math.round(performance.now() - startTime),
        error: err?.message || 'Network error attempting to contact Blogger API',
      };
    }
  }

  /**
   * Publishes an article post to Google Blogger.
   */
  public async publishPost(
    integration: BloggerIntegration,
    post: {
      title: string;
      contentHtml: string;
      labels?: string[];
      isDraft?: boolean;
    }
  ): Promise<{ success: boolean; postId?: string; url?: string; error?: string }> {
    try {
      const res = await fetch('/api/integrations/blogger/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration, post }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        return {
          success: false,
          error: data?.error || `Failed to publish post: HTTP ${res.status}`,
        };
      }

      return {
        success: true,
        postId: data.postId,
        url: data.url,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Network error publishing to Blogger',
      };
    }
  }
}

export const bloggerAdapter = BloggerAdapter.getInstance();
