export type SocialPlatform = 'facebook' | 'instagram' | 'youtube' | 'tiktok';

export type IntegrationStatus = 'CONNECTED' | 'FAILED' | 'NOT_CONFIGURED';

export interface BloggerIntegration {
  id: string;
  name: string;
  blogId: string;
  blogUrl?: string;
  apiKey?: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  enabled: boolean;
  defaultStatus?: 'DRAFT' | 'LIVE' | 'SCHEDULED';
  defaultLabel?: string;
  lastTestedAt?: string;
  lastTestStatus?: IntegrationStatus;
  lastLatencyMs?: number;
  lastError?: string;
}

export interface SocialIntegration {
  id: string;
  name: string;
  platform: SocialPlatform;
  enabled: boolean;
  credentials?: Record<string, string>;
  lastTestedAt?: string;
  lastTestStatus?: IntegrationStatus;
  lastLatencyMs?: number;
  lastError?: string;
}

export interface IntegrationTestResult {
  success: boolean;
  status: 'CONNECTED' | 'FAILED';
  latencyMs: number;
  error?: string;
  message?: string;
  diagnostics?: string;
  channelId?: string;
  channelName?: string;
  details?: any;
  timestamp?: string;
}
