/**
 * Axiom Blogger Publisher Agent (Agent I)
 * Executes the publishing workflow to Blogger after Quality Pass.
 * Enforces manual approval checks or auto-publishing mode.
 */

import { BloggerService } from '../services/bloggerService.ts';
import { StorageService } from '../services/storage.ts';
import { Article } from '../types/agent.ts';

export class BloggerPublisherAgent {
  private bloggerService: BloggerService;
  private storage: StorageService;

  constructor() {
    this.bloggerService = BloggerService.getInstance();
    this.storage = StorageService.getInstance();
  }

  public async handlePublish(article: Article, isManualOverride = false, jobId?: string, integration?: any): Promise<Article> {
    const settings = this.storage.getSettings();

    // Check Quality Pass
    if (article.qualityReport?.status !== 'PASS' && !isManualOverride) {
      throw new Error(`Cannot publish article [${article.id}]: Quality status is ${article.qualityReport?.status || 'PENDING'}`);
    }

    // Check Approval Mode
    if (settings.mode === 'APPROVAL' && !isManualOverride) {
      this.storage.addLog({
        agentName: 'BloggerPublisherAgent',
        level: 'INFO',
        message: `Agent is in APPROVAL mode. Article [${article.id}] queued as APPROVED awaiting human sign-off.`,
        jobId,
      });
      article.lifecycleState = 'APPROVED';
      this.storage.saveArticle(article);
      return article;
    }

    this.storage.addLog({
      agentName: 'BloggerPublisherAgent',
      level: 'INFO',
      message: `Executing Blogger deployment for "${article.title}"...`,
      jobId,
    });

    try {
      const pubResult = await this.bloggerService.publishPost(
        {
          title: article.title,
          contentHtml: article.bloggerHtml,
          labels: [...article.focusKeywords.slice(0, 3), 'Axiom AI'],
          topicId: article.topicId,
          articleId: article.id,
          integration,
        },
        jobId
      );

      article.bloggerPost = {
        blogId: pubResult.blogId,
        postId: pubResult.postId,
        url: pubResult.url,
        labels: [...article.focusKeywords.slice(0, 3)],
        publishedAt: pubResult.publishedAt,
        idempotencyHash: pubResult.idempotencyHash,
      };

      article.lifecycleState = 'PUBLISHED';
      this.storage.saveArticle(article);

      settings.todayStats.articlesPublished += 1;
      this.storage.updateSettings({ todayStats: settings.todayStats });

      return article;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.storage.addLog({
        agentName: 'BloggerPublisherAgent',
        level: 'ERROR',
        message: `Blogger publication failed: ${msg}. Article retained in APPROVED state.`,
        jobId,
      });
      throw err;
    }
  }
}
