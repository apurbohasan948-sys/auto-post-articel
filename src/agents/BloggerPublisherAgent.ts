import { BloggerAdapter, BloggerPublishResult } from '../adapters/BloggerAdapter';
import { integrationStore } from '../services/integrationStore';
import { appStorage } from '../services/storage';
import { ArticleItem } from '../types/agent';

export interface BloggerPublishReport {
  attempted: number;
  successful: number;
  results: {
    blogName: string;
    blogId: string;
    result: BloggerPublishResult;
  }[];
}

export class BloggerPublisherAgent {
  /**
   * Reads enabled Blogger integrations dynamically from integrationStore.
   * Publishes the article to each enabled blog.
   */
  public static async publish(article: ArticleItem): Promise<BloggerPublishReport> {
    const enabledBlogs = integrationStore.getEnabledBlogger();
    const report: BloggerPublishReport = {
      attempted: enabledBlogs.length,
      successful: 0,
      results: []
    };

    if (enabledBlogs.length === 0) {
      appStorage.addLog(
        'BloggerPublisherAgent',
        'warn',
        'No enabled Blogger integrations found in integrationStore. Skipping Blogger publication.'
      );
      return report;
    }

    appStorage.addLog(
      'BloggerPublisherAgent',
      'info',
      `Starting Blogger publication for article "${article.title}" across ${enabledBlogs.length} enabled blog(s).`
    );

    for (const blog of enabledBlogs) {
      try {
        const publishResult = await BloggerAdapter.publishPost(blog, {
          title: article.title,
          content: article.content,
          labels: article.tags,
          isDraft: blog.defaultStatus === 'DRAFT'
        });

        report.results.push({
          blogName: blog.name,
          blogId: blog.blogId,
          result: publishResult
        });

        if (publishResult.success) {
          report.successful++;
          appStorage.addLog(
            'BloggerPublisherAgent',
            'success',
            `Published "${article.title}" to blog "${blog.name}" (${blog.defaultStatus})`,
            { url: publishResult.url }
          );

          // Update article publishedUrls
          appStorage.updateArticle(article.id, {
            publishedUrls: {
              ...(article.publishedUrls || {}),
              blogger: publishResult.url
            }
          });
        } else {
          appStorage.addLog(
            'BloggerPublisherAgent',
            'error',
            `Failed publishing to "${blog.name}": ${publishResult.error}`
          );
        }
      } catch (err: any) {
        appStorage.addLog(
          'BloggerPublisherAgent',
          'error',
          `Exception during Blogger publication for "${blog.name}": ${err?.message}`
        );
      }
    }

    return report;
  }
}
