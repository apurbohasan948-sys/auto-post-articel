/**
 * Axiom Autonomous AI Content Agent - Types & Data Contracts
 * Strict type definitions for 12 logical agents, job engine, research, quality checks, and providers.
 */

export type AgentStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR';
export type AgentMode = 'AUTO' | 'APPROVAL';
export type ArticleLanguage = 'English' | 'Bengali' | 'Banglish';

export type PipelineStep =
  | 'TOPIC_DISCOVERY'
  | 'WEB_RESEARCH'
  | 'TOPIC_DECISION'
  | 'CONTENT_PLANNING'
  | 'ARTICLE_GENERATION'
  | 'SEO_OPTIMIZATION'
  | 'FACT_QUALITY_CHECK'
  | 'IMAGE_HANDLING'
  | 'BLOGGER_PUBLISH'
  | 'SOCIAL_DISTRIBUTION'
  | 'RESULT_TRACKING'
  | 'MEMORY_LEARNING';

export type ArticleLifecycle =
  | 'DISCOVERED'
  | 'RESEARCHING'
  | 'PLANNED'
  | 'WRITING'
  | 'QUALITY_CHECK'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'DISTRIBUTED'
  | 'FAILED'
  | 'ARCHIVED';

export type TopicDecisionStatus = 'DISCOVERED' | 'APPROVED' | 'REJECTED' | 'NEEDS_MORE_RESEARCH';

export interface BloggerConfig {
  blogId: string;
  blogUrl: string;
  defaultLabels: string[];
  isConnected: boolean;
}

export interface TopicCandidate {
  id: string;
  topic: string;
  suggestedTitle: string;
  category: string;
  keywords: string[];
  reason: string;
  freshness: 'Breaking' | 'Trending' | 'Evergreen' | 'Educational';
  availableResearch: string;
  sourceCount: number;
  duplicateRisk: 'Low' | 'Medium' | 'High';
  contentGap: 'High' | 'Moderate' | 'Low';
  socialPotential: 'Viral' | 'High' | 'Moderate';
  evergreenPotential: 'High' | 'Medium' | 'Low';
  monetizationRelevance: 'High' | 'Medium' | 'Low';
  decisionStatus: TopicDecisionStatus;
  rejectionReason?: string;
  createdAt: string;
  angleDescription?: string;
  freshnessScore?: number;
  searchDemandScore?: number;
  socialPotentialScore?: number;
  duplicateRiskScore?: number;
  discoveredAt?: string;
}

export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  authorityScore?: number;
}

export interface ResearchClaim {
  claim: string;
  source: string;
  isOpinion: boolean;
  verified: boolean;
}

export interface ResearchConflict {
  statementA: string;
  statementB: string;
  sourceA: string;
  sourceB: string;
  analysis: string;
}

export interface ResearchPackage {
  id: string;
  topicId: string;
  topic: string;
  summary: string;
  facts: string[];
  claims: ResearchClaim[];
  sources: ResearchSource[];
  importantQuotes: Array<{
    quote: string;
    speaker?: string;
    sourceUrl?: string;
  }>;
  conflicts: ResearchConflict[];
  researchTimestamp: string;
}

export interface TopicDecisionResult {
  status: 'APPROVED' | 'REJECTED' | 'NEEDS_MORE_RESEARCH';
  reason: string;
  scores: {
    evidenceSufficiency: number; // 0-100
    audienceRelevance: number;   // 0-100
    sourceCredibility: number;   // 0-100
    originalityIndex: number;    // 0-100
    policySafetyPassed: boolean;
  };
  checkedAt: string;
}

export interface ContentPlan {
  seoTitleOptions: string[];
  chosenTitle: string;
  slug: string;
  metaDescription: string;
  introduction: string;
  h2H3Structure: Array<{
    heading: string;
    level: 'H2' | 'H3';
    keyPoints: string[];
  }>;
  importantFacts: string[];
  sourceReferences: string[];
  faqQuestions: Array<{
    question: string;
    answerSummary: string;
  }>;
  conclusion: string;
  internalLinkingOpportunities: string[];
  externalSourceReferences: string[];
}

export interface QualityReport {
  status: 'PASS' | 'FAIL' | 'REWRITE';
  issues: string[];
  corrections: string[];
  unsupportedClaims: string[];
  scoreBreakdown: {
    factualConsistency: number; // 0-100
    sourceSupport: number;      // 0-100
    grammarReadability: number;  // 0-100
    seoStructure: number;       // 0-100
    originality: number;        // 0-100
  };
  checkedAt: string;
}

export interface ArticleImage {
  imageUrl: string;
  provider: 'gemini' | 'unsplash' | 'source' | 'fallback';
  prompt: string;
  altText: string;
  articleId: string;
}

export interface BloggerPostMeta {
  blogId: string;
  postId: string;
  url: string;
  labels: string[];
  publishedAt: string;
  idempotencyHash: string;
}

export interface SocialPost {
  id: string;
  platform: 'facebook' | 'x' | 'threads' | 'telegram' | 'linkedin';
  platformPostId?: string;
  content: string;
  status: 'PENDING' | 'PUBLISHED' | 'FAILED' | 'SKIPPED';
  publishedUrl?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
  publishedAt?: string;
}

export interface Article {
  id: string;
  topicId: string;
  title: string;
  slug: string;
  language: ArticleLanguage;
  cleanContent: string;
  bloggerHtml: string;
  metaDescription: string;
  focusKeywords: string[];
  secondaryKeywords: string[];
  faq: Array<{ question: string; answer: string }>;
  internalLinks: string[];
  externalReferences: string[];
  image?: ArticleImage;
  lifecycleState: ArticleLifecycle;
  qualityReport?: QualityReport;
  bloggerPost?: BloggerPostMeta;
  socialDistributions: SocialPost[];
  rewriteCount: number;
  maxRewrites: number;
  createdAt: string;
  updatedAt: string;
}

export type ProviderTestStatus = 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'RATE_LIMITED' | 'NEVER_TESTED';

export interface ProviderUsageInfo {
  requestsToday?: number;
  tokensToday?: number;
  remainingQuota?: string | number;
  rateLimit?: string | number;
  resetTime?: string;
  hasUsageData: boolean;
  message?: string;
  usage?: number;
  limit?: number;
  isFreeTier?: boolean;
}

export interface AICapabilities {
  jsonMode?: boolean;
  toolCalling?: boolean;
  webGrounding?: boolean;
  vision?: boolean;
}

export interface AIProviderConfig {
  id: string;
  name: string;
  type: 'openrouter' | 'gemini' | 'openai-compatible' | 'custom' | 'custom_openai' | 'custom_rest';
  baseUrl: string;
  apiKey: string;
  hasKey?: boolean;
  modelName: string;
  defaultModel?: string;
  priority: number;
  enabled: boolean;
  timeoutMs: number;
  maxRetries?: number;
  maxTokens?: number;
  temperature?: number;
  headers?: Record<string, string>;
  capabilities?: AICapabilities;
  lastTestedAt?: string;
  lastTestStatus?: ProviderTestStatus;
  lastError?: string;
  lastLatencyMs?: number;
  usageInfo?: ProviderUsageInfo;
  createdAt?: string;
  updatedAt?: string;
}

export interface SearchProviderConfig {
  id: string;
  name: string;
  type: 'tavily' | 'serpapi' | 'brave' | 'serper' | 'perplexity' | 'custom';
  apiKey: string;
  hasKey?: boolean;
  baseUrl: string;
  searchDepth?: 'basic' | 'advanced';
  maxResults?: number;
  topic?: string;
  timeoutMs?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  priority: number;
  enabled: boolean;
  lastTestedAt?: string;
  lastTestStatus?: ProviderTestStatus;
  lastError?: string;
  lastLatencyMs?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiTestHistoryItem {
  id: string;
  providerId: string;
  providerName: string;
  providerType: 'ai' | 'search' | string;
  modelOrQuery?: string;
  target?: string;
  timestamp: string;
  result?: 'SUCCESS' | 'FAILED' | string;
  status?: ProviderTestStatus | string;
  latencyMs: number;
  httpStatus?: number;
  error?: string;
  summary?: string;
  sampleOutput?: string;
}

export interface AITestResult {
  success: boolean;
  status: number | string;
  model?: string;
  latencyMs: number;
  output?: string;
  sampleOutput?: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  usageInfo?: ProviderUsageInfo;
  error?: string;
  timestamp: string;
  providerId?: string;
}

export interface SearchTestResult {
  success: boolean;
  status: number | string;
  latencyMs: number;
  resultCount?: number;
  resultsCount?: number;
  results?: Array<{
    title: string;
    url: string;
    content?: string;
    snippet?: string;
    score?: number;
  }>;
  rawResults?: Array<{
    title: string;
    url: string;
    content?: string;
    snippet?: string;
    score?: number;
  }>;
  sampleTitles?: string[];
  error?: string;
  timestamp: string;
  providerId?: string;
}

export interface JobStepRecord {
  step: PipelineStep;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  durationMs?: number;
  summary?: string;
  error?: string;
}

export interface AgentJob {
  id: string;
  jobNumber: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED';
  currentStep?: PipelineStep;
  articleId?: string;
  topicTitle?: string;
  steps: JobStepRecord[];
  startedAt: string;
  finishedAt?: string;
  errorMessage?: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  jobId?: string;
  agentName: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface SystemSettings {
  niche: string;
  contentNiche?: string;
  subNiches: string[];
  targetAudience: string;
  language: ArticleLanguage;
  countryRegion: string;
  keywords: string[];
  excludedKeywords: string[];
  articleFrequencyPerDay: number;
  mode: AgentMode;
  status: AgentStatus;
  quietHoursStart: number; // 0-23
  quietHoursEnd: number;   // 0-23
  timezone: string;
  activeDays: string[];
  maxAiCallsPerDay: number;
  maxAICallsPerDay?: number;
  maxResearchCallsPerDay: number;
  maxWebSearchesPerDay?: number;
  maxArticlesPerDay: number;
  maxTokensPerArticle: number;
  maxRewriteAttempts: number;
  todayStats: {
    aiCalls: number;
    researchCalls: number;
    articlesPublished: number;
    socialPostsCreated: number;
    date?: string;
  };
}

export interface AgentMemory {
  publishedTopics: Array<{
    title: string;
    category: string;
    publishedAt: string;
    keywords: string[];
  }>;
  successfulPatterns: string[];
  failedPatterns: string[];
  gapKeywords: string[];
  totalArticlesPublished: number;
  lastCycleTimestamp: string;
}

export interface ProviderHealth {
  openrouter: 'ONLINE' | 'OFFLINE' | 'NOT_CONFIGURED';
  gemini: 'ONLINE' | 'OFFLINE' | 'NOT_CONFIGURED';
  tavily: 'ONLINE' | 'OFFLINE' | 'NOT_CONFIGURED';
  blogger: 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONFIGURED';
  facebook: 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONFIGURED';
  telegram: 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONFIGURED';
  linkedin: 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONFIGURED';
  x: 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONFIGURED';
  threads: 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONFIGURED';
}
