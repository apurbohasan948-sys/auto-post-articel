/**
 * Axiom Blogger Publisher Integration
 * Connects to Google Blogger API v3 with OAuth token management and idempotency checks.
 * Prevents double-publishing using cryptographic content hashing.
 */

import crypto from 'crypto';
import { StorageService } from './storage.ts';
import { integrationStore } from './integrationStore.ts';
import { createBloggerPostHandler } from './bloggerPostingService.ts';

export interface BloggerPublishPayload {
  title: string;
  contentHtml: string;
  labels: string[];
  isDraft?: boolean;
  topicId: string;
  articleId: string;
  integration?: any;
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
   * Directly uses integrationStore (localStorage) or passed integration as single authoritative source.
   */
  public async publishPost(payload: BloggerPublishPayload, jobId?: string): Promise<BloggerPublishResult> {
    const enabledBloggers = integrationStore.getEnabledBloggers();
    const activeBlogger = payload.integration || enabledBloggers[0];
    const bloggerConfig = this.storage.getBloggerConfig();

    const blogId = (activeBlogger?.blogId || bloggerConfig.blogId || process.env.BLOGGER_DEFAULT_BLOG_ID || '').trim().replace(/\s+/g, '');

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

    const isDraft = payload.isDraft ?? (activeBlogger?.defaultStatus === 'DRAFT' || bloggerConfig.publishingMode === 'DRAFT');

    const result = await createBloggerPostHandler({
      title: payload.title,
      content: payload.contentHtml,
      blogId,
      labels: payload.labels && payload.labels.length > 0 ? payload.labels : (activeBlogger?.defaultLabels || bloggerConfig.defaultLabels),
      isDraft,
      integration: activeBlogger,
      accessToken: activeBlogger?.accessToken || bloggerConfig.accessToken,
      refreshToken: activeBlogger?.refreshToken || bloggerConfig.refreshToken,
      clientId: activeBlogger?.clientId || bloggerConfig.clientId,
      clientSecret: activeBlogger?.clientSecret || bloggerConfig.clientSecret,
      articleId: payload.articleId,
    });

    if (!result.success) {
      const stagePrefix = result.stage ? `[${result.stage}] ` : '';
      const errMsg = `${stagePrefix}${result.googleError || result.error || result.message || 'Post creation failed'}`;
      this.storage.addLog({
        agentName: 'BloggerPublisherAgent',
        level: 'ERROR',
        message: `Blogger publication failed (HTTP ${result.status || 0}): ${errMsg}`,
        jobId,
      });
      throw new Error(errMsg);
    }

    const pubResult: BloggerPublishResult = {
      success: true,
      blogId: result.blogId || blogId,
      postId: result.postId || '',
      url: result.url || `https://${blogId}.blogspot.com/post/${result.postId}`,
      publishedAt: new Date().toISOString(),
      idempotencyHash,
      mode: isDraft ? 'DRAFT' : 'LIVE',
    };

    this.storage.addLog({
      agentName: 'BloggerPublisherAgent',
      level: 'SUCCESS',
      message: `Successfully posted to Blogger! Post ID: ${pubResult.postId}, URL: ${pubResult.url}`,
      jobId,
    });

    return pubResult;
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
