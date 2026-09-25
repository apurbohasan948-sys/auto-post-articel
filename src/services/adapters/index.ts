/**
 * Tara - Platform Adapters Registry
 * Maps each social platform to its respective real API adapter.
 */

import { SocialIntegration, IntegrationTestResult, PublishingResult } from '../../types/integrations';
import { FacebookAdapter } from './FacebookAdapter';
import { InstagramAdapter } from './InstagramAdapter';
import { YouTubeAdapter } from './YouTubeAdapter';
import { TikTokAdapter } from './TikTokAdapter';
import { TelegramAdapter } from './TelegramAdapter';
import { LinkedInAdapter } from './LinkedInAdapter';
import { TwitterAdapter } from './TwitterAdapter';
import { ThreadsAdapter } from './ThreadsAdapter';
import { BloggerAdapter } from './BloggerAdapter';

export {
  BloggerAdapter,
  FacebookAdapter,
  InstagramAdapter,
  YouTubeAdapter,
  TikTokAdapter,
  TelegramAdapter,
  LinkedInAdapter,
  TwitterAdapter,
  ThreadsAdapter,
};

export async function testSocialIntegration(integration: SocialIntegration): Promise<IntegrationTestResult> {
  switch (integration.platform) {
    case 'facebook':
      return FacebookAdapter.testConnection(integration);
    case 'instagram':
      return InstagramAdapter.testConnection(integration);
    case 'youtube':
      return YouTubeAdapter.testConnection(integration);
    case 'tiktok':
      return TikTokAdapter.testConnection(integration);
    case 'telegram':
      return TelegramAdapter.testConnection(integration);
    case 'linkedin':
      return LinkedInAdapter.testConnection(integration);
    case 'twitter':
      return TwitterAdapter.testConnection(integration);
    case 'threads':
      return ThreadsAdapter.testConnection(integration);
    default:
      return {
        status: 'failed',
        message: `Unknown platform ${(integration as any).platform}`,
        error: 'Unsupported platform',
      };
  }
}

export async function publishToSocialIntegration(
  integration: SocialIntegration,
  payload: {
    title: string;
    summary: string;
    url?: string;
    imageUrl?: string;
    tags?: string[];
  }
): Promise<PublishingResult> {
  switch (integration.platform) {
    case 'facebook':
      return FacebookAdapter.publishPost(integration, payload);
    case 'instagram':
      return InstagramAdapter.publishPost(integration, payload);
    case 'youtube':
      return YouTubeAdapter.publishPost(integration, payload);
    case 'tiktok':
      return TikTokAdapter.publishPost(integration, payload);
    case 'telegram':
      return TelegramAdapter.publishPost(integration, payload);
    case 'linkedin':
      return LinkedInAdapter.publishPost(integration, payload);
    case 'twitter':
      return TwitterAdapter.publishPost(integration, payload);
    case 'threads':
      return ThreadsAdapter.publishPost(integration, payload);
    default:
      return {
        platform: (integration as any).platform,
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'failed',
        errorMessage: `No adapter found for platform ${integration.platform}`,
        timestamp: Date.now(),
      };
  }
}
