export type SocialPlatform =
  | 'facebook'
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'telegram'
  | 'linkedin'
  | 'twitter'
  | 'threads';

export type IntegrationStatus = 'CONNECTED' | 'FAILED' | 'NOT_CONFIGURED';

export interface BloggerIntegration {
  id: string;
  name: string;
  enabled: boolean;
  blogId: string;
  publicBlogUrl?: string;
  blogUrl?: string;
  defaultLabels?: string[];
  defaultLabel?: string;
  defaultStatus?: 'DRAFT' | 'LIVE' | 'SCHEDULED';
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;
  connected?: boolean;
  apiKey?: string;
  lastTestedAt?: string;
  lastTestAt?: number;
  lastTestStatus?: IntegrationStatus | 'idle' | 'testing' | 'success' | 'failed';
  lastTestMessage?: string;
  lastLatencyMs?: number;
  lastError?: string;
  priority?: number;
}

export interface SocialIntegration {
  id: string;
  platform: SocialPlatform;
  name: string;
  enabled: boolean;
  priority?: number;
  credentials?: Record<string, string>;
  accountId?: string;
  pageId?: string;
  channelId?: string;
  profileId?: string;
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
  metadata?: Record<string, any>;
  connected?: boolean;
  lastTestedAt?: string;
  lastTestAt?: number;
  lastTestStatus?: IntegrationStatus | 'idle' | 'testing' | 'success' | 'failed';
  lastTestMessage?: string;
  lastLatencyMs?: number;
  lastError?: string;
}

export interface IntegrationSettings {
  autoPublishToBlogger: boolean;
  autoDistributeToSocial: boolean;
  notifyOnPublishError: boolean;
  testBeforePublishing: boolean;
  defaultBloggerStatus: 'DRAFT' | 'LIVE';
}

export interface IntegrationTestResult {
  success?: boolean;
  status: 'CONNECTED' | 'FAILED' | 'success' | 'failed';
  message?: string;
  latencyMs?: number;
  statusCode?: number;
  accountInfo?: string;
  error?: string;
  diagnostics?: string;
  channelId?: string;
  channelName?: string;
  details?: any;
  timestamp?: string;
}

export interface PublishingResult {
  platform: string;
  integrationId: string;
  integrationName: string;
  status: 'success' | 'failed' | 'skipped';
  postId?: string;
  postUrl?: string;
  errorMessage?: string;
  timestamp: number;
}
