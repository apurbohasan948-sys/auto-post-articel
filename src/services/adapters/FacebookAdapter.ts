/**
 * Tara - Facebook Pages Adapter
 * Meta Graph API v19.0 for Page Feed testing & publishing
 */

import { SocialIntegration, IntegrationTestResult, PublishingResult } from '../../types/integrations';
import { proxyFetch } from '../apiClient';

export class FacebookAdapter {
  public static async testConnection(integration: SocialIntegration): Promise<IntegrationTestResult> {
    const accessToken = (integration.accessToken || integration.apiKey || '').trim();
    const pageId = (integration.pageId || integration.accountId || 'me').trim();

    if (!accessToken) {
      return {
        status: 'failed',
        message: 'Facebook Page Access Token is required.',
        error: 'Missing accessToken',
      };
    }

    const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}?fields=id,name,link&access_token=${encodeURIComponent(accessToken)}`;

    const res = await proxyFetch({
      url,
      method: 'GET',
    });

    if (res.ok && res.data && res.data.id) {
      const pageName = res.data.name || 'Facebook Page';
      return {
        status: 'success',
        message: `Connected successfully to Facebook Page "${pageName}".`,
        latencyMs: res.latencyMs,
        statusCode: res.status,
        accountInfo: `${pageName} (${res.data.id})`,
      };
    } else {
      const err = res.data?.error?.message || res.error || 'Failed to authenticate Facebook Page';
      return {
        status: 'failed',
        message: err,
        latencyMs: res.latencyMs,
        statusCode: res.status,
        error: err,
      };
    }
  }

  public static async publishPost(
    integration: SocialIntegration,
    payload: { title: string; summary: string; url?: string; tags?: string[] }
  ): Promise<PublishingResult> {
    const accessToken = (integration.accessToken || integration.apiKey || '').trim();
    const pageId = (integration.pageId || integration.accountId || 'me').trim();

    if (!accessToken) {
      return {
        platform: 'facebook',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'failed',
        errorMessage: 'Missing Facebook Page access token',
        timestamp: Date.now(),
      };
    }

    const hashtags = (payload.tags || []).map((t) => `#${t.replace(/\s+/g, '')}`).join(' ');
    const message = `${payload.title}\n\n${payload.summary}\n\n${hashtags}`;

    const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}/feed`;

    const res = await proxyFetch({
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        message,
        link: payload.url,
        access_token: accessToken,
      },
    });

    if (res.ok && res.data && res.data.id) {
      return {
        platform: 'facebook',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'success',
        postId: res.data.id,
        postUrl: `https://facebook.com/${res.data.id}`,
        timestamp: Date.now(),
      };
    } else {
      return {
        platform: 'facebook',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'failed',
        errorMessage: res.data?.error?.message || res.error || 'Failed to publish to Facebook feed',
        timestamp: Date.now(),
      };
    }
  }
}
