import { 
  TopicItem, 
  ResearchData, 
  ArticleItem, 
  QueueItem, 
  AgentLog, 
  MemoryInsight 
} from '../types/agent';

const TOPICS_KEY = 'tara_topics';
const RESEARCH_KEY = 'tara_research';
const ARTICLES_KEY = 'tara_articles';
const QUEUE_KEY = 'tara_publishing_queue';
const LOGS_KEY = 'tara_agent_logs';
const MEMORY_KEY = 'tara_agent_memory';

const SEED_TOPICS: TopicItem[] = [
  {
    id: 'topic-1',
    title: 'Top 10 AI Automation Workflows for Modern Content Creators in 2026',
    niche: 'Artificial Intelligence',
    score: 94,
    searchVolume: '45,000 / mo',
    competition: 'Medium',
    trendGrowth: '+128%',
    keywords: ['AI automation', 'content workflows', 'autonomous blogging', 'Blogger auto-post'],
    status: 'drafted',
    createdAt: Date.now() - 86400000 * 2
  },
  {
    id: 'topic-2',
    title: 'Next-Gen Social Media Distribution: Syndicating from Blogger to TikTok & Meta',
    niche: 'Digital Marketing',
    score: 88,
    searchVolume: '28,000 / mo',
    competition: 'Low',
    trendGrowth: '+85%',
    keywords: ['cross-platform publishing', 'social media automation', 'Blogger to Facebook', 'reels syndication'],
    status: 'published',
    createdAt: Date.now() - 86400000 * 4
  },
  {
    id: 'topic-3',
    title: 'Autonomous Research Agents: How Tavily + Multi-Agent LLMs Outperform Manual SEO',
    niche: 'Tech & SEO',
    score: 91,
    searchVolume: '19,500 / mo',
    competition: 'Low',
    trendGrowth: '+210%',
    keywords: ['Tavily search', 'autonomous research', 'SEO agents', 'fact checking'],
    status: 'researched',
    createdAt: Date.now() - 86400000 * 1
  }
];

const SEED_RESEARCH: ResearchData[] = [
  {
    id: 'res-seed-1',
    topicId: 'topic-1',
    topicTitle: 'Top 10 AI Automation Workflows for Modern Content Creators in 2026',
    summary: 'Synthesized research analysis of autonomous agent swarms in multi-platform content publishing. Focuses on direct API syndication to Blogger, Facebook, Instagram, YouTube, and TikTok.',
    keyFacts: [
      'Multi-agent workflows demonstrate a 4x reduction in editing cycle time.',
      'Direct API integrations reduce failure rates compared to third-party webhook middleware.',
      'Articles with verified source links achieve 68% higher retention in search results.'
    ],
    suggestedHeadlines: [
      'The 2026 Playbook for Autonomous Content Syndication',
      'How AI Agents Run 5 Platforms Simultaneously'
    ],
    suggestedSections: [
      {
        title: 'Core Publishing Architecture',
        points: ['Data isolation', 'Encrypted local credentials', 'Read-back verification']
      }
    ],
    sources: [
      {
        title: 'Google Blogger API Documentation',
        url: 'https://developers.google.com/blogger/v3',
        snippet: 'Google Blogger API v3 enables programmatic management of blog posts, labels, and publishing statuses.'
      },
      {
        title: 'Meta Graph API Developers Guide',
        url: 'https://developers.facebook.com/docs/graph-api',
        snippet: 'Manage Facebook Pages and Instagram Business accounts with token-based publishing.'
      }
    ],
    targetAudience: 'Content Creators, Marketers, Digital Agencies',
    primaryKeywords: ['AI automation', 'content workflows', 'autonomous blogging'],
    createdAt: Date.now() - 86400000 * 2
  }
];

const SEED_ARTICLES: ArticleItem[] = [
  {
    id: 'art-1',
    title: 'Top 10 AI Automation Workflows for Modern Content Creators in 2026',
    slug: 'top-10-ai-automation-workflows-2026',
    summary: 'A deep-dive into how autonomous agent pipelines are replacing fragmented Zapier zaps and streamlining multi-platform content publishing from blog drafts to short-form video snippets.',
    content: `# Top 10 AI Automation Workflows for Modern Content Creators in 2026

Modern content operations are evolving from single-shot LLM prompts to **autonomous multi-agent swarms**. In this guide, we break down the exact architectures top digital media brands use to scale their reach across Blogger, Meta, YouTube, and TikTok.

## 1. The Autonomous Topic Scout Pipeline
Instead of manual keyword planning in spreadsheets, autonomous agents monitor search trends and social spikes 24/7. Using real-time search APIs like **Tavily**, agents score topic viability before writing a single word.

## 2. Evidence-Backed Deep Research
Hallucination remains the enemy of domain authority. Modern agent systems inject strict fact-checking steps:
- Primary source validation
- Statistical claim verification
- Automatic link grounding

## 3. Dynamic Multi-Channel Syndication
A blog post should never remain confined to one URL. Once an article is published to Blogger, automated webhooks fan out customized variants:
- **Facebook Pages:** Executive bullet summary with link preview.
- **Instagram:** Carousel slide generation with hook-driven captions.
- **YouTube & TikTok:** Auto-generated script outlines and short-form video prompts.

## Key Takeaway
Consistency is the ultimate competitive advantage. By establishing reliable, credential-protected integrations in your automated publishing pipeline, you unlock true organic scalability.`,
    category: 'Artificial Intelligence',
    tags: ['AI', 'Automation', 'Content Creation', 'Publishing'],
    wordCount: 380,
    readingTimeMinutes: 2,
    seoScore: 92,
    factCheckScore: 96,
    factCheckNotes: [
      'Verified: Multi-agent architectures have surpassed single-prompt generators in production benchmarks.',
      'Verified: Tavily provides real-time search grounding for autonomous research.',
      'Verified: Cross-posting increases backlink velocity and social signals.'
    ],
    status: 'draft',
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 3600000 * 3
  },
  {
    id: 'art-2',
    title: 'Next-Gen Social Media Distribution: Syndicating from Blogger to TikTok & Meta',
    slug: 'syndicating-blogger-to-tiktok-meta',
    summary: 'Learn how to transform a single Google Blogger post into high-converting posts for Facebook, Instagram, YouTube, and TikTok.',
    content: `# Next-Gen Social Media Distribution: Syndicating from Blogger to TikTok & Meta

A single high-quality long-form article contains all the narrative substance needed for an entire week of social content.

## Why Multi-Platform Publishing Matters
Google rewards cross-domain social proof, while social platforms reward creators who post consistently. Syndicating directly from your primary Blogger publication creates a unified distribution flywheel.

### Platform-Specific Formatting:
1. **Facebook:** Keep paragraphs short; emphasize community discussion.
2. **Instagram:** Pair strong visual typography with clear calls to action.
3. **YouTube:** Repurpose your article's core points into video descriptions and video chapters.
4. **TikTok:** Turn key takeaways into snappy 30-second speaking scripts.`,
    category: 'Digital Marketing',
    tags: ['Social Media', 'Blogger', 'Syndication', 'Marketing'],
    wordCount: 290,
    readingTimeMinutes: 2,
    seoScore: 89,
    factCheckScore: 94,
    factCheckNotes: ['Verified multi-platform syndication patterns.'],
    status: 'published',
    publishedUrls: {
      blogger: 'https://example-blog.blogspot.com/2026/09/social-media-syndication.html',
      facebook: 'https://facebook.com/post/10293847291',
      instagram: 'https://instagram.com/p/C091823'
    },
    createdAt: Date.now() - 86400000 * 4,
    updatedAt: Date.now() - 86400000 * 3
  }
];

const SEED_LOGS: AgentLog[] = [
  {
    id: 'log-1',
    timestamp: Date.now() - 3600000 * 2,
    agent: 'Orchestrator',
    level: 'info',
    message: 'System pipeline initialized. Loaded providerStore and integrationStore.'
  },
  {
    id: 'log-2',
    timestamp: Date.now() - 3600000 * 2 + 1000,
    agent: 'TopicScoutAgent',
    level: 'success',
    message: 'Discovered 3 high-affinity trending topics with competitive scores > 85.'
  },
  {
    id: 'log-3',
    timestamp: Date.now() - 3600000 * 1,
    agent: 'ResearchAgent',
    level: 'info',
    message: 'Completed web grounding research synthesis for "AI Automation Workflows".'
  },
  {
    id: 'log-4',
    timestamp: Date.now() - 1800000,
    agent: 'QualityFactCheckerAgent',
    level: 'success',
    message: 'Fact-check validation passed with 96% confidence score.'
  }
];

const SEED_MEMORY: MemoryInsight[] = [
  {
    id: 'mem-1',
    timestamp: Date.now() - 86400000 * 3,
    category: 'seo',
    observation: 'Articles with 3+ H2 headers and bulleted summaries rank 34% higher in Google SERP indexing.',
    recommendation: 'Enforce minimum 3 H2 headers and structured takeaway sections in ContentPlannerAgent.',
    appliedCount: 14
  },
  {
    id: 'mem-2',
    timestamp: Date.now() - 86400000 * 2,
    category: 'engagement',
    observation: 'Social posts with direct questions in the first sentence get 2.3x higher comment engagement.',
    recommendation: 'Configure SocialDistributionAgent to prepend hook questions to Facebook & Instagram posts.',
    appliedCount: 8
  }
];

class AppStorage {
  private listeners: (() => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key?.startsWith('tara_')) {
          this.notifyListeners();
        }
      });
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(l => {
      try { l(); } catch (e) { console.error('Storage listener error', e); }
    });
  }

  // Topics
  public getTopics(): TopicItem[] {
    try {
      const raw = localStorage.getItem(TOPICS_KEY);
      if (!raw) {
        this.saveTopics(SEED_TOPICS);
        return SEED_TOPICS;
      }
      return JSON.parse(raw);
    } catch {
      return SEED_TOPICS;
    }
  }

  public saveTopics(topics: TopicItem[]): void {
    try {
      localStorage.setItem(TOPICS_KEY, JSON.stringify(topics));
      this.notifyListeners();
    } catch (e) {
      console.error('Error saving topics', e);
    }
  }

  public addTopic(topic: Omit<TopicItem, 'id' | 'createdAt'>): TopicItem {
    const topics = this.getTopics();
    const item: TopicItem = {
      ...topic,
      id: `topic-${Date.now()}`,
      createdAt: Date.now()
    };
    topics.unshift(item);
    this.saveTopics(topics);
    return item;
  }

  // Research
  public getResearch(): ResearchData[] {
    try {
      const raw = localStorage.getItem(RESEARCH_KEY);
      if (!raw) {
        this.saveResearch(SEED_RESEARCH);
        return SEED_RESEARCH;
      }
      return JSON.parse(raw);
    } catch {
      return SEED_RESEARCH;
    }
  }

  public saveResearch(researchList: ResearchData[]): void {
    try {
      localStorage.setItem(RESEARCH_KEY, JSON.stringify(researchList));
      this.notifyListeners();
    } catch (e) {
      console.error('Error saving research', e);
    }
  }

  public addResearch(data: ResearchData): void {
    const list = this.getResearch();
    list.unshift(data);
    this.saveResearch(list);
  }

  // Articles
  public getArticles(): ArticleItem[] {
    try {
      const raw = localStorage.getItem(ARTICLES_KEY);
      if (!raw) {
        this.saveArticles(SEED_ARTICLES);
        return SEED_ARTICLES;
      }
      return JSON.parse(raw);
    } catch {
      return SEED_ARTICLES;
    }
  }

  public saveArticles(articles: ArticleItem[]): void {
    try {
      localStorage.setItem(ARTICLES_KEY, JSON.stringify(articles));
      this.notifyListeners();
    } catch (e) {
      console.error('Error saving articles', e);
    }
  }

  public addArticle(article: Omit<ArticleItem, 'id' | 'createdAt' | 'updatedAt'>): ArticleItem {
    const list = this.getArticles();
    const item: ArticleItem = {
      ...article,
      id: `art-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    list.unshift(item);
    this.saveArticles(list);
    return item;
  }

  public updateArticle(id: string, updates: Partial<ArticleItem>): ArticleItem {
    const list = this.getArticles();
    const index = list.findIndex(a => a.id === id);
    if (index === -1) throw new Error(`Article ${id} not found`);
    const updated = { ...list[index], ...updates, updatedAt: Date.now() };
    list[index] = updated;
    this.saveArticles(list);
    return updated;
  }

  public deleteArticle(id: string): void {
    const list = this.getArticles().filter(a => a.id !== id);
    this.saveArticles(list);
  }

  // Queue
  public getQueue(): QueueItem[] {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public saveQueue(queue: QueueItem[]): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      this.notifyListeners();
    } catch (e) {
      console.error('Error saving queue', e);
    }
  }

  public addToQueue(item: Omit<QueueItem, 'id' | 'createdAt'>): QueueItem {
    const list = this.getQueue();
    const entry: QueueItem = {
      ...item,
      id: `queue-${Date.now()}`,
      createdAt: Date.now()
    };
    list.unshift(entry);
    this.saveQueue(list);
    return entry;
  }

  // Logs
  public getLogs(): AgentLog[] {
    try {
      const raw = localStorage.getItem(LOGS_KEY);
      return raw ? JSON.parse(raw) : SEED_LOGS;
    } catch {
      return SEED_LOGS;
    }
  }

  public addLog(agent: string, level: 'info' | 'warn' | 'error' | 'success', message: string, details?: any): void {
    try {
      const logs = this.getLogs();
      const newLog: AgentLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: Date.now(),
        agent,
        level,
        message,
        details
      };
      logs.unshift(newLog);
      if (logs.length > 200) logs.pop();
      localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
      this.notifyListeners();
    } catch (e) {
      console.error('Error adding agent log', e);
    }
  }

  public clearLogs(): void {
    try {
      localStorage.setItem(LOGS_KEY, JSON.stringify([]));
      this.notifyListeners();
    } catch (e) {
      console.error('Error clearing logs', e);
    }
  }

  // Memory
  public getMemory(): MemoryInsight[] {
    try {
      const raw = localStorage.getItem(MEMORY_KEY);
      return raw ? JSON.parse(raw) : SEED_MEMORY;
    } catch {
      return SEED_MEMORY;
    }
  }

  public getMemories(): MemoryInsight[] {
    return this.getMemory();
  }
}

export const appStorage = new AppStorage();
