/**
 * Axiom Integrations - Blogger and Social Media Data Contracts
 */

export interface BloggerIntegration {
  id: string;
  name: string;
  enabled: boolean;
  blogId: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  defaultStatus: 'DRAFT' | 'LIVE';
  defaultLabel?: string;
  blogUrl?: string;
  lastTestedAt?: string;
  lastTestStatus?: 'CONNECTED' | 'FAILED' | 'NOT_CONFIGURED';
  lastError?: string;
  lastLatencyMs?: number;
}

export type SocialPlatform = 'facebook' | 'instagram' | 'youtube' | 'tiktok';

export interface SocialIntegration {
  id: string;
  platform: SocialPlatform;
  name: string;
  enabled: boolean;
  credentials: Record<string, string>;
  lastTestedAt?: string;
  lastTestStatus?: 'CONNECTED' | 'FAILED' | 'NOT_CONFIGURED';
  lastError?: string;
  lastLatencyMs?: number;
}

export type IntegrationTestStatus = 'CONNECTED' | 'FAILED' | 'DISABLED' | 'NOT_CONFIGURED';

export interface IntegrationTestResult {
  success: boolean;
  status: 'CONNECTED' | 'FAILED';
  latencyMs: number;
  message?: string;
  error?: string;
  details?: Record<string, any>;
}
