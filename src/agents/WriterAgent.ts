/**
 * Axiom Article Writer Agent (Agent E)
 * Generates natural, authoritative, highly structured articles in English, Bengali, or Banglish.
 * Synthesizes multiple sources, avoids hallucinations, and produces both Clean Markdown and Blogger-ready HTML.
 */

import { AIProviderManager } from '../services/aiProvider.ts';
import { StorageService } from '../services/storage.ts';
import { ContentPlan, ResearchPackage } from '../types/agent.ts';

export interface WriterOutput {
  cleanContent: string;
  bloggerHtml: string;
  wordCount: number;
}

export class WriterAgent {
  private ai: AIProviderManager;
  private storage: StorageService;

  constructor() {
    this.ai = AIProviderManager.getInstance();
    this.storage = StorageService.getInstance();
  }

  public async writeArticle(
    plan: ContentPlan,
    research: ResearchPackage,
    corrections?: string[],
    jobId?: string
  ): Promise<WriterOutput> {
    const settings = this.storage.getSettings();

    const correctionBlock =
      corrections && corrections.length > 0
        ? `\n\nREVISION INSTRUCTIONS FROM FACT/QUALITY AUDITOR:\n${corrections.map((c, i) => `${i + 1}. ${c}`).join('\n')}\nYou MUST address every revision requirement above in this version.`
        : '';

    const languageInstruction =
      settings.language === 'Bengali'
        ? 'Write the entire article in natural, standard Bengali (বাংলা). Maintain technical terminology accurately.'
        : settings.language === 'Banglish'
        ? 'Write in modern conversational Banglish (Bengali written with Latin script blended with English tech terms), standard in South Asian developer communities.'
        : 'Write in clear, authoritative, engaging English with technical sophistication.';

    const systemPrompt = `You are the Axiom Writer Agent.
Role: Senior Staff Technology Journalist and Systems Engineer.
Language Mode: ${languageInstruction}

Strict Mandates:
1. Ground all claims in the provided empirical research package.
2. DO NOT fabricate statistics, fake percentages, or imaginary companies.
3. Incorporate multiple viewpoints and references from the research package.
4. Avoid buzzword stuffing, excessive repetition, and robotic transitions.
5. Create comprehensive coverage (1,000 - 1,800 words equivalent depth).
6. Provide TWO outputs:
   - "cleanContent": Clean markdown format with headers, lists, code blocks or tables if appropriate.
   - "bloggerHtml": Blogger-compatible HTML with styled classes (<div class="axiom-article">, <h2>, <h3>, <blockquote>, <p>, <ul>, and <div class="faq-container">).`;

    const userPrompt = `Draft the complete article based on this blueprint:

CHOSEN TITLE: ${plan.chosenTitle}
SLUG: ${plan.slug}
OUTLINE: ${JSON.stringify(plan.h2H3Structure)}
KEY FACTS: ${JSON.stringify(plan.importantFacts)}
VERIFIED SOURCES: ${JSON.stringify(research.sources.map((s) => ({ title: s.title, url: s.url })))}
RESEARCH SUMMARY: ${research.summary}
FAQ PLAN: ${JSON.stringify(plan.faqQuestions)}${correctionBlock}

Return valid JSON:
{
  "cleanContent": "# Title\\n\\nComplete Markdown text...",
  "bloggerHtml": "<div class=\\"axiom-article\\">...</div>",
  "wordCount": 1350
}`;

    const res = await this.ai.executeStructuredCompletion<WriterOutput>(
      {
        systemPrompt,
        userPrompt,
        temperature: 0.35,
        maxTokens: 3800,
      },
      jobId
    );

    const output: WriterOutput = {
      cleanContent: res.data.cleanContent || `# ${plan.chosenTitle}\n\n${research.summary}`,
      bloggerHtml:
        res.data.bloggerHtml ||
        `<div class="axiom-article"><h1>${plan.chosenTitle}</h1><p>${research.summary}</p></div>`,
      wordCount:
        typeof res.data.wordCount === 'number'
          ? res.data.wordCount
          : (res.data.cleanContent || '').split(/\s+/).length,
    };

    this.storage.addLog({
      agentName: 'WriterAgent',
      level: 'SUCCESS',
      message: `Article drafted successfully (${output.wordCount} words) in ${settings.language}. Generated both Markdown and Blogger HTML.`,
      jobId,
    });

    return output;
  }
}
