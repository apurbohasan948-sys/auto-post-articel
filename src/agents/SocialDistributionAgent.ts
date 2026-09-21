/**
 * Axiom Social Distribution Agent (Agent J)
 * Generates tailored platform-specific copy (Facebook, X, Telegram, LinkedIn, Threads)
 * and coordinates multi-network distribution via SocialService.
 */

import { AIProviderManager } from '../services/aiProvider.ts';
import { SocialService } from '../services/socialService.ts';
import { StorageService } from '../services/storage.ts';
import { Article, SocialPost } from '../types/agent.ts';

export class SocialDistributionAgent {
  private ai: AIProviderManager;
  private socialService: SocialService;
  private storage: StorageService;

  constructor() {
    this.ai = AIProviderManager.getInstance();
    this.socialService = SocialService.getInstance();
    this.storage = StorageService.getInstance();
  }

  public async distributeArticle(article: Article, jobId?: string): Promise<SocialPost[]> {
    const articleUrl = article.bloggerPost?.url || `https://axiom-content.app/articles/${article.slug}`;

    this.storage.addLog({
      agentName: 'SocialDistributionAgent',
      level: 'INFO',
      message: `Synthesizing platform-specific copy for "${article.title}"`,
      jobId,
    });

    // 1. Generate platform-specific posts with AI
    const systemPrompt = `You are the Axiom Social Growth Agent.
Create high-engagement, non-spammy snippets tailored to each specific network:
- facebook: Conversational editorial post with emojis and question hook.
- x: Punchy thread opener within 260 characters, provocative insight.
- telegram: Clean markdown format with bullet highlights.
- linkedin: Professional thought leadership tone, 2-3 paragraphs.
- threads: Casual, snappy remark stimulating discussion.`;

    const userPrompt = `Create copy for:
TITLE: ${article.title}
SUMMARY: ${article.metaDescription}
URL: ${articleUrl}

Return JSON:
{
  "facebook": "Text for Facebook...",
  "x": "Text for X...",
  "telegram": "Text for Telegram...",
  "linkedin": "Text for LinkedIn...",
  "threads": "Text for Threads..."
}`;

    let snippets: Record<string, string> = {
      facebook: `${article.title}\n\nRead the full technical breakdown here: ${articleUrl}`,
      x: `Deep-dive on ${article.title}:\n\n${articleUrl}`,
      telegram: `⚡️ **NEW PUBLICATION**: ${article.title}\n\n${article.metaDescription}\n\n🔗 ${articleUrl}`,
      linkedin: `We just published our latest research on ${article.title}. Here is what teams need to know: ${articleUrl}`,
      threads: `${article.title}. Thoughts? ${articleUrl}`,
    };

    try {
      const res = await this.ai.executeStructuredCompletion<Record<string, string>>(
        { systemPrompt, userPrompt, temperature: 0.4 },
        jobId
      );
      if (res.data) {
        snippets = { ...snippets, ...res.data };
      }
    } catch (err) {
      console.warn('[SocialDistribution] AI copy generation failed, using fallback templates:', err);
    }

    // 2. Dispatch across enabled adapters
    const distributions = await this.socialService.distributeArticle(
      article.id,
      article.title,
      articleUrl,
      snippets,
      jobId
    );

    article.socialDistributions = distributions;
    article.lifecycleState = 'DISTRIBUTED';
    this.storage.saveArticle(article);

    const settings = this.storage.getSettings();
    const publishedCount = distributions.filter((d) => d.status === 'PUBLISHED').length;
    settings.todayStats.socialPostsCreated += publishedCount;
    this.storage.updateSettings({ todayStats: settings.todayStats });

    return distributions;
  }
}
