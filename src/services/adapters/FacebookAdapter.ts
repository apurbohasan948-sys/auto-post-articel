/**
 * Axiom Facebook Page Adapter
 * Supports Meta Graph API v19.0 operations: testConnection, publishPost
 */

import { IntegrationTestResult, SocialIntegration } from '../../types/integrations.ts';

export class FacebookAdapter {
  private static instance: FacebookAdapter;

  public static getInstance(): FacebookAdapter {
    if (!FacebookAdapter.instance) {
      FacebookAdapter.instance = new FacebookAdapter();
    }
    return FacebookAdapter.instance;
  }

  /**
   * Tests connection to Facebook Page via Meta Graph API.
   * Real connection test with latency measurement and error diagnostics.
   */
  public async testConnection(integration: SocialIntegration): Promise<IntegrationTestResult> {
    const startTime = performance.now();
    try {
      const pageId = integration.credentials?.pageId;
      const accessToken = integration.credentials?.accessToken;

      if (!pageId || !accessToken) {
        return {
          success: false,
          status: 'FAILED',
          latencyMs: Math.round(performance.now() - startTime),
          error: 'Facebook Page ID and Page Access Token are both required.',
        };
      }

      const res = await fetch('/api/integrations/social/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'facebook',
          credentials: integration.credentials,
        }),
      });

      const latencyMs = Math.round(performance.now() - startTime);
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        return {
          success: false,
          status: 'FAILED',
          latencyMs,
          error: data?.error || `Facebook Graph API error: HTTP ${res.status}`,
          details: data?.details,
        };
      }

      return {
        success: true,
        status: 'CONNECTED',
        latencyMs: data.latencyMs || latencyMs,
        message: data.message || `Successfully connected to Facebook Page "${data.pageName || integration.name}"`,
        details: data.details,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED',
        latencyMs: Math.round(performance.now() - startTime),
        error: err?.message || 'Network error attempting to contact Facebook Graph API',
      };
    }
  }

  /**
   * Publishes a feed post to the Facebook Page.
   */
  public async publishPost(
    integration: SocialIntegration,
    post: { message: string; link?: string }
  ): Promise<{ success: boolean; postId?: string; url?: string; error?: string }> {
    try {
      const res = await fetch('/api/integrations/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'facebook',
          credentials: integration.credentials,
          post,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        return {
          success: false,
          error: data?.error || `Failed to publish Facebook post: HTTP ${res.status}`,
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
        error: err?.message || 'Network error publishing to Facebook Page',
      };
    }
  }
}

export const facebookAdapter = FacebookAdapter.getInstance();
