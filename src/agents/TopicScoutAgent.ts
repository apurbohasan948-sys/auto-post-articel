/**
 * Axiom Topic Scout Agent (Agent A)
 * Automatically discovers high-potential, non-duplicate article topics
 * aligned with the configured niche, audience, and memory gaps.
 */

import { AIProviderManager } from '../services/aiProvider.ts';
import { StorageService } from '../services/storage.ts';
import { TopicCandidate } from '../types/agent.ts';

export class TopicScoutAgent {
  private ai: AIProviderManager;
  private storage: StorageService;

  constructor() {
    this.ai = AIProviderManager.getInstance();
    this.storage = StorageService.getInstance();
  }

  public async scoutCandidateTopics(jobId?: string): Promise<TopicCandidate[]> {
    const settings = this.storage.getSettings();
    const memory = this.storage.getMemory();
    const existingTopics = this.storage.getTopics();

    const existingTitles = existingTopics.map((t) => t.suggestedTitle || t.topic).slice(0, 15);
    const publishedTitles = memory.publishedTopics.map((p) => p.title).slice(0, 15);

    const systemPrompt = `You are the Axiom Topic Scout Agent.
Your duty is to discover high-value, highly specific, and technically grounded article topics.
Target Audience: ${settings.targetAudience}
Primary Niche: ${settings.niche}
Sub-Niches: ${settings.subNiches.join(', ')}
Target Language: ${settings.language}
Country/Region: ${settings.countryRegion}
Keywords to prioritize: ${settings.keywords.join(', ')}
Excluded words: ${settings.excludedKeywords.join(', ')}

Strict Rules:
1. Do NOT invent fake numerical search volumes.
2. Ensure topics are strictly distinct from already known/published topics:
   Known: ${[...existingTitles, ...publishedTitles].join(' | ')}
3. Prioritize content gaps identified in memory: ${memory.gapKeywords.join(', ')}
4. Return a JSON object with a "candidates" array containing 2 to 3 candidate topics.`;

    const userPrompt = `Generate 2 vetted candidate topics that have strong technical depth, high audience utility, and zero duplicate overlap.
Return JSON with this exact structure:
{
  "candidates": [
    {
      "topic": "Concise subject phrase",
      "suggestedTitle": "High-CTR, technical, non-clickbait title",
      "category": "One of the configured sub-niches",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "reason": "Detailed justification why this topic is timely and valuable now",
      "freshness": "Trending" | "Breaking" | "Evergreen" | "Educational",
      "availableResearch": "Description of empirical sources available on the web",
      "sourceCount": 5,
      "duplicateRisk": "Low" | "Medium" | "High",
      "contentGap": "High" | "Moderate" | "Low",
      "socialPotential": "Viral" | "High" | "Moderate",
      "evergreenPotential": "High" | "Medium" | "Low",
      "monetizationRelevance": "High" | "Medium" | "Low"
    }
  ]
}`;

    try {
      const response = await this.ai.executeStructuredCompletion<{ candidates: Omit<TopicCandidate, 'id' | 'decisionStatus' | 'createdAt'>[] }>(
        { systemPrompt, userPrompt, temperature: 0.4 },
        jobId
      );

      const candidates: TopicCandidate[] = response.data.candidates.map((c) => {
        const candidate: TopicCandidate = {
          id: 'top_' + Math.random().toString(36).substring(2, 9),
          topic: c.topic,
          suggestedTitle: c.suggestedTitle,
          category: c.category || settings.subNiches[0] || 'General Tech',
          keywords: Array.isArray(c.keywords) ? c.keywords : [c.topic],
          reason: c.reason || 'High editorial relevance',
          freshness: c.freshness || 'Trending',
          availableResearch: c.availableResearch || 'Empirical web documentation',
          sourceCount: typeof c.sourceCount === 'number' ? c.sourceCount : 5,
          duplicateRisk: c.duplicateRisk || 'Low',
          contentGap: c.contentGap || 'High',
          socialPotential: c.socialPotential || 'High',
          evergreenPotential: c.evergreenPotential || 'High',
          monetizationRelevance: c.monetizationRelevance || 'High',
          decisionStatus: 'DISCOVERED',
          createdAt: new Date().toISOString(),
        };

        this.storage.addTopic(candidate);
        return candidate;
      });

      this.storage.addLog({
        agentName: 'TopicScoutAgent',
        level: 'SUCCESS',
        message: `Discovered ${candidates.length} new topics. Best pick: "${candidates[0]?.suggestedTitle}"`,
        jobId,
      });

      return candidates;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.storage.addLog({
        agentName: 'TopicScoutAgent',
        level: 'ERROR',
        message: `Topic discovery encountered error: ${msg}`,
        jobId,
      });
      throw err;
    }
  }
}
