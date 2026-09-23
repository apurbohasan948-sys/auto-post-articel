/**
 * Axiom SEO Agent (Agent F)
 * Analyzes article draft to optimize metadata, keyword distribution,
 * structured schema (JSON-LD FAQ), image alt tags, and search engine discoverability.
 */

import { AIProviderManager } from '../services/aiProvider.ts';
import { StorageService } from '../services/storage.ts';
import { ContentPlan, ResearchPackage } from '../types/agent.ts';

export interface SEOOptimizationResult {
  seoTitle: string;
  metaDescription: string;
  slug: string;
  focusKeywords: string[];
  secondaryKeywords: string[];
  faq: Array<{ question: string; answer: string }>;
  imageAltText: string;
  internalLinks: string[];
  externalReferences: string[];
  structuredDataJsonLd: string;
}

export class SEOAgent {
  private ai: AIProviderManager;
  private storage: StorageService;

  constructor() {
    this.ai = AIProviderManager.getInstance();
    this.storage = StorageService.getInstance();
  }

  public async optimize(
    articleTitle: string,
    articleContent: string,
    plan: ContentPlan,
    research: ResearchPackage,
    jobId?: string
  ): Promise<SEOOptimizationResult> {
    const systemPrompt = `You are the Axiom SEO Specialist Agent.
Your duty is to produce modern, ethical (White-Hat) SEO metadata for high authority rankings.
Strict Rules:
1. Meta description MUST be under 160 characters, concise and punchy.
2. Focus keywords must strictly match the subject without spam or keyword stuffing.
3. Generate valid Schema.org Article & FAQPage JSON-LD.
4. Extract 2-3 FAQ Q&As directly from the article.`;

    const userPrompt = `Optimize SEO for this article:
TITLE: ${articleTitle}
PLAN SLUG: ${plan.slug}
EXCERPT: ${articleContent.slice(0, 1500)}
SOURCES: ${JSON.stringify(research.sources.map((s) => s.url))}

Return JSON:
{
  "seoTitle": "High CTR title within 60 chars",
  "metaDescription": "Under 160 char meta description",
  "slug": "kebab-case-slug",
  "focusKeywords": ["key1", "key2"],
  "secondaryKeywords": ["sec1", "sec2", "sec3"],
  "faq": [
    { "question": "Question?", "answer": "Answer summary." }
  ],
  "imageAltText": "Descriptive, accessible alt text",
  "internalLinks": ["/articles/relevant-slug"],
  "externalReferences": ["URL"],
  "structuredDataJsonLd": "{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\"}"
}`;

    const res = await this.ai.executeStructuredCompletion<SEOOptimizationResult>(
      { systemPrompt, userPrompt, temperature: 0.2 },
      jobId
    );

    const result: SEOOptimizationResult = {
      seoTitle: res.data.seoTitle || articleTitle,
      metaDescription: (res.data.metaDescription || plan.metaDescription).slice(0, 160),
      slug: res.data.slug || plan.slug,
      focusKeywords: Array.isArray(res.data.focusKeywords) ? res.data.focusKeywords : [articleTitle],
      secondaryKeywords: Array.isArray(res.data.secondaryKeywords) ? res.data.secondaryKeywords : [],
      faq: Array.isArray(res.data.faq) ? res.data.faq : [],
      imageAltText: res.data.imageAltText || `Illustration for ${articleTitle}`,
      internalLinks: plan.internalLinkingOpportunities,
      externalReferences: research.sources.map((s) => s.url),
      structuredDataJsonLd:
        typeof res.data.structuredDataJsonLd === 'string'
          ? res.data.structuredDataJsonLd
          : JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: articleTitle,
            }),
    };

    this.storage.addLog({
      agentName: 'SEOAgent',
      level: 'SUCCESS',
      message: `SEO optimization complete. Focus keywords: ${result.focusKeywords.join(', ')}. Meta length: ${result.metaDescription.length} chars.`,
      jobId,
    });

    return result;
  }
}
