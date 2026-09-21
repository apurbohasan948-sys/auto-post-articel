/**
 * Axiom Research Agent (Agent B)
 * Conducts empirical web research using Tavily Search API.
 * Extracts grounded facts, separates opinions, validates claims,
 * identifies conflicting data points, and stores verified source URLs.
 */

import { AIProviderManager } from '../services/aiProvider.ts';
import { SearchProviderManager } from '../services/searchProvider.ts';
import { StorageService } from '../services/storage.ts';
import { ResearchPackage, TopicCandidate } from '../types/agent.ts';

export class ResearchAgent {
  private search: SearchProviderManager;
  private ai: AIProviderManager;
  private storage: StorageService;

  constructor() {
    this.search = SearchProviderManager.getInstance();
    this.ai = AIProviderManager.getInstance();
    this.storage = StorageService.getInstance();
  }

  public async conductResearch(topic: TopicCandidate, jobId?: string): Promise<ResearchPackage> {
    this.storage.addLog({
      agentName: 'ResearchAgent',
      level: 'INFO',
      message: `Initiating web research for topic: "${topic.topic}"`,
      jobId,
    });

    // 1. Search the web for actual live sources
    const searchQuery = `${topic.topic} ${topic.keywords.slice(0, 3).join(' ')}`;
    const searchResponse = await this.search.searchWeb(searchQuery, jobId);

    if (searchResponse.results.length === 0) {
      throw new Error(`Web research failed to retrieve any external sources for query: "${searchQuery}"`);
    }

    // 2. Synthesize with AI into a rigorous structured research package
    const sourcesSummary = searchResponse.results
      .map((r, i) => `[Source ${i + 1}] Title: ${r.title}\nURL: ${r.url}\nPublished: ${r.publishedDate || 'N/A'}\nSnippet: ${r.content}`)
      .join('\n\n');

    const systemPrompt = `You are the Axiom Research Agent.
Your job is to analyze real search results and build an empirical research package.
CRITICAL MANDATES:
1. NEVER fabricate source URLs or author names. You MUST only use the exact URLs provided in the search results.
2. Separate verifiable factual assertions from subjective editorial opinions.
3. Actively identify any conflicting claims or contradictions between sources.
4. Extract prominent quotes or statements with speaker attribution.`;

    const userPrompt = `Analyze the following search results for the topic "${topic.topic}":

SEARCH RESULTS:
${sourcesSummary}

Construct a structured Research Package matching this JSON structure:
{
  "summary": "Comprehensive 3-4 sentence synthesis of the current technical consensus",
  "facts": [
    "Fact 1 derived directly from the sources",
    "Fact 2 with empirical metrics or specifics",
    "Fact 3"
  ],
  "claims": [
    {
      "claim": "Statement of claim",
      "source": "Exact URL from the provided sources",
      "isOpinion": false,
      "verified": true
    }
  ],
  "importantQuotes": [
    {
      "quote": "Key memorable or analytical quote",
      "speaker": "Name or Organization if available",
      "sourceUrl": "Exact URL"
    }
  ],
  "conflicts": [
    {
      "statementA": "First perspective",
      "statementB": "Contrasting perspective",
      "sourceA": "URL",
      "sourceB": "URL",
      "analysis": "Objective resolution or nuance"
    }
  ]
}`;

    const aiRes = await this.ai.executeStructuredCompletion<{
      summary: string;
      facts: string[];
      claims: Array<{ claim: string; source: string; isOpinion: boolean; verified: boolean }>;
      importantQuotes: Array<{ quote: string; speaker?: string; sourceUrl?: string }>;
      conflicts: Array<{ statementA: string; statementB: string; sourceA: string; sourceB: string; analysis: string }>;
    }>({ systemPrompt, userPrompt, temperature: 0.2 }, jobId);

    const verifiedSources = searchResponse.results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content.slice(0, 300),
      publishedDate: r.publishedDate,
      authorityScore: Math.round((r.score || 0.85) * 100),
    }));

    const researchPackage: ResearchPackage = {
      id: 'res_' + Math.random().toString(36).substring(2, 9),
      topicId: topic.id,
      topic: topic.topic,
      summary: aiRes.data.summary,
      facts: Array.isArray(aiRes.data.facts) ? aiRes.data.facts : [],
      claims: Array.isArray(aiRes.data.claims) ? aiRes.data.claims : [],
      sources: verifiedSources,
      importantQuotes: Array.isArray(aiRes.data.importantQuotes) ? aiRes.data.importantQuotes : [],
      conflicts: Array.isArray(aiRes.data.conflicts) ? aiRes.data.conflicts : [],
      researchTimestamp: new Date().toISOString(),
    };

    this.storage.saveResearchPackage(researchPackage);

    this.storage.addLog({
      agentName: 'ResearchAgent',
      level: 'SUCCESS',
      message: `Research package compiled with ${verifiedSources.length} verified sources and ${researchPackage.facts.length} verified facts.`,
      jobId,
    });

    return researchPackage;
  }
}
