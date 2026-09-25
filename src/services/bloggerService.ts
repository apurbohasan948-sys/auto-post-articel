/**
 * Axiom Blogger Publisher Integration
 * Connects to Google Blogger API v3 with OAuth token management and idempotency checks.
 * Prevents double-publishing using cryptographic content hashing.
 */

import crypto from 'crypto';
import { StorageService } from './storage.ts';
import { integrationStore } from './integrationStore.ts';

export interface BloggerPublishPayload {
  title: string;
  contentHtml: string;
  labels: string[];
  isDraft?: boolean;
  topicId: string;
  articleId: string;
}

export interface BloggerPublishResult {
  success: boolean;
  blogId: string;
  postId: string;
  url: string;
  publishedAt: string;
  idempotencyHash: string;
  mode: 'LIVE' | 'DRAFT';
}

export class BloggerService {
  private static instance: BloggerService;
  private storage: StorageService;

  private constructor() {
    this.storage = StorageService.getInstance();
  }

  public static getInstance(): BloggerService {
    if (!BloggerService.instance) {
      BloggerService.instance = new BloggerService();
    }
    return BloggerService.instance;
  }

  /**
   * Computes SHA-256 hash for idempotency checking.
   */
  public generateIdempotencyHash(title: string, articleId: string): string {
    return crypto.createHash('sha256').update(`${articleId}:${title}`).digest('hex').substring(0, 32);
  }

  /**
   * Publishes verified article to Blogger.
   * Directly uses integrationStore (localStorage) as single authoritative source.
   */
  public async publishPost(payload: BloggerPublishPayload, jobId?: string): Promise<BloggerPublishResult> {
    const enabledBloggers = integrationStore.getEnabledBloggers();
    const activeBlogger = enabledBloggers[0];
    const bloggerConfig = this.storage.getBloggerConfig();

    const blogId = activeBlogger?.blogId?.trim() || bloggerConfig.blogId || process.env.BLOGGER_DEFAULT_BLOG_ID;

    if (!blogId) {
      throw new Error('Blogger Blog ID is missing. Configure an active Blogger integration in Settings -> Integrations.');
    }

    const idempotencyHash = this.generateIdempotencyHash(payload.title, payload.articleId);

    // Idempotency check: verify article hasn't already been published
    const existingArticle = this.storage.getArticleById(payload.articleId);
    if (existingArticle?.bloggerPost?.idempotencyHash === idempotencyHash) {
      this.storage.addLog({
        agentName: 'BloggerPublisherAgent',
        level: 'WARN',
        message: `Idempotency guard triggered: Article [${payload.articleId}] has already been published as post #${existingArticle.bloggerPost.postId}.`,
        jobId,
      });
      return {
        success: true,
        blogId: existingArticle.bloggerPost.blogId,
        postId: existingArticle.bloggerPost.postId,
        url: existingArticle.bloggerPost.url,
        publishedAt: existingArticle.bloggerPost.publishedAt,
        idempotencyHash,
        mode: (activeBlogger?.defaultStatus === 'DRAFT' || bloggerConfig.publishingMode === 'DRAFT') ? 'DRAFT' : 'LIVE',
      };
    }

    let accessToken = activeBlogger?.accessToken?.trim();
    const clientId = activeBlogger?.clientId?.trim() || process.env.BLOGGER_CLIENT_ID;
    const clientSecret = activeBlogger?.clientSecret?.trim() || process.env.BLOGGER_CLIENT_SECRET;
    const refreshToken = activeBlogger?.refreshToken?.trim() || process.env.BLOGGER_REFRESH_TOKEN;

    // Check if OAuth credentials exist for real Google Blogger API call
    if (!accessToken && !refreshToken && !clientId) {
      const errorMsg = 'Blogger API is DISCONNECTED. Please configure and test Blogger in Settings -> Integrations.';
      this.storage.addLog({
        agentName: 'BloggerPublisherAgent',
        level: 'ERROR',
        message: errorMsg,
        jobId,
      });
      throw new Error(errorMsg);
    }

    // Refresh OAuth access token if needed
    if (!accessToken && refreshToken && clientId && clientSecret) {
      try {
        accessToken = await this.refreshAccessToken(clientId, clientSecret, refreshToken);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Blogger OAuth token refresh failed: ${msg}`);
      }
    }

    if (!accessToken) {
      throw new Error('Blogger Access Token is required to create a post.');
    }

    const isDraft = payload.isDraft ?? (activeBlogger?.defaultStatus === 'DRAFT' || bloggerConfig.publishingMode === 'DRAFT');
    const endpoint = `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(blogId)}/posts${isDraft ? '?isDraft=true' : ''}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'blogger#post',
        title: payload.title,
        content: payload.contentHtml,
        labels: payload.labels && payload.labels.length > 0 ? payload.labels : (activeBlogger?.defaultLabels || bloggerConfig.defaultLabels),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Blogger API returned HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();

    const result: BloggerPublishResult = {
      success: true,
      blogId,
      postId: data.id,
      url: data.url || `https://${blogId}.blogspot.com/post/${data.id}`,
      publishedAt: data.published || new Date().toISOString(),
      idempotencyHash,
      mode: isDraft ? 'DRAFT' : 'LIVE',
    };

    this.storage.addLog({
      agentName: 'BloggerPublisherAgent',
      level: 'SUCCESS',
      message: `Successfully posted to Blogger! Post ID: ${result.postId}, URL: ${result.url}`,
      jobId,
    });

    return result;
  }

  private async refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OAuth2 token exchange error: ${err}`);
    }

    const json = await res.json();
    return json.access_token;
  }
}
