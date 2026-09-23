/**
 * Axiom Instagram Business Adapter
 * Supports Meta Graph API operations: testConnection, publishImage
 */

import { IntegrationTestResult, SocialIntegration } from '../../types/integrations.ts';

export class InstagramAdapter {
  private static instance: InstagramAdapter;

  public static getInstance(): InstagramAdapter {
    if (!InstagramAdapter.instance) {
      InstagramAdapter.instance = new InstagramAdapter();
    }
    return InstagramAdapter.instance;
  }

  /**
   * Tests connection to Instagram Business Account via Meta Graph API.
   */
  public async testConnection(integration: SocialIntegration): Promise<IntegrationTestResult> {
    const startTime = performance.now();
    try {
      const accountId = integration.credentials?.instagramAccountId;
      const accessToken = integration.credentials?.accessToken;

      if (!accountId || !accessToken) {
        return {
          success: false,
          status: 'FAILED',
          latencyMs: Math.round(performance.now() - startTime),
          error: 'Instagram Business Account ID and Access Token are both required.',
        };
      }

      const res = await fetch('/api/integrations/social/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'instagram',
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
          error: data?.error || `Instagram Graph API error: HTTP ${res.status}`,
          details: data?.details,
        };
      }

      return {
        success: true,
        status: 'CONNECTED',
        latencyMs: data.latencyMs || latencyMs,
        message: data.message || `Successfully connected to Instagram account @${data.username || integration.name}`,
        details: data.details,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED',
        latencyMs: Math.round(performance.now() - startTime),
        error: err?.message || 'Network error attempting to contact Instagram API',
      };
    }
  }

  /**
   * Publishes an image container with caption to Instagram Business account.
   */
  public async publishImage(
    integration: SocialIntegration,
    post: { imageUrl: string; caption: string }
  ): Promise<{ success: boolean; mediaId?: string; error?: string }> {
    try {
      const res = await fetch('/api/integrations/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'instagram',
          credentials: integration.credentials,
          post,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        return {
          success: false,
          error: data?.error || `Failed to publish Instagram media: HTTP ${res.status}`,
        };
      }

      return {
        success: true,
        mediaId: data.mediaId,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Network error publishing to Instagram',
      };
    }
  }
}

export const instagramAdapter = InstagramAdapter.getInstance();
