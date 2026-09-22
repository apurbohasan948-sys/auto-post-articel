import { BloggerIntegration } from '../types/agent';

export interface BloggerTestResult {
  success: boolean;
  message: string;
  diagnostics?: string;
}

export interface BloggerPublishResult {
  success: boolean;
  url?: string;
  id?: string;
  error?: string;
}

export class BloggerAdapter {
  /**
   * Real connection test to Google Blogger API v3.
   * Does NOT fake successful responses.
   */
  public static async testConnection(integration: BloggerIntegration): Promise<BloggerTestResult> {
    const { blogId, accessToken, clientId, clientSecret } = integration;

    if (!blogId || blogId.trim() === '') {
      return {
        success: false,
        message: 'FAILED: Missing Blogger Blog ID.',
        diagnostics: 'Please specify the numeric Blog ID from your Blogger dashboard URL (e.g., https://www.blogger.com/blog/posts/YOUR_BLOG_ID).'
      };
    }

    if (!accessToken || accessToken.trim() === '') {
      return {
        success: false,
        message: 'FAILED: Missing OAuth Access Token.',
        diagnostics: 'Blogger requires an OAuth 2.0 access token with scope https://www.googleapis.com/auth/blogger.'
      };
    }

    try {
      // Real API request to Google Blogger v3
      const url = `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(blogId.trim())}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken.trim()}`,
          'Accept': 'application/json'
        }
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data && data.id) {
        return {
          success: true,
          message: `CONNECTED: Verified blog "${data.name || integration.name}" (Posts: ${data.posts?.totalItems || 0})`,
          diagnostics: `Status: 200 OK | Blog Name: ${data.name} | URL: ${data.url}`
        };
      }

      // Safe diagnostics without exposing secrets
      const errDetail = data?.error?.message || response.statusText || 'Access denied or invalid credentials';
      const code = response.status || 400;

      return {
        success: false,
        message: `FAILED: Google Blogger API returned HTTP ${code}`,
        diagnostics: `Error: ${errDetail}. Check that your OAuth access token has not expired and has Blogger API scopes.`
      };
    } catch (networkErr: any) {
      return {
        success: false,
        message: 'FAILED: Network error communicating with Google Blogger API.',
        diagnostics: networkErr?.message || 'CORS or network timeout encountered during API validation.'
      };
    }
  }

  /**
   * Publishes an article to Blogger.
   */
  public static async publishPost(
    integration: BloggerIntegration, 
    post: { title: string; content: string; labels?: string[]; isDraft?: boolean }
  ): Promise<BloggerPublishResult> {
    const { blogId, accessToken, defaultStatus, defaultLabel } = integration;

    if (!blogId || !accessToken) {
      return {
        success: false,
        error: 'Cannot publish: Blogger integration is missing Blog ID or Access Token.'
      };
    }

    const labelsList = [...(post.labels || [])];
    if (defaultLabel && defaultLabel.trim() && !labelsList.includes(defaultLabel.trim())) {
      labelsList.push(defaultLabel.trim());
    }

    const isDraft = post.isDraft !== undefined ? post.isDraft : (defaultStatus === 'DRAFT');

    try {
      const url = `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(blogId)}/posts/?isDraft=${isDraft}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.trim()}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          kind: 'blogger#post',
          title: post.title,
          content: post.content,
          labels: labelsList
        })
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.id) {
        return {
          success: true,
          id: data.id,
          url: data.url || `https://www.blogger.com/blog/post/edit/${blogId}/${data.id}`
        };
      }

      return {
        success: false,
        error: data?.error?.message || `Blogger publication failed with HTTP ${response.status}`
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Network error attempting to publish post to Blogger'
      };
    }
  }
}
