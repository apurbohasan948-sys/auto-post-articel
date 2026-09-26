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
    const blogId = integration.blogId?.trim() || '';
    const publicBlogUrl = (integration.publicBlogUrl || integration.blogUrl || '').trim();
    const accessToken = integration.accessToken?.trim();

    if (!blogId && !publicBlogUrl) {
      return {
        status: 'FAILED',
        success: false,
        message: 'Blog ID or Public Blog URL is required to connect to Blogger.',
        error: 'Missing blogId or publicBlogUrl',
      };
    }

    if (!accessToken) {
      return {
        status: 'FAILED',
        success: false,
        message: 'Blogger Access Token is missing. Please provide a valid token or connect Google OAuth.',
        error: 'Missing accessToken',
      };
    }

    try {
      const res = await fetch('/api/integrations/blogger/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blogId,
          publicBlogUrl,
          accessToken,
          refreshToken: integration.refreshToken?.trim(),
          clientId: integration.clientId?.trim(),
          clientSecret: integration.clientSecret?.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.status === 'CONNECTED') {
        return {
          status: 'CONNECTED',
          success: true,
          message: data.message || `Connected successfully to "${data.blogName || 'Blogger Blog'}"`,
          latencyMs: data.latencyMs,
          statusCode: 200,
          accountInfo: `${data.blogName || 'Blogger'} - ${data.blogUrl || blogId}`,
          details: data.diagnostics,
        };
      } else {
        return {
          status: 'FAILED',
          success: false,
          message: data.error || data.message || 'The Google account used for OAuth does not have access to this Blogger blog.',
          latencyMs: data.latencyMs,
          statusCode: data.diagnostics?.getBlogIdStatus || 404,
          error: data.error || data.message,
          details: data.diagnostics,
        };
      }
    } catch (err: any) {
      return {
        status: 'FAILED',
        success: false,
        message: err?.message || 'Server error testing Blogger connection',
        error: err?.message,
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
