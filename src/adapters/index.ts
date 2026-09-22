import { BloggerIntegration, SocialIntegration, SocialPlatform } from '../types/agent';
import { BloggerAdapter, BloggerPublishResult, BloggerTestResult } from './BloggerAdapter';
import { FacebookAdapter, AdapterPublishResult, AdapterTestResult } from './FacebookAdapter';
import { InstagramAdapter } from './InstagramAdapter';
import { YouTubeAdapter } from './YouTubeAdapter';
import { TikTokAdapter } from './TikTokAdapter';

export {
  BloggerAdapter,
  FacebookAdapter,
  InstagramAdapter,
  YouTubeAdapter,
  TikTokAdapter
};

export type {
  BloggerTestResult,
  BloggerPublishResult,
  AdapterTestResult,
  AdapterPublishResult
};

export class PlatformAdapterManager {
  public static async testBlogger(integration: BloggerIntegration): Promise<BloggerTestResult> {
    return BloggerAdapter.testConnection(integration);
  }

  public static async testSocial(integration: SocialIntegration): Promise<AdapterTestResult> {
    switch (integration.platform) {
      case 'facebook':
        return FacebookAdapter.testConnection(integration);
      case 'instagram':
        return InstagramAdapter.testConnection(integration);
      case 'youtube':
        return YouTubeAdapter.testConnection(integration);
      case 'tiktok':
        return TikTokAdapter.testConnection(integration);
      default:
        return {
          success: false,
          message: `Unknown platform: ${(integration as any).platform}`
        };
    }
  }
}
