import { 
  FacebookAdapter, 
  InstagramAdapter, 
  YouTubeAdapter, 
  TikTokAdapter, 
  AdapterPublishResult 
} from '../adapters';
import { integrationStore } from '../services/integrationStore';
import { appStorage } from '../services/storage';
import { ArticleItem } from '../types/agent';

export interface SocialPublishReport {
  attempted: number;
  successful: number;
  results: {
    platform: string;
    accountName: string;
    result: AdapterPublishResult;
  }[];
}

export class SocialDistributionAgent {
  /**
   * Reads enabled Social integrations dynamically from integrationStore.
   * Crafts tailored platform posts and distributes them using platform adapters.
   */
  public static async distribute(article: ArticleItem): Promise<SocialPublishReport> {
    const enabledSocials = integrationStore.getEnabledSocial();
    const report: SocialPublishReport = {
      attempted: enabledSocials.length,
      successful: 0,
      results: []
    };

    if (enabledSocials.length === 0) {
      appStorage.addLog(
        'SocialDistributionAgent',
        'warn',
        'No enabled Social Media integrations found in integrationStore. Skipping social distribution.'
      );
      return report;
    }

    appStorage.addLog(
      'SocialDistributionAgent',
      'info',
      `Starting social distribution for "${article.title}" to ${enabledSocials.length} enabled account(s).`
    );

    const publishedUrls = { ...(article.publishedUrls || {}) };

    for (const social of enabledSocials) {
      try {
        let res: AdapterPublishResult = { success: false, error: 'Not executed' };

        if (social.platform === 'facebook') {
          const message = `📢 New Article: ${article.title}\n\n${article.summary}\n\nRead more below:`;
          res = await FacebookAdapter.publishPost(social, {
            message,
            link: article.publishedUrls?.blogger
          });
          if (res.success && res.url) {
            publishedUrls.facebook = res.url;
          }
        } else if (social.platform === 'instagram') {
          // Instagram requires media
          const caption = `🔥 ${article.title}\n\n${article.summary}\n\nTags: ${article.tags.map(t => '#' + t.replace(/\s+/g, '')).join(' ')}`;
          const sampleImage = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80';
          res = await InstagramAdapter.publishImage(social, {
            caption,
            imageUrl: sampleImage
          });
          if (res.success && res.url) {
            publishedUrls.instagram = res.url;
          }
        } else if (social.platform === 'youtube') {
          res = await YouTubeAdapter.publishVideo(social, {
            title: article.title.slice(0, 95),
            description: `${article.summary}\n\nOriginal post: ${article.publishedUrls?.blogger || ''}`,
            videoUrl: 'https://example.com/assets/sample-video.mp4',
            tags: article.tags
          });
          if (res.success && res.url) {
            publishedUrls.youtube = res.url;
          }
        } else if (social.platform === 'tiktok') {
          res = await TikTokAdapter.publishVideo(social, {
            title: article.title.slice(0, 100),
            videoUrl: 'https://example.com/assets/sample-tiktok.mp4'
          });
          if (res.success && res.url) {
            publishedUrls.tiktok = res.url;
          }
        }

        report.results.push({
          platform: social.platform,
          accountName: social.name,
          result: res
        });

        if (res.success) {
          report.successful++;
          appStorage.addLog(
            'SocialDistributionAgent',
            'success',
            `Successfully posted to ${social.platform} (${social.name})`,
            { url: res.url }
          );
        } else {
          appStorage.addLog(
            'SocialDistributionAgent',
            'error',
            `Failed posting to ${social.platform} (${social.name}): ${res.error}`
          );
        }
      } catch (err: any) {
        appStorage.addLog(
          'SocialDistributionAgent',
          'error',
          `Exception posting to ${social.platform} (${social.name}): ${err?.message}`
        );
      }
    }

    appStorage.updateArticle(article.id, { publishedUrls });
    return report;
  }
}
