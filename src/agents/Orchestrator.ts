import { TopicScoutAgent } from './TopicScoutAgent';
import { ResearchAgent } from './ResearchAgent';
import { WriterAgent } from './WriterAgent';
import { QualityFactCheckerAgent } from './QualityFactCheckerAgent';
import { BloggerPublisherAgent } from './BloggerPublisherAgent';
import { SocialDistributionAgent } from './SocialDistributionAgent';
import { appStorage } from '../services/storage';
import { ArticleItem } from '../types/agent';

export interface PipelineProgress {
  currentStage: string;
  percent: number;
  activeAgent: string;
  article?: ArticleItem;
}

export class PipelineOrchestrator {
  /**
   * Executes the full autonomous lifecycle:
   * 1. Topic Scout -> 2. Deep Research -> 3. Writer -> 4. Fact Check -> 5. Blogger Publish -> 6. Social Distribution
   */
  public static async runFullPipeline(
    niche: string = 'AI & Automated Publishing',
    onProgress?: (progress: PipelineProgress) => void
  ): Promise<ArticleItem> {
    appStorage.addLog('Orchestrator', 'info', `Starting autonomous content pipeline for niche "${niche}".`);

    // Stage 1: Topic Scout
    onProgress?.({ currentStage: 'Discovering High-Impact Topics', percent: 15, activeAgent: 'TopicScoutAgent' });
    const topics = await TopicScoutAgent.discoverTopics(niche);
    const chosenTopic = topics[0];

    // Stage 2: Grounded Research
    onProgress?.({ currentStage: 'Gathering Verified Research Citations', percent: 35, activeAgent: 'ResearchAgent' });
    const research = await ResearchAgent.researchTopic(chosenTopic);

    // Stage 3: Autonomous Writing
    onProgress?.({ currentStage: 'Drafting Comprehensive Article', percent: 60, activeAgent: 'WriterAgent' });
    const article = await WriterAgent.writeArticle(chosenTopic, research);

    // Stage 4: Fact Check & Quality Audit
    onProgress?.({ currentStage: 'Auditing Factual Claims & SEO', percent: 80, activeAgent: 'QualityFactCheckerAgent' });
    await QualityFactCheckerAgent.evaluateArticle(article);

    // Stage 5: Blogger Auto-Publish
    onProgress?.({ currentStage: 'Publishing to Enabled Blogger Accounts', percent: 90, activeAgent: 'BloggerPublisherAgent', article });
    await BloggerPublisherAgent.publish(article);

    // Stage 6: Social Media Syndication
    onProgress?.({ currentStage: 'Distributing Across Social Channels', percent: 100, activeAgent: 'SocialDistributionAgent', article });
    await SocialDistributionAgent.distribute(article);

    appStorage.addLog('Orchestrator', 'success', `Full pipeline completed successfully for "${article.title}".`);
    return article;
  }
}
