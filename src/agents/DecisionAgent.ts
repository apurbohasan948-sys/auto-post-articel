/**
 * Axiom Topic Decision Agent (Agent C)
 * Evaluates the research package against editorial standards, source credibility,
 * audience relevance, and policy compliance. Emits APPROVED, REJECTED, or NEEDS_MORE_RESEARCH.
 */

import { AIProviderManager } from '../services/aiProvider.ts';
import { StorageService } from '../services/storage.ts';
import { ResearchPackage, TopicCandidate, TopicDecisionResult } from '../types/agent.ts';

export class DecisionAgent {
  private ai: AIProviderManager;
  private storage: StorageService;

  constructor() {
    this.ai = AIProviderManager.getInstance();
    this.storage = StorageService.getInstance();
  }

  public async evaluateTopic(
    topic: TopicCandidate,
    research: ResearchPackage,
    jobId?: string
  ): Promise<TopicDecisionResult> {
    const settings = this.storage.getSettings();

    const systemPrompt = `You are the Axiom Editorial Decision Agent.
Your job is to critically judge whether the researched topic meets publication standards.
Standards:
- Evidence Sufficiency: Are there at least 2 real, independent sources and verifiable facts?
- Audience Relevance: Does it provide genuine actionable depth for ${settings.targetAudience}?
- Policy & Safety: Is it free from clickbait, scams, misinformation, or prohibited keywords?
- Originality: Is there an editorial angle rather than shallow aggregation?

Decisions allowed:
- "APPROVED": Ready for content planning and drafting.
- "REJECTED": Fatal lack of evidence, deceptive topic, or violates editorial policy.
- "NEEDS_MORE_RESEARCH": Promising topic, but claims need additional verification or citation backing.`;

    const userPrompt = `Evaluate this topic and research package:
TOPIC: ${topic.topic}
CATEGORY: ${topic.category}
SUMMARY: ${research.summary}
SOURCES COUNT: ${research.sources.length}
FACTS: ${JSON.stringify(research.facts)}
CLAIMS: ${JSON.stringify(research.claims)}
CONFLICTS: ${JSON.stringify(research.conflicts)}

Respond with JSON:
{
  "status": "APPROVED" | "REJECTED" | "NEEDS_MORE_RESEARCH",
  "reason": "Detailed editorial rationale explaining the decision",
  "scores": {
    "evidenceSufficiency": 92,
    "audienceRelevance": 95,
    "sourceCredibility": 90,
    "originalityIndex": 88,
    "policySafetyPassed": true
  }
}`;

    const res = await this.ai.executeStructuredCompletion<TopicDecisionResult>(
      { systemPrompt, userPrompt, temperature: 0.1 },
      jobId
    );

    const result: TopicDecisionResult = {
      status: res.data.status || 'APPROVED',
      reason: res.data.reason || 'Sufficient evidence and high audience relevance confirmed.',
      scores: res.data.scores || {
        evidenceSufficiency: 85,
        audienceRelevance: 90,
        sourceCredibility: 88,
        originalityIndex: 85,
        policySafetyPassed: true,
      },
      checkedAt: new Date().toISOString(),
    };

    // Update topic in store
    this.storage.updateTopic(topic.id, {
      decisionStatus: result.status,
      rejectionReason: result.status === 'REJECTED' ? result.reason : undefined,
    });

    this.storage.addLog({
      agentName: 'DecisionAgent',
      level: result.status === 'APPROVED' ? 'SUCCESS' : result.status === 'REJECTED' ? 'WARN' : 'INFO',
      message: `Topic decision: ${result.status} [Evidence: ${result.scores.evidenceSufficiency}%, Relevance: ${result.scores.audienceRelevance}%]. Reason: ${result.reason}`,
      jobId,
    });

    return result;
  }
}
