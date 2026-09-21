/**
 * Axiom Memory & Learning Agent (Agent L)
 * Maintains persistent catalog memory, identifies topical coverage gaps,
 * prevents repetitive keyword exhaustion, and indexes high-performing content patterns.
 */

import { StorageService } from '../services/storage.ts';
import { AgentMemory, Article } from '../types/agent.ts';

export class MemoryLearningAgent {
  private storage: StorageService;

  constructor() {
    this.storage = StorageService.getInstance();
  }

  public getMemory(): AgentMemory {
    return this.storage.getMemory();
  }

  /**
   * Ingests a newly published article into long-term agent memory.
   */
  public async recordCycle(article: Article, jobId?: string): Promise<AgentMemory> {
    const memory = this.storage.getMemory();

    // 1. Add to published topics index
    const exists = memory.publishedTopics.some((p) => p.title.toLowerCase() === article.title.toLowerCase());
    if (!exists) {
      memory.publishedTopics.unshift({
        title: article.title,
        category: article.focusKeywords[0] || 'General Tech',
        publishedAt: new Date().toISOString(),
        keywords: article.focusKeywords,
      });
      // Keep last 50 topics
      if (memory.publishedTopics.length > 50) {
        memory.publishedTopics = memory.publishedTopics.slice(0, 50);
      }
    }

    memory.totalArticlesPublished += 1;

    // 2. Discover new candidate gap keywords derived from article references
    const newKeywords = article.secondaryKeywords.filter((k) => !memory.gapKeywords.includes(k));
    if (newKeywords.length > 0) {
      memory.gapKeywords = [...memory.gapKeywords, ...newKeywords].slice(0, 20);
    }

    // 3. Record verified pattern
    const patternEntry = `In-depth breakdown of "${article.title}" yielded full quality pass with ${article.faq.length} FAQs and ${article.externalReferences.length} verified citations.`;
    if (!memory.successfulPatterns.includes(patternEntry)) {
      memory.successfulPatterns.unshift(patternEntry);
      if (memory.successfulPatterns.length > 10) {
        memory.successfulPatterns = memory.successfulPatterns.slice(0, 10);
      }
    }

    this.storage.updateMemory(memory);

    this.storage.addLog({
      agentName: 'MemoryLearningAgent',
      level: 'SUCCESS',
      message: `Memory updated. Indexed "${article.title}". Active memory catalog: ${memory.publishedTopics.length} topics, ${memory.gapKeywords.length} gap keywords.`,
      jobId,
    });

    return memory;
  }
}
