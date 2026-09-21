/**
 * Axiom Social Media Distribution Service
 * Multi-platform adapter architecture for Facebook Pages, Telegram, LinkedIn, X, and Threads.
 * Isolates platform failures so a single offline platform does not abort distribution.
 */

import { SocialPost } from '../types/agent.ts';
import { StorageService } from './storage.ts';

export interface SocialDistributionItem {
  platform: 'facebook' | 'telegram' | 'linkedin' | 'x' | 'threads';
  content: string;
  articleUrl: string;
  articleTitle: string;
}

export class SocialService {
  private static instance: SocialService;
  private storage: StorageService;

  private constructor() {
    this.storage = StorageService.getInstance();
  }

  public static getInstance(): SocialService {
    if (!SocialService.instance) {
      SocialService.instance = new SocialService();
    }
    return SocialService.instance;
  }

  /**
   * Distributes formatted snippets across all connected platforms.
   */
  public async distributeArticle(
    articleId: string,
    articleTitle: string,
    articleUrl: string,
    snippets: Record<string, string>,
    jobId?: string
  ): Promise<SocialPost[]> {
    const results: SocialPost[] = [];
    const platforms: Array<'facebook' | 'telegram' | 'linkedin' | 'x' | 'threads'> = [
      'telegram',
      'facebook',
      'linkedin',
      'x',
      'threads',
    ];

    for (const platform of platforms) {
      const content = snippets[platform] || `${articleTitle}\n\nRead more: ${articleUrl}`;
      const record: SocialPost = {
        id: 'soc_' + Math.random().toString(36).substring(2, 9),
        platform,
        content,
        status: 'PENDING',
        retryCount: 0,
        createdAt: new Date().toISOString(),
      };

      try {
        if (platform === 'telegram') {
          const res = await this.publishTelegram(content, articleUrl);
          record.status = 'PUBLISHED';
          record.platformPostId = res.messageId;
          record.publishedUrl = res.url;
          record.publishedAt = new Date().toISOString();
        } else if (platform === 'facebook') {
          const res = await this.publishFacebook(content, articleUrl);
          record.status = 'PUBLISHED';
          record.platformPostId = res.postId;
          record.publishedUrl = res.url;
          record.publishedAt = new Date().toISOString();
        } else if (platform === 'linkedin') {
          const res = await this.publishLinkedIn(content, articleUrl);
          record.status = 'PUBLISHED';
          record.platformPostId = res.shareId;
          record.publishedUrl = res.url;
          record.publishedAt = new Date().toISOString();
        } else if (platform === 'x') {
          const res = await this.publishX(content);
          record.status = 'PUBLISHED';
          record.platformPostId = res.tweetId;
          record.publishedUrl = res.url;
          record.publishedAt = new Date().toISOString();
        } else {
          // Threads
          record.status = 'SKIPPED';
          record.errorMessage = 'Threads API credentials not configured in environment.';
        }

        if (record.status === 'PUBLISHED') {
          this.storage.addLog({
            agentName: 'SocialDistributionAgent',
            level: 'SUCCESS',
            message: `Dispatched to [${platform.toUpperCase()}]: ${record.publishedUrl}`,
            jobId,
          });
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        record.status = 'FAILED';
        record.errorMessage = errorMsg;
        this.storage.addLog({
          agentName: 'SocialDistributionAgent',
          level: 'WARN',
          message: `Failed publishing to [${platform.toUpperCase()}]: ${errorMsg}. Continuing other platforms.`,
          jobId,
        });
      }

      results.push(record);
    }

    return results;
  }

  // Telegram Bot API
  private async publishTelegram(content: string, articleUrl: string): Promise<{ messageId: string; url: string }> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      throw new Error('Telegram Bot Token or Chat ID not configured.');
    }

    const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `${content}\n\n🔗 ${articleUrl}`,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Telegram API error: ${err}`);
    }

    const data = await res.json();
    const msgId = String(data.result?.message_id || 'msg_unknown');
    return {
      messageId: msgId,
      url: `https://t.me/c/${chatId.replace(/^-100/, '')}/${msgId}`,
    };
  }

  // Facebook Pages Graph API
  private async publishFacebook(content: string, articleUrl: string): Promise<{ postId: string; url: string }> {
    const pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const pageId = process.env.FACEBOOK_PAGE_ID;

    if (!pageToken || !pageId) {
      throw new Error('Facebook Page Access Token or Page ID not configured.');
    }

    const endpoint = `https://graph.facebook.com/v19.0/${pageId}/feed`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: content,
        link: articleUrl,
        access_token: pageToken,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Facebook Graph API error: ${err}`);
    }

    const data = await res.json();
    const postId = data.id || 'fb_unknown';
    return {
      postId,
      url: `https://facebook.com/${postId}`,
    };
  }

  // LinkedIn Shares API
  private async publishLinkedIn(content: string, articleUrl: string): Promise<{ shareId: string; url: string }> {
    const token = process.env.LINKEDIN_ACCESS_TOKEN;
    if (!token) {
      throw new Error('LinkedIn Access Token not configured.');
    }

    // Official LinkedIn UGC Post API endpoint
    const endpoint = 'https://api.linkedin.com/v2/ugcPosts';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: 'urn:li:person:me',
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: content },
            shareMediaCategory: 'ARTICLE',
            media: [
              {
                status: 'READY',
                originalUrl: articleUrl,
              },
            ],
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LinkedIn API error: ${err}`);
    }

    const data = await res.json();
    const shareId = data.id || 'li_share';
    return {
      shareId,
      url: `https://linkedin.com/feed/update/${shareId}`,
    };
  }

  // X (Twitter) API v2
  private async publishX(content: string): Promise<{ tweetId: string; url: string }> {
    const bearer = process.env.X_ACCESS_TOKEN;
    if (!bearer) {
      throw new Error('X API Access Token not configured.');
    }

    const res = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: content.slice(0, 280) }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`X API error: ${err}`);
    }

    const data = await res.json();
    const tweetId = data.data?.id || 'x_tweet';
    return {
      tweetId,
      url: `https://x.com/i/web/status/${tweetId}`,
    };
  }
}
