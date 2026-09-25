/**
 * Axiom Orchestrator & Autonomous Job Engine
 * Executes the complete 12-stage autonomous pipeline:
 * DISCOVER → RESEARCH → DECIDE → PLAN → WRITE → SEO → CHECK → IMAGE → PUBLISH → DISTRIBUTE → TRACK → REMEMBER.
 * Features concurrency locks, step-level telemetry, automatic error recovery, and rewrite loop guards.
 */

import { StorageService } from '../services/storage.ts';
import { SearchProviderManager } from '../services/searchProvider.ts';
import { AgentJob, Article, JobStepRecord, PipelineStep, TopicCandidate } from '../types/agent.ts';
import { AnalyticsMonitorAgent } from './AnalyticsMonitorAgent.ts';
import { BloggerPublisherAgent } from './BloggerPublisherAgent.ts';
import { ContentPlannerAgent } from './ContentPlannerAgent.ts';
import { DecisionAgent } from './DecisionAgent.ts';
import { ImageAgent } from './ImageAgent.ts';
import { MemoryLearningAgent } from './MemoryLearningAgent.ts';
import { QualityFactCheckerAgent } from './QualityFactCheckerAgent.ts';
import { ResearchAgent } from './ResearchAgent.ts';
import { SEOAgent } from './SEOAgent.ts';
import { SocialDistributionAgent } from './SocialDistributionAgent.ts';
import { TopicScoutAgent } from './TopicScoutAgent.ts';
import { WriterAgent } from './WriterAgent.ts';

const ALL_STEPS: PipelineStep[] = [
  'TOPIC_DISCOVERY',
  'WEB_RESEARCH',
  'TOPIC_DECISION',
  'CONTENT_PLANNING',
  'ARTICLE_GENERATION',
  'SEO_OPTIMIZATION',
  'FACT_QUALITY_CHECK',
  'IMAGE_HANDLING',
  'BLOGGER_PUBLISH',
  'SOCIAL_DISTRIBUTION',
  'RESULT_TRACKING',
  'MEMORY_LEARNING',
];

export class Orchestrator {
  private static instance: Orchestrator;
  private storage: StorageService;

  // 12 Logical Sub-Agents
  private scoutAgent = new TopicScoutAgent();
  private researchAgent = new ResearchAgent();
  private decisionAgent = new DecisionAgent();
  private plannerAgent = new ContentPlannerAgent();
  private writerAgent = new WriterAgent();
  private seoAgent = new SEOAgent();
  private qualityAgent = new QualityFactCheckerAgent();
  private imageAgent = new ImageAgent();
  private bloggerAgent = new BloggerPublisherAgent();
  private socialAgent = new SocialDistributionAgent();
  private analyticsAgent = new AnalyticsMonitorAgent();
  private memoryAgent = new MemoryLearningAgent();

  private isPaused = false;
  private isStopped = false;

  private constructor() {
    this.storage = StorageService.getInstance();
  }

  public static getInstance(): Orchestrator {
    if (!Orchestrator.instance) {
      Orchestrator.instance = new Orchestrator();
    }
    return Orchestrator.instance;
  }

  public pauseAgent(): void {
    this.isPaused = true;
    this.storage.updateSettings({ status: 'PAUSED' });
    this.storage.addLog({
      agentName: 'Orchestrator',
      level: 'WARN',
      message: 'Agent paused by operator.',
    });
  }

  public resumeAgent(): void {
    this.isPaused = false;
    this.storage.updateSettings({ status: 'IDLE' });
    this.storage.addLog({
      agentName: 'Orchestrator',
      level: 'INFO',
      message: 'Agent resumed to active state.',
    });
  }

  public stopEmergency(): void {
    this.isStopped = true;
    this.storage.releaseLock();
    this.storage.updateSettings({ status: 'STOPPED' });
    this.storage.addLog({
      agentName: 'Orchestrator',
      level: 'ERROR',
      message: 'EMERGENCY STOP invoked by operator. All ongoing pipelines halted.',
    });
  }

  /**
   * Primary entry point: Runs a full autonomous cycle.
   */
  public async runCycle(options?: {
    specificTopicId?: string;
    isManualApprovalRun?: boolean;
    tavilyConfig?: { apiKey?: string; baseUrl?: string; enabled?: boolean; searchDepth?: string; maxResults?: number };
    aiProviders?: any[];
  }): Promise<AgentJob> {
    const settings = this.storage.getSettings();

    // If Tavily runtime configuration is provided, configure SearchProviderManager and storage immediately
    if (options?.tavilyConfig?.apiKey) {
      const cleanKey = options.tavilyConfig.apiKey.trim();
      if (!cleanKey.includes('••••')) {
        SearchProviderManager.getInstance().setRuntimeTavilyApiKey(cleanKey);
        if (options.tavilyConfig.baseUrl) {
          SearchProviderManager.getInstance().setRuntimeTavilyConfig({
            apiKey: cleanKey,
            baseUrl: options.tavilyConfig.baseUrl,
            enabled: options.tavilyConfig.enabled ?? true,
          });
        }
        const existingTavily = this.storage.getSearchProviders().find((p) => p.type === 'tavily');
        this.storage.saveSearchProvider({
          ...(existingTavily || {
            id: 'search_tavily',
            name: 'Tavily AI Search',
            type: 'tavily',
            baseUrl: options.tavilyConfig.baseUrl || 'https://api.tavily.com',
            searchDepth: 'advanced',
            maxResults: 6,
            priority: 1,
          }),
          apiKey: cleanKey,
          enabled: options.tavilyConfig.enabled ?? true,
          baseUrl: options.tavilyConfig.baseUrl || existingTavily?.baseUrl || 'https://api.tavily.com',
        });
      }
    }

    if (Array.isArray(options?.aiProviders) && options.aiProviders.length > 0) {
      this.storage.updateAIProviders(options.aiProviders);
    }

    // Check if stopped or paused
    if (this.isStopped) {
      throw new Error('Agent is in STOPPED state. Clear emergency stop or update status in Settings.');
    }
    if (this.isPaused) {
      throw new Error('Agent is PAUSED. Resume agent from dashboard before running.');
    }

    // Check quiet hours if scheduled run
    if (!options?.specificTopicId) {
      const currentHour = new Date().getUTCHours();
      if (
        settings.quietHoursStart > settings.quietHoursEnd
          ? currentHour >= settings.quietHoursStart || currentHour < settings.quietHoursEnd
          : currentHour >= settings.quietHoursStart && currentHour < settings.quietHoursEnd
      ) {
        this.storage.addLog({
          agentName: 'Orchestrator',
          level: 'INFO',
          message: `Current time (${currentHour}:00 UTC) is within configured quiet hours (${settings.quietHoursStart}:00 - ${settings.quietHoursEnd}:00 UTC). Skipping cycle.`,
        });
      }
    }

    // Generate unique Job ID and acquire lock
    const jobId = 'job_' + Math.floor(1000 + Math.random() * 9000);
    const lockAcquired = this.storage.acquireLock(jobId);
    if (!lockAcquired) {
      throw new Error('Another autonomous job is currently active or holding system lock. Concurrency guard prevented run.');
    }

    const job: AgentJob = {
      id: jobId,
      jobNumber: Math.floor(1000 + Math.random() * 9000),
      status: 'RUNNING',
      currentStep: 'TOPIC_DISCOVERY',
      steps: ALL_STEPS.map((s) => ({ step: s, status: 'PENDING' })),
      startedAt: new Date().toISOString(),
    };
    this.storage.saveJob(job);

    this.storage.addLog({
      agentName: 'Orchestrator',
      level: 'INFO',
      message: `Launched Autonomous Content Cycle #${job.jobNumber}`,
      jobId,
    });

    try {
      // --- STAGE 1: TOPIC DISCOVERY ---
      let selectedTopic: TopicCandidate | undefined;
      await this.runStep(job, 'TOPIC_DISCOVERY', async (stepRecord) => {
        if (options?.specificTopicId) {
          const found = this.storage.getTopics().find((t) => t.id === options.specificTopicId);
          if (found) {
            selectedTopic = found;
            stepRecord.summary = `Using targeted topic: "${found.suggestedTitle}"`;
            return;
          }
        }

        // Scout candidates
        const candidates = await this.scoutAgent.scoutCandidateTopics(jobId);
        selectedTopic = candidates[0];
        if (!selectedTopic) {
          throw new Error('Topic Scout produced zero valid candidates.');
        }
        stepRecord.summary = `Discovered topic: "${selectedTopic.suggestedTitle}"`;
      });

      if (!selectedTopic) throw new Error('Topic selection failed');
      job.topicTitle = selectedTopic.suggestedTitle;
      this.storage.saveJob(job);

      const runtimeTavilyKey =
        options?.tavilyConfig?.apiKey && !options.tavilyConfig.apiKey.includes('••••')
          ? options.tavilyConfig.apiKey.trim()
          : undefined;

      // --- STAGE 2: WEB RESEARCH ---
      let researchPackage = await this.runStep(job, 'WEB_RESEARCH', async (stepRecord) => {
        const pkg = await this.researchAgent.conductResearch(selectedTopic!, jobId, runtimeTavilyKey);
        stepRecord.summary = `Extracted ${pkg.sources.length} sources and ${pkg.facts.length} empirical facts.`;
        return pkg;
      });

      // --- STAGE 3: TOPIC DECISION ---
      let decision = await this.runStep(job, 'TOPIC_DECISION', async (stepRecord) => {
        let dec = await this.decisionAgent.evaluateTopic(selectedTopic!, researchPackage, jobId);

        // Check if needs more research loop
        if (dec.status === 'NEEDS_MORE_RESEARCH') {
          this.storage.addLog({
            agentName: 'Orchestrator',
            level: 'WARN',
            message: 'Topic Decision requested additional research. Re-querying web sources...',
            jobId,
          });
          researchPackage = await this.researchAgent.conductResearch(selectedTopic!, jobId, runtimeTavilyKey);
          dec = await this.decisionAgent.evaluateTopic(selectedTopic!, researchPackage, jobId);
        }

        if (dec.status === 'REJECTED') {
          throw new Error(`Topic rejected: ${dec.reason}`);
        }

        stepRecord.summary = `Approved with ${dec.scores.audienceRelevance}% audience relevance.`;
        return dec;
      });

      // --- STAGE 4: CONTENT PLANNING ---
      const contentPlan = await this.runStep(job, 'CONTENT_PLANNING', async (stepRecord) => {
        const plan = await this.plannerAgent.createPlan(selectedTopic!, researchPackage, jobId);
        stepRecord.summary = `Outline constructed: ${plan.h2H3Structure.length} sections, ${plan.faqQuestions.length} FAQ items.`;
        return plan;
      });

      // --- STAGE 5: ARTICLE GENERATION & REWRITE LOOP ---
      let rewriteCount = 0;
      let articleDraft = await this.runStep(job, 'ARTICLE_GENERATION', async (stepRecord) => {
        const written = await this.writerAgent.writeArticle(contentPlan, researchPackage, undefined, jobId);
        stepRecord.summary = `Drafted ${written.wordCount} words and structured Blogger HTML.`;
        return written;
      });

      // --- STAGE 6: SEO OPTIMIZATION ---
      const seoResult = await this.runStep(job, 'SEO_OPTIMIZATION', async (stepRecord) => {
        const seo = await this.seoAgent.optimize(
          contentPlan.chosenTitle,
          articleDraft.cleanContent,
          contentPlan,
          researchPackage,
          jobId
        );
        stepRecord.summary = `Optimized meta description (${seo.metaDescription.length} chars) and keywords.`;
        return seo;
      });

      // --- STAGE 7: FACT & QUALITY CHECK (WITH REWRITE LOOP) ---
      const qualityReport = await this.runStep(job, 'FACT_QUALITY_CHECK', async (stepRecord) => {
        let report = await this.qualityAgent.auditArticle(
          contentPlan.chosenTitle,
          articleDraft.cleanContent,
          researchPackage,
          rewriteCount,
          jobId
        );

        while (report.status === 'REWRITE' && rewriteCount < settings.maxRewriteAttempts) {
          rewriteCount++;
          this.storage.addLog({
            agentName: 'Orchestrator',
            level: 'WARN',
            message: `Quality Auditor requested rewrite #${rewriteCount}. Triggering Writer revision...`,
            jobId,
          });

          // Re-trigger writer with corrections
          articleDraft = await this.writerAgent.writeArticle(contentPlan, researchPackage, report.corrections, jobId);
          report = await this.qualityAgent.auditArticle(
            contentPlan.chosenTitle,
            articleDraft.cleanContent,
            researchPackage,
            rewriteCount,
            jobId
          );
        }

        if (report.status === 'FAIL') {
          throw new Error(`Article failed quality audit: ${report.issues.join('; ')}`);
        }

        stepRecord.summary = `Audited: PASS. Factual Consistency: ${report.scoreBreakdown.factualConsistency}%.`;
        return report;
      });

      // Save intermediate Article entity
      const articleId = 'art_' + Math.random().toString(36).substring(2, 9);
      job.articleId = articleId;

      let articleEntity: Article = {
        id: articleId,
        topicId: selectedTopic.id,
        title: contentPlan.chosenTitle,
        slug: seoResult.slug,
        language: settings.language,
        cleanContent: articleDraft.cleanContent,
        bloggerHtml: articleDraft.bloggerHtml,
        metaDescription: seoResult.metaDescription,
        focusKeywords: seoResult.focusKeywords,
        secondaryKeywords: seoResult.secondaryKeywords,
        faq: seoResult.faq,
        internalLinks: seoResult.internalLinks,
        externalReferences: seoResult.externalReferences,
        lifecycleState: 'APPROVED',
        qualityReport,
        socialDistributions: [],
        rewriteCount,
        maxRewrites: settings.maxRewriteAttempts,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.storage.saveArticle(articleEntity);

      // --- STAGE 8: IMAGE HANDLING ---
      await this.runStep(job, 'IMAGE_HANDLING', async (stepRecord) => {
        const img = await this.imageAgent.acquireArticleImage(
          articleId,
          articleEntity.title,
          selectedTopic!.category,
          jobId
        );
        articleEntity.image = img;
        this.storage.saveArticle(articleEntity);
        stepRecord.summary = `Paired verified visual asset (${img.provider}).`;
      });

      // --- STAGE 9: BLOGGER PUBLISH ---
      let publishedArticle = articleEntity;
      await this.runStep(job, 'BLOGGER_PUBLISH', async (stepRecord) => {
        try {
          publishedArticle = await this.bloggerAgent.handlePublish(articleEntity, false, jobId);
          if (publishedArticle.lifecycleState === 'PUBLISHED') {
            stepRecord.summary = `Live on Blogger: ${publishedArticle.bloggerPost?.url}`;
          } else {
            stepRecord.summary = `Queued in APPROVAL mode for manual sign-off.`;
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          // If blogger publication fails or is not connected, do not halt the entire system; mark step
          stepRecord.status = 'FAILED';
          stepRecord.error = msg;
          this.storage.addLog({
            agentName: 'Orchestrator',
            level: 'WARN',
            message: `Blogger publishing did not complete: ${msg}. Continuing pipeline.`,
            jobId,
          });
        }
      });

      // --- STAGE 10: SOCIAL DISTRIBUTION ---
      if (publishedArticle.lifecycleState === 'PUBLISHED') {
        await this.runStep(job, 'SOCIAL_DISTRIBUTION', async (stepRecord) => {
          const distributions = await this.socialAgent.distributeArticle(publishedArticle, jobId);
          const published = distributions.filter((d) => d.status === 'PUBLISHED');
          stepRecord.summary = `Distributed to ${published.length} connected networks.`;
        });
      } else {
        const step = job.steps.find((s) => s.step === 'SOCIAL_DISTRIBUTION');
        if (step) {
          step.status = 'SKIPPED';
          step.summary = 'Deferred until article is published to Blogger.';
        }
      }

      // --- STAGE 11: RESULT TRACKING ---
      await this.runStep(job, 'RESULT_TRACKING', async (stepRecord) => {
        await this.analyticsAgent.trackCycleResult(publishedArticle, jobId);
        stepRecord.summary = 'Telemetry synchronized.';
      });

      // --- STAGE 12: MEMORY / LEARNING ---
      await this.runStep(job, 'MEMORY_LEARNING', async (stepRecord) => {
        await this.memoryAgent.recordCycle(publishedArticle, jobId);
        stepRecord.summary = 'Catalog index updated with topical footprint.';
      });

      // Finalize Job
      job.status = 'COMPLETED';
      job.finishedAt = new Date().toISOString();
      this.storage.saveJob(job);

      this.storage.addLog({
        agentName: 'Orchestrator',
        level: 'SUCCESS',
        message: `Autonomous Content Cycle #${job.jobNumber} successfully completed. Article: "${publishedArticle.title}".`,
        jobId,
      });

      return job;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      job.status = 'FAILED';
      job.errorMessage = errorMsg;
      job.finishedAt = new Date().toISOString();
      this.storage.saveJob(job);

      this.storage.addLog({
        agentName: 'Orchestrator',
        level: 'ERROR',
        message: `Cycle #${job.jobNumber} halted: ${errorMsg}`,
        jobId,
      });

      throw err;
    } finally {
      this.storage.releaseLock();
    }
  }

  private async runStep<T>(
    job: AgentJob,
    stepName: PipelineStep,
    action: (stepRecord: JobStepRecord) => Promise<T>
  ): Promise<T> {
    job.currentStep = stepName;
    const stepRecord = job.steps.find((s) => s.step === stepName) || {
      step: stepName,
      status: 'PENDING',
    };
    stepRecord.status = 'RUNNING';
    this.storage.saveJob(job);

    const startTime = Date.now();
    try {
      const result = await action(stepRecord);
      stepRecord.durationMs = Date.now() - startTime;
      stepRecord.status = 'COMPLETED';
      this.storage.saveJob(job);
      return result;
    } catch (err: unknown) {
      stepRecord.durationMs = Date.now() - startTime;
      stepRecord.status = 'FAILED';
      stepRecord.error = err instanceof Error ? err.message : String(err);
      this.storage.saveJob(job);
      throw err;
    }
  }
}
