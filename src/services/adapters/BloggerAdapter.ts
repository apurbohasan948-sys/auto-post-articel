/**
 * Tara - Blogger Platform Adapter
 * Interacts with Google Blogger API v3.
 * Performs real live validation, connection testing, and blog post publishing.
 */

import { BloggerIntegration, IntegrationTestResult, PublishingResult } from '../../types/integrations';
import { proxyFetch } from '../apiClient';

export interface BloggerPostPayload {
  title: string;
  content: string; // HTML content
  labels?: string[];
  isDraft?: boolean;
}

export class BloggerAdapter {
  /**
   * Test Blogger connection by querying the blog metadata via Blogger API v3
   * GET https://www.googleapis.com/blogger/v3/blogs/{blogId}
   */
  public static async testConnection(integration: BloggerIntegration): Promise<IntegrationTestResult> {
    if (!integration.blogId) {
      return {
        status: 'failed',
        message: 'Blog ID is required to connect to Blogger.',
        error: 'Missing blogId',
      };
    }

    if (!integration.accessToken) {
      return {
        status: 'failed',
        message: 'Blogger Access Token is missing. Please provide a valid token or connect Google OAuth.',
        error: 'Missing accessToken',
      };
    }

    const cleanBlogId = integration.blogId.trim();
    const url = `https://www.googleapis.com/blogger/v3/blogs/${cleanBlogId}`;

    const res = await proxyFetch({
      url,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${integration.accessToken.trim()}`,
        Accept: 'application/json',
      },
    });

    if (res.ok && res.data && res.data.id) {
      const blogName = res.data.name || 'Blogger Blog';
      const blogUrl = res.data.url || integration.publicBlogUrl || '';
      const totalPosts = res.data.posts?.totalItems ?? 0;

      return {
        status: 'success',
        message: `Connected successfully to "${blogName}" (${totalPosts} posts).`,
        latencyMs: res.latencyMs,
        statusCode: res.status,
        accountInfo: `${blogName} - ${blogUrl}`,
      };
    } else {
      return {
        status: 'failed',
        message: res.error || 'Failed to authenticate with Google Blogger API.',
        latencyMs: res.latencyMs,
        statusCode: res.status,
        error: res.error,
      };
    }
  }

  /**
   * Publish article to Google Blogger v3
   * POST https://www.googleapis.com/blogger/v3/blogs/{blogId}/posts?isDraft=true|false
   */
  public static async publishPost(
    integration: BloggerIntegration,
    post: BloggerPostPayload
  ): Promise<PublishingResult> {
    if (!integration.enabled) {
      return {
        platform: 'blogger',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'skipped',
        errorMessage: 'Integration is disabled',
        timestamp: Date.now(),
      };
    }

    if (!integration.blogId || !integration.accessToken) {
      return {
        platform: 'blogger',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'failed',
        errorMessage: 'Missing Blogger blogId or accessToken',
        timestamp: Date.now(),
      };
    }

    const isDraft = post.isDraft !== undefined 
      ? post.isDraft 
      : integration.defaultStatus === 'DRAFT';

    const cleanBlogId = integration.blogId.trim();
    const url = `https://www.googleapis.com/blogger/v3/blogs/${cleanBlogId}/posts?isDraft=${isDraft ? 'true' : 'false'}`;

    const labels = Array.from(new Set([
      ...(integration.defaultLabels || []),
      ...(post.labels || [])
    ])).filter(Boolean);

    const bodyPayload = {
      kind: 'blogger#post',
      title: post.title,
      content: post.content,
      labels: labels.length > 0 ? labels : undefined,
    };

    const res = await proxyFetch({
      url,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.accessToken.trim()}`,
        'Content-Type': 'application/json',
      },
      body: bodyPayload,
    });

    if (res.ok && res.data && res.data.id) {
      return {
        platform: 'blogger',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'success',
        postId: res.data.id,
        postUrl: res.data.url || `${integration.publicBlogUrl || 'https://blogger.com'}/${res.data.id}`,
        timestamp: Date.now(),
      };
    } else {
      return {
        platform: 'blogger',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'failed',
        errorMessage: res.error || `Blogger API returned HTTP ${res.status}`,
        timestamp: Date.now(),
      };
    }
  }
}
