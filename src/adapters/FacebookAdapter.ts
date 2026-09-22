import { SocialIntegration } from '../types/agent';

export interface AdapterTestResult {
  success: boolean;
  message: string;
  diagnostics?: string;
}

export interface AdapterPublishResult {
  success: boolean;
  id?: string;
  url?: string;
  error?: string;
}

export class FacebookAdapter {
  /**
   * Real connection test to Facebook Graph API.
   * Checks Page ID and Page Access Token.
   */
  public static async testConnection(integration: SocialIntegration): Promise<AdapterTestResult> {
    const pageId = integration.credentials['pageId']?.trim();
    const accessToken = integration.credentials['accessToken']?.trim();

    if (!pageId) {
      return {
        success: false,
        message: 'FAILED: Missing Facebook Page ID.',
        diagnostics: 'Provide your numeric Facebook Page ID from Meta Business Suite / Page Settings.'
      };
    }

    if (!accessToken) {
      return {
        success: false,
        message: 'FAILED: Missing Facebook Page Access Token.',
        diagnostics: 'Provide a valid Facebook Page Access Token with pages_manage_posts and pages_read_engagement permissions.'
      };
    }

    try {
      const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}?fields=id,name,category,link&access_token=${encodeURIComponent(accessToken)}`;
      const response = await fetch(url, { method: 'GET' });
      const data = await response.json().catch(() => null);

      if (response.ok && data?.id) {
        return {
          success: true,
          message: `CONNECTED: Verified Facebook Page "${data.name}" (${data.category || 'Page'})`,
          diagnostics: `Page ID: ${data.id} | Page Name: ${data.name} | Link: ${data.link || 'https://facebook.com/' + data.id}`
        };
      }

      const errMsg = data?.error?.message || response.statusText || 'Invalid credentials or token expired';
      return {
        success: false,
        message: `FAILED: Facebook Graph API returned HTTP ${response.status}`,
        diagnostics: `Meta Error: ${errMsg}. Check that your Page Access Token is active and has permissions.`
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'FAILED: Network error communicating with Facebook Graph API.',
        diagnostics: err?.message || 'Network failure or CORS restriction.'
      };
    }
  }

  /**
   * Publishes standard feed post (text + optional link).
   */
  public static async publishPost(
    integration: SocialIntegration,
    post: { message: string; link?: string }
  ): Promise<AdapterPublishResult> {
    const pageId = integration.credentials['pageId']?.trim();
    const accessToken = integration.credentials['accessToken']?.trim();

    if (!pageId || !accessToken) {
      return { success: false, error: 'Missing Facebook Page ID or Access Token' };
    }

    try {
      const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}/feed`;
      const bodyParams = new URLSearchParams();
      bodyParams.append('message', post.message);
      bodyParams.append('access_token', accessToken);
      if (post.link) {
        bodyParams.append('link', post.link);
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString()
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.id) {
        return {
          success: true,
          id: data.id,
          url: `https://facebook.com/${data.id}`
        };
      }

      return {
        success: false,
        error: data?.error?.message || `Facebook post creation failed with HTTP ${res.status}`
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error publishing to Facebook' };
    }
  }

  /**
   * Publishes photo post to Facebook Page.
   */
  public static async publishImage(
    integration: SocialIntegration,
    post: { message: string; imageUrl: string }
  ): Promise<AdapterPublishResult> {
    const pageId = integration.credentials['pageId']?.trim();
    const accessToken = integration.credentials['accessToken']?.trim();

    if (!pageId || !accessToken) {
      return { success: false, error: 'Missing Facebook credentials' };
    }

    try {
      const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}/photos`;
      const bodyParams = new URLSearchParams();
      bodyParams.append('url', post.imageUrl);
      bodyParams.append('caption', post.message);
      bodyParams.append('access_token', accessToken);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString()
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.id) {
        return {
          success: true,
          id: data.id,
          url: `https://facebook.com/${data.id}`
        };
      }

      return {
        success: false,
        error: data?.error?.message || `Facebook photo upload failed with HTTP ${res.status}`
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error uploading photo to Facebook' };
    }
  }
}
