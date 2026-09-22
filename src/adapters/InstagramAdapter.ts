import { SocialIntegration } from '../types/agent';
import { AdapterPublishResult, AdapterTestResult } from './FacebookAdapter';

export class InstagramAdapter {
  /**
   * Real connection test to Instagram Graph API.
   * Requires accountId (Instagram Business Account ID) and accessToken.
   */
  public static async testConnection(integration: SocialIntegration): Promise<AdapterTestResult> {
    const accountId = integration.credentials['accountId']?.trim();
    const accessToken = integration.credentials['accessToken']?.trim();

    if (!accountId) {
      return {
        success: false,
        message: 'FAILED: Missing Instagram Business Account ID.',
        diagnostics: 'Provide your Instagram Professional/Business Account ID linked to your Meta Facebook Page.'
      };
    }

    if (!accessToken) {
      return {
        success: false,
        message: 'FAILED: Missing Instagram Access Token.',
        diagnostics: 'Provide a User or Page token with instagram_basic and instagram_content_publish permissions.'
      };
    }

    try {
      const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(accountId)}?fields=id,username,name,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`;
      const response = await fetch(url, { method: 'GET' });
      const data = await response.json().catch(() => null);

      if (response.ok && data?.id) {
        return {
          success: true,
          message: `CONNECTED: Verified Instagram Account @${data.username || data.name || accountId}`,
          diagnostics: `Instagram ID: ${data.id} | Username: @${data.username || 'unknown'} | Name: ${data.name || 'N/A'}`
        };
      }

      const errMsg = data?.error?.message || response.statusText || 'Unable to authenticate Instagram account';
      return {
        success: false,
        message: `FAILED: Instagram Graph API returned HTTP ${response.status}`,
        diagnostics: `Meta Error: ${errMsg}. Check that your Instagram account is set to Business/Creator and connected to Meta.`
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'FAILED: Network error communicating with Instagram Graph API.',
        diagnostics: err?.message || 'Network failure or CORS restriction.'
      };
    }
  }

  /**
   * Publishes an image to Instagram Feed via container API.
   */
  public static async publishImage(
    integration: SocialIntegration,
    post: { caption: string; imageUrl: string }
  ): Promise<AdapterPublishResult> {
    const accountId = integration.credentials['accountId']?.trim();
    const accessToken = integration.credentials['accessToken']?.trim();

    if (!accountId || !accessToken) {
      return { success: false, error: 'Missing Instagram credentials' };
    }

    try {
      // Step 1: Create media container
      const containerUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(accountId)}/media`;
      const bodyParams = new URLSearchParams();
      bodyParams.append('image_url', post.imageUrl);
      bodyParams.append('caption', post.caption);
      bodyParams.append('access_token', accessToken);

      const createRes = await fetch(containerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString()
      });
      const createData = await createRes.json().catch(() => null);

      if (!createRes.ok || !createData?.id) {
        return {
          success: false,
          error: createData?.error?.message || `Failed to create Instagram media container (HTTP ${createRes.status})`
        };
      }

      const creationId = createData.id;

      // Step 2: Publish media container
      const publishUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(accountId)}/media_publish`;
      const pubParams = new URLSearchParams();
      pubParams.append('creation_id', creationId);
      pubParams.append('access_token', accessToken);

      const pubRes = await fetch(publishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: pubParams.toString()
      });
      const pubData = await pubRes.json().catch(() => null);

      if (pubRes.ok && pubData?.id) {
        return {
          success: true,
          id: pubData.id,
          url: `https://www.instagram.com/p/${pubData.id}/`
        };
      }

      return {
        success: false,
        error: pubData?.error?.message || 'Instagram media_publish step failed'
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error publishing to Instagram' };
    }
  }

  /**
   * Publishes video / Reels to Instagram.
   */
  public static async publishVideo(
    integration: SocialIntegration,
    post: { caption: string; videoUrl: string }
  ): Promise<AdapterPublishResult> {
    const accountId = integration.credentials['accountId']?.trim();
    const accessToken = integration.credentials['accessToken']?.trim();

    if (!accountId || !accessToken) {
      return { success: false, error: 'Missing Instagram credentials' };
    }

    try {
      const containerUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(accountId)}/media`;
      const bodyParams = new URLSearchParams();
      bodyParams.append('media_type', 'REELS');
      bodyParams.append('video_url', post.videoUrl);
      bodyParams.append('caption', post.caption);
      bodyParams.append('access_token', accessToken);

      const createRes = await fetch(containerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString()
      });
      const createData = await createRes.json().catch(() => null);

      if (!createRes.ok || !createData?.id) {
        return {
          success: false,
          error: createData?.error?.message || `Failed to create Instagram video container (HTTP ${createRes.status})`
        };
      }

      // Publish container
      const publishUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(accountId)}/media_publish`;
      const pubParams = new URLSearchParams();
      pubParams.append('creation_id', createData.id);
      pubParams.append('access_token', accessToken);

      const pubRes = await fetch(publishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: pubParams.toString()
      });
      const pubData = await pubRes.json().catch(() => null);

      if (pubRes.ok && pubData?.id) {
        return {
          success: true,
          id: pubData.id,
          url: `https://www.instagram.com/reel/${pubData.id}/`
        };
      }

      return {
        success: false,
        error: pubData?.error?.message || 'Instagram video publication failed'
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error publishing video to Instagram' };
    }
  }
}
