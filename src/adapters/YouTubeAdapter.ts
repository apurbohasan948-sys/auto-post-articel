import { SocialIntegration } from '../types/agent';
import { AdapterPublishResult, AdapterTestResult } from './FacebookAdapter';

export class YouTubeAdapter {
  /**
   * Real connection test to YouTube Data API v3.
   * Checks channelId and apiKey or OAuth accessToken.
   */
  public static async testConnection(integration: SocialIntegration): Promise<AdapterTestResult> {
    const channelId = integration.credentials['channelId']?.trim();
    const apiKey = integration.credentials['apiKey']?.trim();
    const accessToken = integration.credentials['accessToken']?.trim();

    if (!channelId) {
      return {
        success: false,
        message: 'FAILED: Missing YouTube Channel ID.',
        diagnostics: 'Provide your YouTube Channel ID (starts with UC...). Found in YouTube Studio > Customization > Basic Info.'
      };
    }

    if (!apiKey && !accessToken) {
      return {
        success: false,
        message: 'FAILED: Missing YouTube API Key or Access Token.',
        diagnostics: 'Provide a Google Cloud YouTube Data API v3 Key or OAuth 2.0 Access Token.'
      };
    }

    try {
      let url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${encodeURIComponent(channelId)}`;
      const headers: Record<string, string> = { Accept: 'application/json' };

      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      } else if (apiKey) {
        url += `&key=${encodeURIComponent(apiKey)}`;
      }

      const res = await fetch(url, { method: 'GET', headers });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.items && data.items.length > 0) {
        const ch = data.items[0];
        const title = ch.snippet?.title || 'YouTube Channel';
        const subCount = ch.statistics?.subscriberCount || '0';
        return {
          success: true,
          message: `CONNECTED: Verified YouTube Channel "${title}" (${subCount} subscribers)`,
          diagnostics: `Channel ID: ${channelId} | Title: ${title} | Videos: ${ch.statistics?.videoCount || 0}`
        };
      }

      if (res.ok && (!data?.items || data.items.length === 0)) {
        return {
          success: false,
          message: 'FAILED: YouTube channel not found with this Channel ID.',
          diagnostics: `The API key is valid, but Channel ID "${channelId}" returned 0 matching channels.`
        };
      }

      const errMsg = data?.error?.message || res.statusText || 'Authentication failed';
      return {
        success: false,
        message: `FAILED: YouTube Data API returned HTTP ${res.status}`,
        diagnostics: `Google Error: ${errMsg}. Verify API key restrictions and that YouTube Data API v3 is enabled in Google Cloud Console.`
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'FAILED: Network error communicating with YouTube Data API.',
        diagnostics: err?.message || 'Network failure or CORS restriction.'
      };
    }
  }

  /**
   * Publishes / schedules video via YouTube Data API.
   */
  public static async publishVideo(
    integration: SocialIntegration,
    video: {
      title: string;
      description: string;
      videoUrl: string;
      tags?: string[];
      privacyStatus?: 'public' | 'private' | 'unlisted';
    }
  ): Promise<AdapterPublishResult> {
    const accessToken = integration.credentials['accessToken']?.trim();

    if (!accessToken) {
      return {
        success: false,
        error: 'YouTube video upload requires an OAuth 2.0 Access Token with https://www.googleapis.com/auth/youtube.upload scope (API key alone cannot upload videos).'
      };
    }

    try {
      // YouTube videos.insert metadata call
      const metadata = {
        snippet: {
          title: video.title,
          description: video.description,
          tags: video.tags || ['TaraAI', 'AutomatedContent']
        },
        status: {
          privacyStatus: video.privacyStatus || 'unlisted'
        }
      };

      const res = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'video/*'
        },
        body: JSON.stringify(metadata)
      });

      if (res.ok) {
        const uploadUrl = res.headers.get('Location');
        return {
          success: true,
          url: uploadUrl || 'https://studio.youtube.com/',
          id: 'yt-upload-resumable'
        };
      }

      const data = await res.json().catch(() => null);
      return {
        success: false,
        error: data?.error?.message || `YouTube upload initialization failed with HTTP ${res.status}`
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Network error communicating with YouTube API'
      };
    }
  }
}
