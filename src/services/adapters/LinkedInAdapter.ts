/**
 * Tara - LinkedIn Adapter
 * LinkedIn API for Profile / Organization Updates
 */

import { SocialIntegration, IntegrationTestResult, PublishingResult } from '../../types/integrations';
import { proxyFetch } from '../apiClient';

export class LinkedInAdapter {
  public static async testConnection(integration: SocialIntegration): Promise<IntegrationTestResult> {
    const accessToken = (integration.accessToken || integration.apiKey || '').trim();

    if (!accessToken) {
      return {
        status: 'failed',
        message: 'LinkedIn OAuth Access Token is required.',
        error: 'Missing accessToken',
      };
    }

    const url = 'https://api.linkedin.com/v2/userinfo';

    const res = await proxyFetch({
      url,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (res.ok && res.data && (res.data.name || res.data.sub)) {
      const name = res.data.name || 'LinkedIn User';
      return {
        status: 'success',
        message: `Connected successfully to LinkedIn Member "${name}".`,
        latencyMs: res.latencyMs,
        statusCode: res.status,
        accountInfo: `${name} (sub: ${res.data.sub})`,
      };
    } else {
      const errMsg = res.data?.message || res.error || 'Failed to authenticate with LinkedIn API';
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
    const accessToken = (integration.accessToken || integration.apiKey || '').trim();
    const profileId = (integration.profileId || integration.accountId || '').trim();

    if (!accessToken) {
      return {
        platform: 'linkedin',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'failed',
        errorMessage: 'Missing LinkedIn access token',
        timestamp: Date.now(),
      };
    }

    const hashtags = (payload.tags || []).map((t) => `#${t.replace(/\s+/g, '')}`).join(' ');
    const text = `${payload.title}\n\n${payload.summary}\n\n${payload.url || ''}\n\n${hashtags}`;

    const url = 'https://api.linkedin.com/v2/ugcPosts';
    const authorUrn = profileId.startsWith('urn:li:') ? profileId : `urn:li:person:${profileId || 'self'}`;

    const res = await proxyFetch({
      url,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text },
            shareMediaCategory: payload.url ? 'ARTICLE' : 'NONE',
            media: payload.url ? [{
              status: 'READY',
              description: { text: payload.summary },
              originalUrl: payload.url,
              title: { text: payload.title },
            }] : undefined,
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      },
    });

    if (res.ok && res.data && res.data.id) {
      return {
        platform: 'linkedin',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'success',
        postId: res.data.id,
        postUrl: `https://www.linkedin.com/feed/update/${res.data.id}`,
        timestamp: Date.now(),
      };
    } else {
      return {
        platform: 'linkedin',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'failed',
        errorMessage: res.data?.message || res.error || 'Failed to publish to LinkedIn',
        timestamp: Date.now(),
      };
    }
  }
}
