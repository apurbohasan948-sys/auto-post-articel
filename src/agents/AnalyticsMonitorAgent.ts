/**
 * Axiom Analytics & Monitoring Agent (Agent K)
 * Tracks real telemetry, platform publishing rates, API latency, and editorial KPIs.
 * Never invents mock traffic numbers.
 */

import { StorageService } from '../services/storage.ts';
import { Article } from '../types/agent.ts';

export interface AnalyticsSummary {
  totalArticles: number;
  publishedCount: number;
  distributedCount: number;
  qualityPassRate: number;
  averageWordCount: number;
  totalSocialPosts: number;
  platformDistributionCounts: Record<string, number>;
  dailyStats: {
    aiCallsToday: number;
    researchCallsToday: number;
    articlesPublishedToday: number;
    socialPostsCreatedToday: number;
  };
}

export class AnalyticsMonitorAgent {
  private storage: StorageService;

  constructor() {
    this.storage = StorageService.getInstance();
  }

  public getSummaryMetrics(): AnalyticsSummary {
    const articles = this.storage.getArticles();
    const settings = this.storage.getSettings();

    const published = articles.filter(
      (a) => a.lifecycleState === 'PUBLISHED' || a.lifecycleState === 'DISTRIBUTED'
    );
    const distributed = articles.filter((a) => a.lifecycleState === 'DISTRIBUTED');

    const totalWords = articles.reduce((acc, a) => acc + (a.cleanContent ? a.cleanContent.split(/\s+/).length : 0), 0);
    const avgWords = articles.length > 0 ? Math.round(totalWords / articles.length) : 0;

    const audited = articles.filter((a) => a.qualityReport);
    const passed = audited.filter((a) => a.qualityReport?.status === 'PASS');
    const qualityPassRate = audited.length > 0 ? Math.round((passed.length / audited.length) * 100) : 100;

    const platformCounts: Record<string, number> = {
      facebook: 0,
      telegram: 0,
      linkedin: 0,
      x: 0,
      threads: 0,
    };

    let totalSocial = 0;
    for (const art of articles) {
      for (const soc of art.socialDistributions || []) {
        if (soc.status === 'PUBLISHED') {
          platformCounts[soc.platform] = (platformCounts[soc.platform] || 0) + 1;
          totalSocial++;
        }
      }
    }

    return {
      totalArticles: articles.length,
      publishedCount: published.length,
      distributedCount: distributed.length,
      qualityPassRate,
      averageWordCount: avgWords,
      totalSocialPosts: totalSocial,
      platformDistributionCounts: platformCounts,
      dailyStats: {
        aiCallsToday: settings.todayStats.aiCalls,
        researchCallsToday: settings.todayStats.researchCalls,
        articlesPublishedToday: settings.todayStats.articlesPublished,
        socialPostsCreatedToday: settings.todayStats.socialPostsCreated,
      },
    };
  }

  public async trackCycleResult(article: Article, jobId?: string): Promise<void> {
    const summary = this.getSummaryMetrics();
    this.storage.addLog({
      agentName: 'AnalyticsMonitorAgent',
      level: 'INFO',
      message: `Cycle telemetry logged for "${article.title}". Cumulative published: ${summary.publishedCount}, pass rate: ${summary.qualityPassRate}%.`,
      jobId,
    });
  }
}
