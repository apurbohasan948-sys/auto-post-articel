/**
 * Axiom Content Planner Agent (Agent D)
 * Synthesizes research into a structured article outline and editorial blueprint.
 */

import { AIProviderManager } from '../services/aiProvider.ts';
import { StorageService } from '../services/storage.ts';
import { ContentPlan, ResearchPackage, TopicCandidate } from '../types/agent.ts';

export class ContentPlannerAgent {
  private ai: AIProviderManager;
  private storage: StorageService;

  constructor() {
    this.ai = AIProviderManager.getInstance();
    this.storage = StorageService.getInstance();
  }

  public async createPlan(
    topic: TopicCandidate,
    research: ResearchPackage,
    jobId?: string
  ): Promise<ContentPlan> {
    const settings = this.storage.getSettings();
    const existingArticles = this.storage.getArticles();

    const internalSlugCandidates = existingArticles.map((a) => `/articles/${a.slug}`).slice(0, 5);

    const systemPrompt = `You are the Axiom Content Planner Agent.
Your duty is to create an exhaustive, structured blueprint for an authoritative technical article.
Target Language: ${settings.language}
Target Audience: ${settings.targetAudience}
Article Frequency & Depth: Comprehensive technical guide (1,200 - 2,000 words).

Plan Requirements:
1. SEO title options (3 distinct variants) and one chosen title.
2. Clean, URL-friendly slug (kebab-case).
3. Compelling meta description (145-160 characters).
4. High-impact introduction outline stating the problem and stakes.
5. Hierarchical H2/H3 structure detailing specific technical arguments.
6. FAQ section answering real questions practitioners ask.
7. Conclusion summarizing actionable takeaways.
8. External references using ONLY real URLs from the research package.
9. Internal linking opportunities based on existing catalog.`;

    const userPrompt = `Develop a Content Plan for:
TOPIC: ${topic.topic}
SUMMARY: ${research.summary}
FACTS: ${JSON.stringify(research.facts)}
SOURCES: ${JSON.stringify(research.sources.map((s) => ({ title: s.title, url: s.url })))}
EXISTING SLUGS FOR INTERNAL LINKS: ${JSON.stringify(internalSlugCandidates)}

Return JSON matching this exact structure:
{
  "seoTitleOptions": ["Title A", "Title B", "Title C"],
  "chosenTitle": "Selected high-CTR authoritative title",
  "slug": "url-friendly-kebab-slug",
  "metaDescription": "Concise meta summary under 160 characters",
  "introduction": "Outline of hook, context, and thesis",
  "h2H3Structure": [
    {
      "heading": "H2 Heading text",
      "level": "H2",
      "keyPoints": ["Point A", "Point B"]
    }
  ],
  "importantFacts": ["Key fact 1", "Key fact 2"],
  "sourceReferences": ["Exact source URLs from research"],
  "faqQuestions": [
    {
      "question": "Realistic question?",
      "answerSummary": "Key points of the answer"
    }
  ],
  "conclusion": "Actionable closing summary outline",
  "internalLinkingOpportunities": ["/articles/slug-example"],
  "externalSourceReferences": ["URL 1", "URL 2"]
}`;

    const res = await this.ai.executeStructuredCompletion<ContentPlan>(
      { systemPrompt, userPrompt, temperature: 0.3 },
      jobId
    );

    const plan: ContentPlan = {
      seoTitleOptions: Array.isArray(res.data.seoTitleOptions) ? res.data.seoTitleOptions : [topic.suggestedTitle],
      chosenTitle: res.data.chosenTitle || topic.suggestedTitle || topic.topic,
      slug: (res.data.slug || topic.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).slice(0, 80),
      metaDescription: res.data.metaDescription || `An in-depth analysis of ${topic.topic}.`,
      introduction: res.data.introduction || 'Overview and background of current developments.',
      h2H3Structure: Array.isArray(res.data.h2H3Structure) ? res.data.h2H3Structure : [],
      importantFacts: Array.isArray(res.data.importantFacts) ? res.data.importantFacts : research.facts.slice(0, 4),
      sourceReferences: Array.isArray(res.data.sourceReferences) ? res.data.sourceReferences : research.sources.map((s) => s.url),
      faqQuestions: Array.isArray(res.data.faqQuestions) ? res.data.faqQuestions : [],
      conclusion: res.data.conclusion || 'Key takeaways and future outlook.',
      internalLinkingOpportunities: Array.isArray(res.data.internalLinkingOpportunities)
        ? res.data.internalLinkingOpportunities
        : internalSlugCandidates,
      externalSourceReferences: research.sources.map((s) => s.url),
    };

    this.storage.addLog({
      agentName: 'ContentPlannerAgent',
      level: 'SUCCESS',
      message: `Content plan finalized: "${plan.chosenTitle}" with ${plan.h2H3Structure.length} major sections and ${plan.faqQuestions.length} FAQs.`,
      jobId,
    });

    return plan;
  }
}
