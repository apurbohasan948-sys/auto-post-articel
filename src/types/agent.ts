export type NavigationTab = 
  | 'dashboard' 
  | 'topics' 
  | 'research' 
  | 'articles' 
  | 'publishing' 
  | 'analytics' 
  | 'logs' 
  | 'settings';

export type SettingsSubTab = 
  | 'providers' 
  | 'search' 
  | 'blogger' 
  | 'social' 
  | 'backup' 
  | 'diagnostics';

// AI Provider Types
export type AIProviderId = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'deepseek' | 'ollama' | 'custom';

export interface AIProviderConfig {
  id: string;
  type: AIProviderId;
  name: string;
  apiKey: string;
  baseUrl?: string;
  model: string;
  enabled: boolean;
  isDefault?: boolean;
  priority?: number;
  lastTested?: number;
  testStatus?: 'CONNECTED' | 'FAILED' | 'UNTESTED';
  lastError?: string;
}

// Tavily Search Config
export interface TavilyConfig {
  apiKey: string;
  enabled: boolean;
  searchDepth: 'basic' | 'advanced';
  maxResults: number;
  lastTested?: number;
  testStatus?: 'CONNECTED' | 'FAILED' | 'UNTESTED';
  lastError?: string;
}

// Blogger Integration
export interface BloggerIntegration {
  id: string;
  name: string;
  enabled: boolean;
  blogId: string;
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  defaultStatus: 'DRAFT' | 'LIVE';
  defaultLabel: string;
  lastTested?: number;
  testStatus?: 'CONNECTED' | 'FAILED' | 'UNTESTED';
  lastError?: string;
  diagnostics?: string;
}

// Social Media Integration
export type SocialPlatform = 'facebook' | 'instagram' | 'youtube' | 'tiktok';

export interface SocialIntegration {
  id: string;
  platform: SocialPlatform;
  name: string;
  enabled: boolean;
  credentials: Record<string, string>;
  lastTested?: number;
  testStatus?: 'CONNECTED' | 'FAILED' | 'UNTESTED';
  lastError?: string;
  diagnostics?: string;
}

// Topic Scout Types
export interface TopicItem {
  id: string;
  title: string;
  niche: string;
  score: number; // 0 - 100
  searchVolume: string;
  competition: 'Low' | 'Medium' | 'High';
  trendGrowth: string;
  keywords: string[];
  status: 'discovered' | 'researched' | 'drafted' | 'published';
  createdAt: number;
}

// Deep Research Types
export interface ResearchData {
  id: string;
  topicId: string;
  topicTitle: string;
  summary: string;
  keyFacts: string[];
  suggestedHeadlines: string[];
  suggestedSections: { title: string; points: string[] }[];
  sources: { title: string; url: string; snippet?: string }[];
  targetAudience: string;
  primaryKeywords: string[];
  createdAt: number;
}

// Article Types
export interface ArticleItem {
  id: string;
  title: string;
  slug: string;
  content: string; // Markdown or HTML
  summary: string;
  topicId?: string;
  category: string;
  tags: string[];
  wordCount: number;
  readingTimeMinutes: number;
  seoScore: number;
  factCheckScore: number;
  factCheckNotes: string[];
  status: 'draft' | 'reviewed' | 'scheduled' | 'published' | 'failed';
  publishedUrls?: {
    blogger?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    tiktok?: string;
  };
  createdAt: number;
  updatedAt: number;
}

// Publishing Queue Item
export interface QueueItem {
  id: string;
  articleId: string;
  articleTitle: string;
  destinations: {
    blogger?: boolean;
    facebook?: boolean;
    instagram?: boolean;
    youtube?: boolean;
    tiktok?: boolean;
  };
  scheduledTime: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  results?: {
    destination: string;
    success: boolean;
    url?: string;
    error?: string;
  }[];
  createdAt: number;
}

// Agent Log Item
export interface AgentLog {
  id: string;
  timestamp: number;
  agent: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: any;
}
export type LogItem = AgentLog;

// Analytics and Learning
export interface MemoryInsight {
  id: string;
  timestamp: number;
  category: 'seo' | 'tone' | 'topics' | 'engagement';
  observation: string;
  recommendation: string;
  appliedCount: number;
}
export type AgentMemoryItem = MemoryInsight;
