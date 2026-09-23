/**
 * Axiom TikTok Adapter
 * Supports TikTok Open API v2 operations: testConnection, publishVideo
 */

import { IntegrationTestResult, SocialIntegration } from '../../types/integrations.ts';

export class TikTokAdapter {
  private static instance: TikTokAdapter;

  public static getInstance(): TikTokAdapter {
    if (!TikTokAdapter.instance) {
      TikTokAdapter.instance = new TikTokAdapter();
    }
    return TikTokAdapter.instance;
  }

  /**
   * Tests connection to TikTok Open API v2.
   */
  public async testConnection(integration: SocialIntegration): Promise<IntegrationTestResult> {
    const startTime = performance.now();
    try {
      const accessToken = integration.credentials?.accessToken;
      const openId = integration.credentials?.openId;

      if (!accessToken && !openId) {
        return {
          success: false,
          status: 'FAILED',
          latencyMs: Math.round(performance.now() - startTime),
          error: 'TikTok Creator Open ID and Access Token are required.',
        };
      }

      const res = await fetch('/api/integrations/social/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'tiktok',
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
          error: data?.error || `TikTok Open API error: HTTP ${res.status}`,
          details: data?.details,
        };
      }

      return {
        success: true,
        status: 'CONNECTED',
        latencyMs: data.latencyMs || latencyMs,
        message: data.message || `Successfully connected to TikTok account @${data.creatorName || integration.name}`,
        details: data.details,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED',
        latencyMs: Math.round(performance.now() - startTime),
        error: err?.message || 'Network error attempting to contact TikTok API',
      };
    }
  }

  /**
   * Dispatches video upload/post request to TikTok Open API.
   */
  public async publishVideo(
    integration: SocialIntegration,
    post: { videoUrl: string; title: string }
  ): Promise<{ success: boolean; publishId?: string; error?: string }> {
    try {
      const res = await fetch('/api/integrations/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'tiktok',
          credentials: integration.credentials,
          post,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        return {
          success: false,
          error: data?.error || `Failed to publish video to TikTok: HTTP ${res.status}`,
        };
      }

      return {
        success: true,
        publishId: data.publishId,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Network error publishing video to TikTok',
      };
    }
  }
}

export const tikTokAdapter = TikTokAdapter.getInstance();
