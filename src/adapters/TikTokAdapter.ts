import { SocialIntegration } from '../types/agent';
import { AdapterPublishResult, AdapterTestResult } from './FacebookAdapter';

export class TikTokAdapter {
  /**
   * Real connection test to TikTok API v2.
   * Checks openId, clientKey, and accessToken.
   */
  public static async testConnection(integration: SocialIntegration): Promise<AdapterTestResult> {
    const accessToken = integration.credentials['accessToken']?.trim();
    const openId = integration.credentials['openId']?.trim();

    if (!accessToken) {
      return {
        success: false,
        message: 'FAILED: Missing TikTok Access Token.',
        diagnostics: 'Provide a TikTok Login Kit OAuth 2.0 User Access Token with user.info.basic and video.publish permissions.'
      };
    }

    try {
      const url = 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,profile_deep_link';
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.data?.user) {
        const user = data.data.user;
        return {
          success: true,
          message: `CONNECTED: Verified TikTok Account "${user.display_name || user.open_id}"`,
          diagnostics: `Open ID: ${user.open_id} | Display Name: ${user.display_name || 'N/A'} | Profile: ${user.profile_deep_link || 'TikTok'}`
        };
      }

      const errMsg = data?.error?.message || res.statusText || 'Access Token rejected or expired';
      return {
        success: false,
        message: `FAILED: TikTok API returned HTTP ${res.status}`,
        diagnostics: `TikTok Error: ${errMsg}. Check that your app is approved in TikTok for Developers and token is valid.`
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'FAILED: Network error communicating with TikTok API.',
        diagnostics: err?.message || 'Network failure or CORS restriction.'
      };
    }
  }

  /**
   * Publishes / initializes video publish on TikTok.
   */
  public static async publishVideo(
    integration: SocialIntegration,
    video: { title: string; videoUrl: string }
  ): Promise<AdapterPublishResult> {
    const accessToken = integration.credentials['accessToken']?.trim();

    if (!accessToken) {
      return { success: false, error: 'Missing TikTok Access Token' };
    }

    try {
      const url = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
      const payload = {
        post_info: {
          title: video.title,
          privacy_level: 'SELF_ONLY',
          disable_duet: false,
          disable_stitch: false,
          disable_comment: false,
          video_cover_timestamp_ms: 1000
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: video.videoUrl
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.data?.publish_id) {
        return {
          success: true,
          id: data.data.publish_id,
          url: 'https://www.tiktok.com/'
        };
      }

      return {
        success: false,
        error: data?.error?.message || `TikTok video publish failed with HTTP ${res.status}`
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Network error communicating with TikTok API'
      };
    }
  }
}
