/**
 * Tara - Threads Adapter
 * Meta Threads API for profile verification and thread creation
 */

import { SocialIntegration, IntegrationTestResult, PublishingResult } from '../../types/integrations';
import { proxyFetch } from '../apiClient';

export class ThreadsAdapter {
  public static async testConnection(integration: SocialIntegration): Promise<IntegrationTestResult> {
    const accessToken = (integration.accessToken || integration.apiKey || '').trim();

    if (!accessToken) {
      return {
        status: 'failed',
        message: 'Threads User Access Token is required.',
        error: 'Missing accessToken',
      };
    }

    const url = `https://graph.threads.net/v1.0/me?fields=id,username,name&access_token=${encodeURIComponent(accessToken)}`;

    const res = await proxyFetch({
      url,
      method: 'GET',
    });

    if (res.ok && res.data && res.data.id) {
      const username = res.data.username || res.data.name || 'Threads User';
      return {
        status: 'success',
        message: `Connected successfully to Threads account @${username}.`,
        latencyMs: res.latencyMs,
        statusCode: res.status,
        accountInfo: `@${username} (${res.data.id})`,
      };
    } else {
      const errMsg = res.data?.error?.message || res.error || 'Failed to authenticate with Threads API';
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
    const userId = (integration.profileId || integration.accountId || 'me').trim();

    if (!accessToken) {
      return {
        platform: 'threads',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'failed',
        errorMessage: 'Missing Threads access token',
        timestamp: Date.now(),
      };
    }

    const text = `${payload.title}\n\n${payload.summary}\n\n${payload.url || ''}`;

    // Step 1: Create Threads container
    const containerUrl = `https://graph.threads.net/v1.0/${encodeURIComponent(userId)}/threads`;
    const containerRes = await proxyFetch({
      url: containerUrl,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        media_type: 'TEXT',
        text,
        access_token: accessToken,
      },
    });

    if (!containerRes.ok || !containerRes.data?.id) {
      return {
        platform: 'threads',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'failed',
        errorMessage: containerRes.data?.error?.message || containerRes.error || 'Failed to create Threads container',
        timestamp: Date.now(),
      };
    }

    const creationId = containerRes.data.id;

    // Step 2: Publish thread
    const publishUrl = `https://graph.threads.net/v1.0/${encodeURIComponent(userId)}/threads_publish`;
    const publishRes = await proxyFetch({
      url: publishUrl,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        creation_id: creationId,
        access_token: accessToken,
      },
    });

    if (publishRes.ok && publishRes.data?.id) {
      return {
        platform: 'threads',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'success',
        postId: publishRes.data.id,
        postUrl: `https://threads.net/t/${publishRes.data.id}`,
        timestamp: Date.now(),
      };
    } else {
      return {
        platform: 'threads',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'failed',
        errorMessage: publishRes.data?.error?.message || publishRes.error || 'Failed to publish Thread',
        timestamp: Date.now(),
      };
    }
  }
}
