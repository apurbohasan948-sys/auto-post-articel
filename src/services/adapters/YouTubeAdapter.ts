/**
 * Axiom YouTube Adapter
 * Supports YouTube Data API v3 operations: testConnection, publishCommunityPost
 */

import { IntegrationTestResult, SocialIntegration } from '../../types/integrations.ts';

export class YouTubeAdapter {
  private static instance: YouTubeAdapter;

  public static getInstance(): YouTubeAdapter {
    if (!YouTubeAdapter.instance) {
      YouTubeAdapter.instance = new YouTubeAdapter();
    }
    return YouTubeAdapter.instance;
  }

  /**
   * Tests connection to YouTube Data API v3.
   */
  public async testConnection(integration: SocialIntegration): Promise<IntegrationTestResult> {
    const startTime = performance.now();
    try {
      const channelId = integration.credentials?.channelId;
      const apiKey = integration.credentials?.apiKey;
      const accessToken = integration.credentials?.accessToken;

      if (!channelId && !accessToken && !apiKey) {
        return {
          success: false,
          status: 'FAILED',
          latencyMs: Math.round(performance.now() - startTime),
          error: 'YouTube Channel ID and API Key or Access Token are required.',
        };
      }

      const res = await fetch('/api/integrations/social/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'youtube',
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
          error: data?.error || `YouTube Data API error: HTTP ${res.status}`,
          details: data?.details,
        };
      }

      return {
        success: true,
        status: 'CONNECTED',
        latencyMs: data.latencyMs || latencyMs,
        message: data.message || `Successfully connected to YouTube channel "${data.channelTitle || integration.name}"`,
        details: data.details,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED',
        latencyMs: Math.round(performance.now() - startTime),
        error: err?.message || 'Network error attempting to contact YouTube API',
      };
    }
  }

  /**
   * Dispatches community post or activity item to YouTube channel.
   */
  public async publishCommunityPost(
    integration: SocialIntegration,
    post: { text: string }
  ): Promise<{ success: boolean; postId?: string; error?: string }> {
    try {
      const res = await fetch('/api/integrations/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'youtube',
          credentials: integration.credentials,
          post,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        return {
          success: false,
          error: data?.error || `Failed to post to YouTube: HTTP ${res.status}`,
        };
      }

      return {
        success: true,
        postId: data.postId,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Network error publishing to YouTube',
      };
    }
  }
}

export const youtubeAdapter = YouTubeAdapter.getInstance();
