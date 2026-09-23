/**
 * Axiom Persistent Storage Layer
 * Thread-safe local file persistence compatible with Netlify Functions and local Node server.
 * Handles locking, idempotency checks, and pre-seeded sample data.
 */

import fs from 'fs';
import path from 'path';
import { DatabaseEngine } from './db.ts';
import {
  AgentJob,
  AgentMemory,
  AIProviderConfig,
  ApiTestHistoryItem,
  Article,
  ResearchPackage,
  SearchProviderConfig,
  SystemLog,
  SystemSettings,
  TopicCandidate,
} from '../types/agent.ts';

interface StoreData {
  settings: SystemSettings;
  aiProviders: AIProviderConfig[];
  searchProviders: SearchProviderConfig[];
  testHistory: ApiTestHistoryItem[];
  topics: TopicCandidate[];
  researchPackages: Record<string, ResearchPackage>;
  articles: Article[];
  jobs: AgentJob[];
  logs: SystemLog[];
  memory: AgentMemory;
  bloggerConfig: {
    blogId: string;
    blogName: string;
    blogUrl: string;
    defaultLabels: string[];
    publishingMode: 'LIVE' | 'DRAFT';
    isConnected: boolean;
  };
  socialConfig: {
    facebookEnabled: boolean;
    telegramEnabled: boolean;
    linkedinEnabled: boolean;
    xEnabled: boolean;
    threadsEnabled: boolean;
  };
  lock: {
    isLocked: boolean;
    jobId?: string;
    lockedAt?: string;
  };
}

const DEFAULT_SETTINGS: SystemSettings = {
  niche: 'Generative AI & Autonomous Agent Architectures',
  subNiches: [
    'Autonomous Multi-Agent Systems',
    'Edge AI & Small Language Models',
    'AI Production Reliability & Evaluations',
    'AI Content Automation & Workflows',
  ],
  targetAudience: 'Software Engineers, AI Practitioners, and Tech Founders',
  language: 'English',
  countryRegion: 'Global',
  keywords: ['AI Agents', 'Autonomous Workflows', 'LLM Evaluations', 'Tavily Search', 'Netlify Serverless'],
  excludedKeywords: ['scam', 'crypto casino', 'clickbait'],
  articleFrequencyPerDay: 3,
  mode: 'AUTO',
  status: 'IDLE',
  quietHoursStart: 23,
  quietHoursEnd: 6,
  timezone: 'UTC',
  activeDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  maxAiCallsPerDay: 150,
  maxResearchCallsPerDay: 60,
  maxArticlesPerDay: 4,
  maxTokensPerArticle: 4000,
  maxRewriteAttempts: 3,
  todayStats: {
    aiCalls: 18,
    researchCalls: 6,
    articlesPublished: 2,
    socialPostsCreated: 6,
    date: new Date().toISOString().split('T')[0],
  },
};

const DEFAULT_AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'prov_openrouter',
    name: 'OpenRouter Primary',
    type: 'openrouter',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    modelName: process.env.OPENROUTER_DEFAULT_MODEL || 'anthropic/claude-3.5-sonnet',
    priority: 1,
    enabled: true,
    timeoutMs: 45000,
    maxRetries: 3,
    lastTestStatus: 'NEVER_TESTED',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prov_gemini',
    name: 'Gemini 3.8 Flash (Built-in)',
    type: 'gemini',
    baseUrl: '',
    apiKey: process.env.GEMINI_API_KEY || '',
    modelName: 'gemini-3.8-flash',
    priority: 2,
    enabled: true,
    timeoutMs: 30000,
    maxRetries: 3,
    lastTestedAt: new Date(Date.now() - 1800000).toISOString(),
    lastTestStatus: 'SUCCESS',
    lastLatencyMs: 980,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prov_custom_1',
    name: 'Custom OpenAI-Compatible',
    type: 'openai-compatible',
    baseUrl: process.env.CUSTOM_AI_1_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.CUSTOM_AI_1_API_KEY || '',
    modelName: process.env.CUSTOM_AI_1_MODEL || 'gpt-4o',
    priority: 3,
    enabled: false,
    timeoutMs: 45000,
    maxRetries: 2,
    lastTestStatus: 'NEVER_TESTED',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_SEARCH_PROVIDERS: SearchProviderConfig[] = [
  {
    id: 'search_tavily',
    name: 'Tavily AI Search',
    type: 'tavily',
    apiKey: process.env.TAVILY_API_KEY || '',
    baseUrl: process.env.TAVILY_BASE_URL || 'https://api.tavily.com',
    searchDepth: 'advanced',
    maxResults: 6,
    topic: 'general',
    timeoutMs: 25000,
    priority: 1,
    enabled: true,
    lastTestStatus: 'NEVER_TESTED',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'search_fallback',
    name: 'Academic & Tech Documentation Index',
    type: 'custom',
    apiKey: '',
    baseUrl: 'https://api.crossref.org',
    searchDepth: 'basic',
    maxResults: 5,
    timeoutMs: 20000,
    priority: 2,
    enabled: true,
    lastTestedAt: new Date(Date.now() - 3600000).toISOString(),
    lastTestStatus: 'SUCCESS',
    lastLatencyMs: 640,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const SEED_TEST_HISTORY: ApiTestHistoryItem[] = [
  {
    id: 'test_seed_01',
    providerId: 'prov_gemini',
    providerName: 'Gemini 3.8 Flash (Built-in)',
    providerType: 'ai',
    modelOrQuery: 'gemini-3.8-flash',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    result: 'SUCCESS',
    latencyMs: 980,
    httpStatus: 200,
    summary: 'Model gemini-3.8-flash verified response in 980ms',
  },
  {
    id: 'test_seed_02',
    providerId: 'search_fallback',
    providerName: 'Academic & Tech Documentation Index',
    providerType: 'search',
    modelOrQuery: 'autonomous agent state machines',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    result: 'SUCCESS',
    latencyMs: 640,
    httpStatus: 200,
    summary: 'Verified connection, returned 5 academic indexing records',
  },
];

const SEED_TOPICS: TopicCandidate[] = [
  {
    id: 'top_001',
    topic: 'Deterministic Agent Routing in Complex Multi-Agent LLM Orchestrations',
    suggestedTitle: 'Why Pure Autonomous Agents Need Deterministic Routing To Survive In Production',
    category: 'Autonomous Multi-Agent Systems',
    keywords: ['Agent Routing', 'Deterministic State Machines', 'LangGraph', 'LLM Reliability'],
    reason: 'Growing industry backlash against non-deterministic loop runaway errors in enterprise agent swarms.',
    freshness: 'Trending',
    availableResearch: '6 validated engineering case studies from leading AI research laboratories.',
    sourceCount: 6,
    duplicateRisk: 'Low',
    contentGap: 'High',
    socialPotential: 'Viral',
    evergreenPotential: 'High',
    monetizationRelevance: 'High',
    decisionStatus: 'APPROVED',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'top_002',
    topic: 'Evaluating Small Language Models (SLMs) on Serverless Edge Runtimes',
    suggestedTitle: 'Benchmarking 3B to 8B Parameter Models on Serverless & Cloud Functions: 2026 Reality Check',
    category: 'Edge AI & Small Language Models',
    keywords: ['Edge AI', 'SLMs', 'Serverless Inference', 'Cold Start Latency'],
    reason: 'High interest in cutting cloud API inference bills using quantized on-device models.',
    freshness: 'Trending',
    availableResearch: 'Multiple public ML benchmarks on WASM and ONNX runtime cold-starts.',
    sourceCount: 5,
    duplicateRisk: 'Low',
    contentGap: 'High',
    socialPotential: 'High',
    evergreenPotential: 'High',
    monetizationRelevance: 'High',
    decisionStatus: 'APPROVED',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'top_003',
    topic: 'How to Prevent Hallucination Cascades in Automated Content Pipelines',
    suggestedTitle: 'Multi-Stage Fact Verification: How We Stop AI Hallucinations Before Reaching Production',
    category: 'AI Production Reliability & Evaluations',
    keywords: ['Fact Checking', 'Hallucination Mitigation', 'Tavily Research', 'Grounding'],
    reason: 'Critical for publishing teams operating autonomous newsletters and portals.',
    freshness: 'Evergreen',
    availableResearch: 'Papers on claim extraction and automated counter-claim validation.',
    sourceCount: 8,
    duplicateRisk: 'Low',
    contentGap: 'Moderate',
    socialPotential: 'High',
    evergreenPotential: 'High',
    monetizationRelevance: 'High',
    decisionStatus: 'APPROVED',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

const SEED_RESEARCH: Record<string, ResearchPackage> = {
  top_001: {
    id: 'res_001',
    topicId: 'top_001',
    topic: 'Deterministic Agent Routing in Complex Multi-Agent LLM Orchestrations',
    summary: 'Autonomous agents frequently derail when given open-ended loops without strict transition guards. Combining typed finite-state machines with LLM tool-calling drops catastrophic workflow failures by over 82% according to recent production incident logs.',
    facts: [
      'Purely probabilistic prompt chaining suffers from exponential error accumulation after step 4.',
      'State-machine based routing ensures cyclic loops have bounded timeouts and deterministic exit conditions.',
      'Enterprises using strict JSON Schema validation report 94% fewer schema breakdown halts.',
      'Human-in-the-loop gates remain standard for financial and external social broadcasting actions.',
    ],
    claims: [
      {
        claim: 'Deterministic graphs reduce infinite loop failures significantly.',
        source: 'https://arxiv.org/abs/2402.01680',
        isOpinion: false,
        verified: true,
      },
      {
        claim: 'Autonomous swarms without supervisor agents fail 70% of end-to-end multi-hour tests.',
        source: 'https://github.com/microsoft/autogen',
        isOpinion: false,
        verified: true,
      },
    ],
    sources: [
      {
        title: 'Architectures for Reliable Agentic Systems in Enterprise Production',
        url: 'https://arxiv.org/abs/2402.01680',
        snippet: 'A comprehensive evaluation of 40 multi-agent pipelines showing deterministic routing graphs outperform dynamic agent swarms in SLA compliance.',
        publishedDate: '2025-11-14',
        authorityScore: 94,
      },
      {
        title: 'Production LLM Engineering Patterns: State Machines and Guardrails',
        url: 'https://martinfowler.com/articles/patterns-of-distributed-systems.html',
        snippet: 'Applying classic distributed state machines to AI orchestration layers prevents deadlocks and cost spikes.',
        publishedDate: '2025-08-20',
        authorityScore: 96,
      },
    ],
    importantQuotes: [
      {
        quote: 'The secret to autonomous intelligence is bounding its decisions with rigorous determinism.',
        speaker: 'AI Systems Architect Group',
        sourceUrl: 'https://arxiv.org/abs/2402.01680',
      },
    ],
    conflicts: [
      {
        statementA: 'Some claim fully autonomous emergent swarms will replace all static pipelines.',
        statementB: 'Production telemetry indicates uncontrolled emergence leads to unacceptable budget variance.',
        sourceA: 'https://techcrunch.com',
        sourceB: 'https://arxiv.org/abs/2402.01680',
        analysis: 'Emergence is promising for exploratory research, but deterministic constraints remain non-negotiable for SLA-governed publishing.',
      },
    ],
    researchTimestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
};

const SEED_ARTICLES: Article[] = [
  {
    id: 'art_101',
    topicId: 'top_001',
    title: 'Why Pure Autonomous Agents Need Deterministic Routing To Survive In Production',
    slug: 'why-pure-autonomous-agents-need-deterministic-routing',
    language: 'English',
    cleanContent: `# Why Pure Autonomous Agents Need Deterministic Routing To Survive In Production

Autonomous multi-agent architectures have captivated software engineers and AI practitioners worldwide. The premise of unleashing self-directing LLMs to discover insights, conduct research, write prose, and distribute content on autopilot sounds revolutionary. 

Yet behind closed doors, development teams deploying real systems to production know the unspoken reality: unconstrained autonomous loops break down. When an agent is given free rein to recursively reason without deterministic guardrails, small probabilistic hallucinations compound into catastrophic failures.

In this deep-dive, we unpack why the industry is shifting away from purely prompt-driven swarms toward hybrid state-machine orchestration—and how you can design high-reliability pipelines that actually stay running.

## The Pitfall of Probabilistic Chaining

When an LLM agent executes a multi-step task, each step introduces a probability margin of error. If each stage has a 95% success rate:
- At Step 1: 95% reliable
- At Step 4: 81.4% reliable
- At Step 8: 66.3% reliable

By the time an agent reaches content generation, quality verification, and third-party API publishing, an unconstrained system is virtually guaranteed to derail without intervention. Common failure modes include:
1. **Semantic Drift**: The agent shifts from a technical topic into broad marketing generalities.
2. **Infinite Validation Purgatory**: The QA agent and Writer agent endlessly disagree on nuanced tone.
3. **Format Mutation**: The model outputs invalid JSON or drops vital metadata keys mid-stream.

## The Solution: Finite State Machine (FSM) Supervision

The antidote is not bigger prompts or larger parameter counts; it is architectural discipline. By modeling the agent pipeline as a directed acyclic graph (DAG) with typed state transitions:
- Each stage (Scout, Research, Decision, Plan, Write, Quality, Publish) receives an immutable input contract.
- The stage MUST return a strictly validated JSON schema.
- State transitions are hardcoded in code, not left to the model's mood.

## Verified Research & Industry Findings

Recent research evaluating 40 enterprise multi-agent pipelines (arXiv:2402.01680) demonstrated that introducing typed state-machine transition guards reduced catastrophic workflow halts by **82%**. Furthermore, teams enforcing schema validation at each node reported a 94% drop in API runtime crashes.

## Step-by-Step Production Checklist
1. **Enforce JSON Contracts**: Never parse loose markdown blocks; demand typed schemas with runtime guards.
2. **Cap Rewrites Explicitly**: Set a strict ceiling (e.g., maximum 3 rewrite attempts) before marking an article for human review.
3. **Isolate State**: Pass discrete packages (e.g., \`ResearchPackage\`) rather than accumulating infinite context windows.
4. **Idempotency Keys**: Use cryptographic hashes of the topic and content to prevent double-publishing across Blogger or social channels.

## Frequently Asked Questions

### Does deterministic routing eliminate agent autonomy?
No. Autonomy is preserved inside each node (creative writing, semantic synthesis, source analysis). Determinism simply governs the boundaries, safety criteria, and transition gates between nodes.

### How does this integrate with Blogger and social distribution?
The Blogger Publisher agent only activates once the Quality Checker returns an explicit \`PASS\` with zero unresolved policy violations. If the check fails or exceeds rewrite thresholds, the post is quarantined.

## Conclusion
Autonomous content generation is no longer a speculative fantasy—it is a production discipline. By pairing the creative prowess of frontier models with the unwavering predictability of finite state machines, engineers can build tireless, reliable editorial engines.`,
    bloggerHtml: `<div class="axiom-article">
<p class="lead">Autonomous multi-agent architectures have captivated software engineers and AI practitioners worldwide. The premise of unleashing self-directing LLMs to discover insights, conduct research, write prose, and distribute content on autopilot sounds revolutionary.</p>
<p>Yet behind closed doors, development teams deploying real systems to production know the unspoken reality: unconstrained autonomous loops break down. When an agent is given free rein to recursively reason without deterministic guardrails, small probabilistic hallucinations compound into catastrophic failures.</p>
<h2>The Pitfall of Probabilistic Chaining</h2>
<p>When an LLM agent executes a multi-step task, each step introduces a probability margin of error. If each stage has a 95% success rate:</p>
<ul>
<li><strong>Step 1:</strong> 95% reliable</li>
<li><strong>Step 4:</strong> 81.4% reliable</li>
<li><strong>Step 8:</strong> 66.3% reliable</li>
</ul>
<p>By the time an agent reaches content generation, quality verification, and third-party API publishing, an unconstrained system is virtually guaranteed to derail without intervention.</p>
<h2>The Solution: Finite State Machine (FSM) Supervision</h2>
<p>The antidote is not bigger prompts or larger parameter counts; it is architectural discipline. By modeling the agent pipeline as a directed acyclic graph (DAG) with typed state transitions, each stage receives an immutable contract and emits verified JSON.</p>
<blockquote>"The secret to autonomous intelligence is bounding its decisions with rigorous determinism." &mdash; AI Systems Research</blockquote>
<h2>Frequently Asked Questions</h2>
<div class="faq-block">
<h3>Does deterministic routing eliminate agent autonomy?</h3>
<p>No. Autonomy is preserved inside each node for semantic synthesis and creativity, while deterministic gates maintain strict safety, budget, and publishing invariants.</p>
</div>
</div>`,
    metaDescription: 'Discover why production AI agent pipelines require deterministic finite-state routing to eliminate hallucination cascades and runaway cloud compute bills.',
    focusKeywords: ['AI Agents', 'Deterministic Routing', 'Autonomous Content Pipeline', 'State Machines'],
    secondaryKeywords: ['LLM Orchestration', 'Tavily Research', 'Blogger Automation'],
    faq: [
      {
        question: 'Does deterministic routing eliminate agent autonomy?',
        answer: 'No. Autonomy is preserved inside each node for creative synthesis, while deterministic gates maintain safety and reliability.',
      },
    ],
    internalLinks: ['/articles/slm-benchmarks-serverless', '/articles/preventing-hallucinations'],
    externalReferences: ['https://arxiv.org/abs/2402.01680', 'https://martinfowler.com/articles/patterns-of-distributed-systems.html'],
    image: {
      imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
      provider: 'unsplash',
      prompt: 'Minimalist cybernetic network graph with glowing node transitions, obsidian and emerald palette',
      altText: 'Diagram of deterministic multi-agent state routing',
      articleId: 'art_101',
    },
    lifecycleState: 'DISTRIBUTED',
    qualityReport: {
      status: 'PASS',
      issues: [],
      corrections: ['Refined statistical formula for clarity in section 1.'],
      unsupportedClaims: [],
      scoreBreakdown: {
        factualConsistency: 98,
        sourceSupport: 95,
        grammarReadability: 96,
        seoStructure: 94,
        originality: 97,
      },
      checkedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    bloggerPost: {
      blogId: '884920491823901',
      postId: 'post_992102',
      url: 'https://axiom-ai-insights.blogspot.com/2026/09/deterministic-agent-routing.html',
      labels: ['AI Agents', 'Architecture', 'Engineering'],
      publishedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      idempotencyHash: 'e9b2c8172df03a11b84921f',
    },
    socialDistributions: [
      {
        id: 'soc_01',
        platform: 'facebook',
        platformPostId: 'fb_post_88192',
        content: '🤖 Why pure autonomous AI agents derail in production—and how deterministic finite-state routing fixes it.\n\nRead our technical deep-dive: https://axiom-ai-insights.blogspot.com/2026/09/deterministic-agent-routing.html\n\n#AIEngineering #LLM #SoftwareArchitecture',
        status: 'PUBLISHED',
        publishedUrl: 'https://facebook.com/axiom_tech/posts/88192',
        retryCount: 0,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        publishedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        id: 'soc_02',
        platform: 'telegram',
        platformPostId: 'tg_msg_4412',
        content: '⚡️ **NEW DISPATCH**: Why Pure Autonomous Agents Need Deterministic Routing\n\nKey takeaways:\n• Unchecked loops drop below 66% reliability after 8 hops\n• Typed FSM guardrails eliminate 82% of pipeline crashes\n\n🔗 [Read Article](https://axiom-ai-insights.blogspot.com/2026/09/deterministic-agent-routing.html)',
        status: 'PUBLISHED',
        publishedUrl: 'https://t.me/axiom_ai_dispatch/4412',
        retryCount: 0,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        publishedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        id: 'soc_03',
        platform: 'x',
        platformPostId: 'x_tweet_109281',
        content: 'Most AI agents fail in production not because models are dumb, but because unconstrained loops compound errors.\n\nHere is how deterministic state machines keep multi-agent swarms rock solid 🧵👇\nhttps://axiom-ai-insights.blogspot.com/2026/09/deterministic-agent-routing.html',
        status: 'PUBLISHED',
        publishedUrl: 'https://x.com/axiom_ai/status/109281',
        retryCount: 0,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        publishedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        id: 'soc_04',
        platform: 'linkedin',
        platformPostId: 'li_post_7721',
        content: 'Enterprise AI teams are learning that probabilistic prompt-chaining without strict state boundaries leads to unpredictable SLA violations. Our engineering team broke down the architectural patterns behind deterministic multi-agent orchestration.',
        status: 'PUBLISHED',
        publishedUrl: 'https://linkedin.com/feed/update/urn:li:activity:7721',
        retryCount: 0,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        publishedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
    ],
    rewriteCount: 1,
    maxRewrites: 3,
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

const SEED_JOBS: AgentJob[] = [
  {
    id: 'job_1024',
    jobNumber: 1024,
    status: 'COMPLETED',
    currentStep: 'MEMORY_LEARNING',
    articleId: 'art_101',
    topicTitle: 'Deterministic Agent Routing in Complex Multi-Agent LLM Orchestrations',
    steps: [
      { step: 'TOPIC_DISCOVERY', status: 'COMPLETED', durationMs: 1420, summary: 'Discovered high-gap topic with 6 authoritative sources.' },
      { step: 'WEB_RESEARCH', status: 'COMPLETED', durationMs: 3180, summary: 'Synthesized Tavily research package (4 verified claims, 1 resolved conflict).' },
      { step: 'TOPIC_DECISION', status: 'COMPLETED', durationMs: 910, summary: 'Approved: High audience relevance (94/100), verified citations.' },
      { step: 'CONTENT_PLANNING', status: 'COMPLETED', durationMs: 1250, summary: 'Constructed H2/H3 blueprint, FAQ schema, and metadata.' },
      { step: 'ARTICLE_GENERATION', status: 'COMPLETED', durationMs: 5400, summary: 'Generated 1,240-word technical analysis and Blogger HTML.' },
      { step: 'SEO_OPTIMIZATION', status: 'COMPLETED', durationMs: 820, summary: 'Generated meta tags, slug, image alt texts, and keyword density.' },
      { step: 'FACT_QUALITY_CHECK', status: 'COMPLETED', durationMs: 2100, summary: 'Quality score: 98% factual accuracy. 1 minor revision applied.' },
      { step: 'IMAGE_HANDLING', status: 'COMPLETED', durationMs: 650, summary: 'Paired cybernetic network graph visual with verified licensing.' },
      { step: 'BLOGGER_PUBLISH', status: 'COMPLETED', durationMs: 1400, summary: 'Published post ID #post_992102 to connected Blogger publication.' },
      { step: 'SOCIAL_DISTRIBUTION', status: 'COMPLETED', durationMs: 2300, summary: 'Distributed formatted previews to Facebook, Telegram, X, and LinkedIn.' },
      { step: 'RESULT_TRACKING', status: 'COMPLETED', durationMs: 420, summary: 'Logged initial distribution telemetry and platform IDs.' },
      { step: 'MEMORY_LEARNING', status: 'COMPLETED', durationMs: 310, summary: 'Ingested topic footprint into agent memory to prevent duplicate cycles.' },
    ],
    startedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    finishedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

const SEED_LOGS: SystemLog[] = [
  {
    id: 'log_01',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    jobId: 'job_1024',
    agentName: 'TopicScoutAgent',
    level: 'INFO',
    message: 'Scouted candidate topic: Deterministic Agent Routing. Freshness: Trending.',
  },
  {
    id: 'log_02',
    timestamp: new Date(Date.now() - 3600000 * 2.9).toISOString(),
    jobId: 'job_1024',
    agentName: 'ResearchAgent',
    level: 'INFO',
    message: 'Tavily web research synthesized 2 academic citations and 4 verified facts.',
  },
  {
    id: 'log_03',
    timestamp: new Date(Date.now() - 3600000 * 2.8).toISOString(),
    jobId: 'job_1024',
    agentName: 'DecisionAgent',
    level: 'SUCCESS',
    message: 'Topic decision: APPROVED (Evidence sufficiency 95%, Policy Passed).',
  },
  {
    id: 'log_04',
    timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    jobId: 'job_1024',
    agentName: 'WriterAgent',
    level: 'INFO',
    message: 'Drafted 1,240-word article with custom Blogger HTML structure.',
  },
  {
    id: 'log_05',
    timestamp: new Date(Date.now() - 3600000 * 2.3).toISOString(),
    jobId: 'job_1024',
    agentName: 'QualityFactCheckerAgent',
    level: 'SUCCESS',
    message: 'Quality check passed with 98% factual score. Zero unsupported claims.',
  },
  {
    id: 'log_06',
    timestamp: new Date(Date.now() - 3600000 * 2.1).toISOString(),
    jobId: 'job_1024',
    agentName: 'BloggerPublisherAgent',
    level: 'SUCCESS',
    message: 'Successfully deployed article to Blogger [ID: post_992102].',
  },
  {
    id: 'log_07',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    jobId: 'job_1024',
    agentName: 'SocialDistributionAgent',
    level: 'SUCCESS',
    message: 'Distributed platform-specific snippets across 4 connected networks.',
  },
];

const SEED_MEMORY: AgentMemory = {
  publishedTopics: [
    {
      title: 'Why Pure Autonomous Agents Need Deterministic Routing To Survive In Production',
      category: 'Autonomous Multi-Agent Systems',
      publishedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      keywords: ['AI Agents', 'Deterministic Routing', 'LangGraph', 'LLM Reliability'],
    },
    {
      title: 'Evaluating Small Language Models (SLMs) on Serverless Edge Runtimes',
      category: 'Edge AI & Small Language Models',
      publishedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
      keywords: ['Edge AI', 'SLMs', 'Serverless', 'Cold Start'],
    },
  ],
  successfulPatterns: [
    'Deep architectural comparisons with code architecture patterns perform in the top 90th percentile.',
    'Technical case studies citing arXiv preprints generate 3.4x more discussion on X and LinkedIn.',
    'Factual checklists with deterministic failure rates attract senior developer engagement.',
  ],
  failedPatterns: [
    'Avoid generic "What is AI" introductory fluff; target experienced practitioners.',
    'Do not output unverified benchmark charts without exact methodology notes.',
  ],
  gapKeywords: [
    'Speculative Decoding on CPUs',
    'Agentic Memory Compactification',
    'Self-Healing CI/CD Pipelines with LLMs',
    'Structured JSON Outputs Benchmarks',
  ],
  totalArticlesPublished: 2,
  lastCycleTimestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
};

export class StorageService {
  private static instance: StorageService;
  private dataDir: string;
  private dataFilePath: string;
  private memoryCache: StoreData | null = null;

  private constructor() {
    // Check if writable or fallback to /tmp in serverless
    const baseDir = process.env.STORAGE_DATA_DIR || path.join(process.cwd(), 'data');
    this.dataDir = baseDir;
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      this.dataFilePath = path.join(this.dataDir, 'axiom_store.json');
    } catch {
      // Serverless readonly fallback
      this.dataDir = '/tmp';
      this.dataFilePath = path.join('/tmp', 'axiom_store.json');
    }

    // Seed SQLite from persistent JSON store if needed
    this.seedSqliteIfNeeded();
  }

  private seedSqliteIfNeeded(): void {
    try {
      const db = DatabaseEngine.getInstance();
      const sqliteAI = db.getAllAIProvidersSql();
      const store = this.load();

      if (sqliteAI && sqliteAI.length === 0 && store.aiProviders.length > 0) {
        console.log('[Storage] Seeding SQLite database from initial AI providers...');
        for (const p of store.aiProviders) {
          db.saveAIProviderSql(p);
        }
      }

      const sqliteSearch = db.getAllSearchProvidersSql();
      if (sqliteSearch && sqliteSearch.length === 0 && store.searchProviders.length > 0) {
        console.log('[Storage] Seeding SQLite database from initial Search providers...');
        for (const p of store.searchProviders) {
          db.saveSearchProviderSql(p);
        }
      }
    } catch (err) {
      console.warn('[Storage] SQLite sync warning:', err);
    }
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private load(): StoreData {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const raw = fs.readFileSync(this.dataFilePath, 'utf-8');
        const parsed = JSON.parse(raw) as StoreData;
        parsed.testHistory = parsed.testHistory || [];
        this.memoryCache = parsed;
        return parsed;
      }
    } catch (err) {
      console.warn('[Storage] Failed to read store file, falling back to cache or seed:', err);
    }

    if (this.memoryCache) {
      return this.memoryCache;
    }

    // Initialize with Seed Data
    const initialData: StoreData = {
      settings: DEFAULT_SETTINGS,
      aiProviders: DEFAULT_AI_PROVIDERS,
      searchProviders: DEFAULT_SEARCH_PROVIDERS,
      testHistory: SEED_TEST_HISTORY,
      topics: SEED_TOPICS,
      researchPackages: SEED_RESEARCH,
      articles: SEED_ARTICLES,
      jobs: SEED_JOBS,
      logs: SEED_LOGS,
      memory: SEED_MEMORY,
      bloggerConfig: {
        blogId: process.env.BLOGGER_DEFAULT_BLOG_ID || '884920491823901',
        blogName: 'Axiom Autonomous Tech Dispatch',
        blogUrl: 'https://axiom-ai-insights.blogspot.com',
        defaultLabels: ['Artificial Intelligence', 'Autonomous Agents', 'Software Architecture'],
        publishingMode: 'LIVE',
        isConnected: Boolean(process.env.BLOGGER_REFRESH_TOKEN || process.env.BLOGGER_CLIENT_ID),
      },
      socialConfig: {
        facebookEnabled: Boolean(process.env.FACEBOOK_PAGE_ACCESS_TOKEN),
        telegramEnabled: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        linkedinEnabled: Boolean(process.env.LINKEDIN_ACCESS_TOKEN),
        xEnabled: Boolean(process.env.X_ACCESS_TOKEN),
        threadsEnabled: Boolean(process.env.THREADS_ACCESS_TOKEN),
      },
      lock: {
        isLocked: false,
      },
    };

    this.memoryCache = initialData;
    this.persist(initialData);
    return initialData;
  }

  private persist(data: StoreData): void {
    this.memoryCache = data;
    try {
      const tempPath = `${this.dataFilePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.dataFilePath);
    } catch (err) {
      console.warn('[Storage] Persist warning (safe in read-only lambda memory):', err);
    }
  }

  // --- Mutex / Lock ---
  public acquireLock(jobId: string): boolean {
    const store = this.load();
    if (store.lock.isLocked) {
      // Check if stale lock (older than 15 minutes)
      if (store.lock.lockedAt) {
        const ageMs = Date.now() - new Date(store.lock.lockedAt).getTime();
        if (ageMs > 15 * 60 * 1000) {
          console.warn('[Storage] Breaking stale lock from job:', store.lock.jobId);
        } else {
          return false;
        }
      } else {
        return false;
      }
    }
    store.lock = {
      isLocked: true,
      jobId,
      lockedAt: new Date().toISOString(),
    };
    store.settings.status = 'RUNNING';
    this.persist(store);
    return true;
  }

  public releaseLock(): void {
    const store = this.load();
    store.lock = { isLocked: false };
    if (store.settings.status === 'RUNNING') {
      store.settings.status = 'IDLE';
    }
    this.persist(store);
  }

  // --- Settings ---
  public getSettings(): SystemSettings {
    return this.load().settings;
  }

  public updateSettings(updates: Partial<SystemSettings>): SystemSettings {
    const store = this.load();
    store.settings = { ...store.settings, ...updates };
    this.persist(store);
    return store.settings;
  }

  // --- Providers ---
  public getAIProviders(): AIProviderConfig[] {
    const sqliteProviders = DatabaseEngine.getInstance().getAllAIProvidersSql();
    if (sqliteProviders && sqliteProviders.length > 0) {
      // Ensure file store is also in sync
      const store = this.load();
      store.aiProviders = sqliteProviders;
      return sqliteProviders;
    }
    return this.load().aiProviders;
  }

  public updateAIProviders(providers: AIProviderConfig[]): AIProviderConfig[] {
    const store = this.load();
    store.aiProviders = providers;
    this.persist(store);

    const db = DatabaseEngine.getInstance();
    for (const p of providers) {
      db.saveAIProviderSql(p);
    }
    return store.aiProviders;
  }

  public saveAIProvider(provider: AIProviderConfig): AIProviderConfig {
    const store = this.load();
    const finalId = provider.id && provider.id.trim() !== '' ? provider.id : `prov_${Date.now()}`;
    const now = new Date().toISOString();
    const index = store.aiProviders.findIndex((p) => p.id === finalId);

    let cleanProvider: AIProviderConfig;

    if (index >= 0) {
      const existing = store.aiProviders[index];
      const updatedKey = provider.apiKey ? provider.apiKey : existing.apiKey;
      cleanProvider = {
        ...existing,
        ...provider,
        id: finalId,
        apiKey: updatedKey,
        updatedAt: now,
      };
      store.aiProviders[index] = cleanProvider;
    } else {
      cleanProvider = {
        ...provider,
        id: finalId,
        priority: provider.priority || store.aiProviders.length + 1,
        createdAt: now,
        updatedAt: now,
      };
      store.aiProviders.push(cleanProvider);
    }

    // Sort by priority
    store.aiProviders.sort((a, b) => a.priority - b.priority);
    this.persist(store);

    // Save into persistent SQLite database
    DatabaseEngine.getInstance().saveAIProviderSql(cleanProvider);

    return cleanProvider;
  }

  public deleteAIProvider(id: string): boolean {
    const store = this.load();
    const initialLen = store.aiProviders.length;
    store.aiProviders = store.aiProviders.filter((p) => p.id !== id);
    if (store.aiProviders.length !== initialLen) {
      // Re-index priorities 1..N
      store.aiProviders.forEach((p, idx) => {
        p.priority = idx + 1;
        DatabaseEngine.getInstance().updateAIProviderPrioritySql(p.id, p.priority);
      });
      this.persist(store);
      DatabaseEngine.getInstance().deleteAIProviderSql(id);
      return true;
    }
    return false;
  }

  public reorderAIProviders(ids: string[]): AIProviderConfig[] {
    const store = this.load();
    const map = new Map(store.aiProviders.map((p) => [p.id, p]));
    const reordered: AIProviderConfig[] = [];

    ids.forEach((id, index) => {
      const item = map.get(id);
      if (item) {
        item.priority = index + 1;
        reordered.push(item);
        map.delete(id);
        DatabaseEngine.getInstance().updateAIProviderPrioritySql(id, item.priority);
      }
    });

    // Append any remaining
    map.forEach((item) => {
      item.priority = reordered.length + 1;
      reordered.push(item);
      DatabaseEngine.getInstance().updateAIProviderPrioritySql(item.id, item.priority);
    });

    store.aiProviders = reordered;
    this.persist(store);
    return store.aiProviders;
  }

  public toggleAIProvider(id: string, enabled: boolean): AIProviderConfig | null {
    const store = this.load();
    const provider = store.aiProviders.find((p) => p.id === id);
    if (provider) {
      provider.enabled = enabled;
      provider.updatedAt = new Date().toISOString();
      this.persist(store);
      DatabaseEngine.getInstance().toggleAIProviderSql(id, enabled);
      return provider;
    }
    return null;
  }

  public getSearchProviders(): SearchProviderConfig[] {
    const sqliteSearch = DatabaseEngine.getInstance().getAllSearchProvidersSql();
    if (sqliteSearch && sqliteSearch.length > 0) {
      const store = this.load();
      store.searchProviders = sqliteSearch;
      return sqliteSearch;
    }
    return this.load().searchProviders;
  }

  public updateSearchProviders(providers: SearchProviderConfig[]): SearchProviderConfig[] {
    const store = this.load();
    store.searchProviders = providers;
    this.persist(store);

    const db = DatabaseEngine.getInstance();
    for (const p of providers) {
      db.saveSearchProviderSql(p);
    }
    return store.searchProviders;
  }

  public saveSearchProvider(provider: SearchProviderConfig): SearchProviderConfig {
    const store = this.load();
    const finalId = provider.id && provider.id.trim() !== '' ? provider.id : `search_${Date.now()}`;
    const now = new Date().toISOString();
    const index = store.searchProviders.findIndex((p) => p.id === finalId);

    let cleanProvider: SearchProviderConfig;

    if (index >= 0) {
      const existing = store.searchProviders[index];
      const updatedKey = provider.apiKey ? provider.apiKey : existing.apiKey;
      cleanProvider = {
        ...existing,
        ...provider,
        id: finalId,
        apiKey: updatedKey,
        updatedAt: now,
      };
      store.searchProviders[index] = cleanProvider;
    } else {
      cleanProvider = {
        ...provider,
        id: finalId,
        priority: provider.priority || store.searchProviders.length + 1,
        createdAt: now,
        updatedAt: now,
      };
      store.searchProviders.push(cleanProvider);
    }

    store.searchProviders.sort((a, b) => a.priority - b.priority);
    this.persist(store);

    DatabaseEngine.getInstance().saveSearchProviderSql(cleanProvider);

    return cleanProvider;
  }

  public deleteSearchProvider(id: string): boolean {
    const store = this.load();
    const initialLen = store.searchProviders.length;
    store.searchProviders = store.searchProviders.filter((p) => p.id !== id);
    if (store.searchProviders.length !== initialLen) {
      store.searchProviders.forEach((p, idx) => {
        p.priority = idx + 1;
        DatabaseEngine.getInstance().updateSearchProviderPrioritySql(p.id, p.priority);
      });
      this.persist(store);
      DatabaseEngine.getInstance().deleteSearchProviderSql(id);
      return true;
    }
    return false;
  }

  public reorderSearchProviders(ids: string[]): SearchProviderConfig[] {
    const store = this.load();
    const map = new Map(store.searchProviders.map((p) => [p.id, p]));
    const reordered: SearchProviderConfig[] = [];

    ids.forEach((id, index) => {
      const item = map.get(id);
      if (item) {
        item.priority = index + 1;
        reordered.push(item);
        map.delete(id);
        DatabaseEngine.getInstance().updateSearchProviderPrioritySql(id, item.priority);
      }
    });

    map.forEach((item) => {
      item.priority = reordered.length + 1;
      reordered.push(item);
      DatabaseEngine.getInstance().updateSearchProviderPrioritySql(item.id, item.priority);
    });

    store.searchProviders = reordered;
    this.persist(store);
    return store.searchProviders;
  }

  public toggleSearchProvider(id: string, enabled: boolean): SearchProviderConfig | null {
    const store = this.load();
    const provider = store.searchProviders.find((p) => p.id === id);
    if (provider) {
      provider.enabled = enabled;
      provider.updatedAt = new Date().toISOString();
      this.persist(store);
      DatabaseEngine.getInstance().toggleSearchProviderSql(id, enabled);
      return provider;
    }
    return null;
  }

  // --- Test History ---
  public getTestHistory(limit = 20): ApiTestHistoryItem[] {
    const store = this.load();
    const history = store.testHistory || [];
    return history.slice(0, limit);
  }

  public addTestHistory(item: ApiTestHistoryItem): void {
    const store = this.load();
    if (!store.testHistory) {
      store.testHistory = [];
    }
    store.testHistory.unshift(item);
    if (store.testHistory.length > 50) {
      store.testHistory = store.testHistory.slice(0, 50);
    }
    this.persist(store);
  }

  // --- Import / Export ---
  public exportConfiguration(includeSecrets: boolean = false) {
    const store = this.load();
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      includeSecrets,
      aiProviders: store.aiProviders.map((p) => ({
        ...p,
        apiKey: includeSecrets ? p.apiKey : '',
      })),
      searchProviders: store.searchProviders.map((p) => ({
        ...p,
        apiKey: includeSecrets ? p.apiKey : '',
      })),
      settings: {
        niche: store.settings.niche,
        contentNiche: store.settings.contentNiche,
        subNiches: store.settings.subNiches,
        targetAudience: store.settings.targetAudience,
        language: store.settings.language,
        articleFrequencyPerDay: store.settings.articleFrequencyPerDay,
        mode: store.settings.mode,
      },
    };
  }

  public importConfiguration(config: any): { success: boolean; aiCount: number; searchCount: number } {
    const store = this.load();
    let aiCount = 0;
    let searchCount = 0;

    if (Array.isArray(config.aiProviders)) {
      const currentMap = new Map(store.aiProviders.map((p) => [p.id, p]));
      config.aiProviders.forEach((inc: AIProviderConfig) => {
        const existing = currentMap.get(inc.id);
        const finalKey = inc.apiKey || existing?.apiKey || '';
        currentMap.set(inc.id, {
          ...inc,
          apiKey: finalKey,
          updatedAt: new Date().toISOString(),
        });
        aiCount++;
      });
      store.aiProviders = Array.from(currentMap.values()).sort((a, b) => a.priority - b.priority);
    }

    if (Array.isArray(config.searchProviders)) {
      const currentMap = new Map(store.searchProviders.map((p) => [p.id, p]));
      config.searchProviders.forEach((inc: SearchProviderConfig) => {
        const existing = currentMap.get(inc.id);
        const finalKey = inc.apiKey || existing?.apiKey || '';
        currentMap.set(inc.id, {
          ...inc,
          apiKey: finalKey,
          updatedAt: new Date().toISOString(),
        });
        searchCount++;
      });
      store.searchProviders = Array.from(currentMap.values()).sort((a, b) => a.priority - b.priority);
    }

    if (config.settings) {
      store.settings = {
        ...store.settings,
        ...config.settings,
      };
    }

    this.persist(store);
    return { success: true, aiCount, searchCount };
  }

  // --- Topics ---
  public getTopics(): TopicCandidate[] {
    return this.load().topics;
  }

  public addTopic(topic: TopicCandidate): TopicCandidate {
    const store = this.load();
    const existingIndex = store.topics.findIndex((t) => t.id === topic.id);
    if (existingIndex >= 0) {
      store.topics[existingIndex] = topic;
    } else {
      store.topics.unshift(topic);
    }
    this.persist(store);
    return topic;
  }

  public updateTopic(id: string, updates: Partial<TopicCandidate>): TopicCandidate | null {
    const store = this.load();
    const index = store.topics.findIndex((t) => t.id === id);
    if (index === -1) return null;
    store.topics[index] = { ...store.topics[index], ...updates };
    this.persist(store);
    return store.topics[index];
  }

  // --- Research Packages ---
  public getResearchPackage(topicId: string): ResearchPackage | null {
    const store = this.load();
    return store.researchPackages[topicId] || null;
  }

  public getAllResearchPackages(): Record<string, ResearchPackage> {
    return this.load().researchPackages;
  }

  public saveResearchPackage(pkg: ResearchPackage): ResearchPackage {
    const store = this.load();
    store.researchPackages[pkg.topicId] = pkg;
    this.persist(store);
    return pkg;
  }

  // --- Articles ---
  public getArticles(): Article[] {
    return this.load().articles;
  }

  public getArticleById(id: string): Article | null {
    const store = this.load();
    return store.articles.find((a) => a.id === id) || null;
  }

  public saveArticle(article: Article): Article {
    const store = this.load();
    const index = store.articles.findIndex((a) => a.id === article.id);
    if (index >= 0) {
      store.articles[index] = { ...article, updatedAt: new Date().toISOString() };
    } else {
      store.articles.unshift(article);
    }
    this.persist(store);
    return article;
  }

  // --- Jobs ---
  public getJobs(): AgentJob[] {
    return this.load().jobs;
  }

  public getJobById(id: string): AgentJob | null {
    const store = this.load();
    return store.jobs.find((j) => j.id === id) || null;
  }

  public saveJob(job: AgentJob): AgentJob {
    const store = this.load();
    const index = store.jobs.findIndex((j) => j.id === job.id);
    if (index >= 0) {
      store.jobs[index] = job;
    } else {
      store.jobs.unshift(job);
    }
    this.persist(store);
    return job;
  }

  // --- Logs ---
  public getLogs(limit = 100): SystemLog[] {
    const store = this.load();
    return store.logs.slice(0, limit);
  }

  public addLog(entry: Omit<SystemLog, 'id' | 'timestamp'>): SystemLog {
    const store = this.load();
    const log: SystemLog = {
      id: 'log_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    store.logs.unshift(log);
    if (store.logs.length > 500) {
      store.logs = store.logs.slice(0, 500);
    }
    this.persist(store);
    return log;
  }

  // --- Memory ---
  public getMemory(): AgentMemory {
    return this.load().memory;
  }

  public updateMemory(updates: Partial<AgentMemory>): AgentMemory {
    const store = this.load();
    store.memory = { ...store.memory, ...updates, lastCycleTimestamp: new Date().toISOString() };
    this.persist(store);
    return store.memory;
  }

  // --- Blogger & Social Config ---
  public getBloggerConfig() {
    return this.load().bloggerConfig;
  }

  public updateBloggerConfig(cfg: Partial<StoreData['bloggerConfig']>) {
    const store = this.load();
    store.bloggerConfig = { ...store.bloggerConfig, ...cfg };
    this.persist(store);
    return store.bloggerConfig;
  }

  public getSocialConfig() {
    return this.load().socialConfig;
  }

  public updateSocialConfig(cfg: Partial<StoreData['socialConfig']>) {
    const store = this.load();
    store.socialConfig = { ...store.socialConfig, ...cfg };
    this.persist(store);
    return store.socialConfig;
  }
}
