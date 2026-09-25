/**
 * Tara - X / Twitter Adapter
 * Twitter API v2 for User authentication & Tweet creation
 */

import { SocialIntegration, IntegrationTestResult, PublishingResult } from '../../types/integrations';
import { proxyFetch } from '../apiClient';

export class TwitterAdapter {
  public static async testConnection(integration: SocialIntegration): Promise<IntegrationTestResult> {
    const token = (integration.accessToken || integration.apiKey || '').trim();

    if (!token) {
      return {
        status: 'failed',
        message: 'Twitter/X Bearer Token or User OAuth Token is required.',
        error: 'Missing token',
      };
    }

    const url = 'https://api.twitter.com/2/users/me';

    const res = await proxyFetch({
      url,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok && res.data?.data) {
      const user = res.data.data;
      const username = user.username || 'X User';
      const name = user.name || username;

      return {
        status: 'success',
        message: `Connected successfully to X account @${username} (${name}).`,
        latencyMs: res.latencyMs,
        statusCode: res.status,
        accountInfo: `@${username} (${user.id})`,
      };
    } else {
      const errMsg = res.data?.detail || res.data?.title || res.error || 'Failed to authenticate with X/Twitter API';
      return {
        status: 'failed',
        message: errMsg,
        latencyMs: res.latencyMs,
        statusCode: res.status,
        error: errMsg,
      };
    }
  }

  public static async publishPost(
    integration: SocialIntegration,
    payload: { title: string; summary: string; url?: string; tags?: string[] }
  ): Promise<PublishingResult> {
    const token = (integration.accessToken || integration.apiKey || '').trim();

    if (!token) {
      return {
        platform: 'twitter',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'failed',
        errorMessage: 'Missing X/Twitter access token',
        timestamp: Date.now(),
      };
    }

    const hashtags = (payload.tags || []).slice(0, 3).map((t) => `#${t.replace(/\s+/g, '')}`).join(' ');
    let tweetText = `${payload.title}\n\n${payload.summary.substring(0, 140)}...\n\n${payload.url || ''} ${hashtags}`.trim();
    if (tweetText.length > 280) {
      tweetText = tweetText.substring(0, 277) + '...';
    }

    const url = 'https://api.twitter.com/2/tweets';

    const res = await proxyFetch({
      url,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: {
        text: tweetText,
      },
    });

    if (res.ok && res.data?.data?.id) {
      const tweetId = res.data.data.id;
      return {
        platform: 'twitter',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'success',
        postId: tweetId,
        postUrl: `https://twitter.com/i/status/${tweetId}`,
        timestamp: Date.now(),
      };
    } else {
      return {
        platform: 'twitter',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'failed',
        errorMessage: res.data?.detail || res.error || 'Failed to publish Tweet',
        timestamp: Date.now(),
      };
    }
  }
}
