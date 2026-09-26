/**
 * Dedicated Blogger API v3 Posting & Verification Service
 * Handles OAuth token validation/refresh, blog access verification, and post insertion with safe diagnostics.
 */

export interface SafeBloggerDebugInfo {
  integrationId?: string;
  blogId: string;
  blogUrl?: string;
  accessTokenPresent: boolean;
  accessTokenLength: number;
  requestUrl: string;
  httpMethod: string;
  responseStatus: number;
  responseContentType: string;
  responseBodySnippet?: string;
  executionTimeMs: number;
}

export interface BloggerServiceResult<T = any> {
  success: boolean;
  stage?: 'oauth' | 'token_refresh' | 'blog_verification' | 'post_insert' | 'publish' | 'network' | 'invalid_configuration';
  status?: number;
  statusText?: string;
  contentType?: string;
  googleError?: string;
  message?: string;
  error?: string;
  data?: T;
  postId?: string;
  url?: string;
  blogId?: string;
  blogName?: string;
  blogUrl?: string;
  postsCount?: number;
  isDraft?: boolean;
  debug?: SafeBloggerDebugInfo;
}

export interface BloggerPostInsertParams {
  integrationId?: string;
  blogId?: string;
  title: string;
  content: string;
  labels?: string[];
  isDraft?: boolean;
  integration?: {
    id?: string;
    blogId?: string;
    publicBlogUrl?: string;
    blogUrl?: string;
    accessToken?: string;
    refreshToken?: string;
    clientId?: string;
    clientSecret?: string;
    defaultStatus?: 'LIVE' | 'DRAFT';
    defaultLabels?: string[];
  };
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  articleId?: string;
}

/**
 * Safely parses response body as JSON or text snippet without throwing.
 */
async function parseSafeResponseBody(res: Response): Promise<{ isJson: boolean; json: any; snippet: string; contentType: string }> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text().catch(() => '');
  const snippet = text.slice(0, 300);

  if (contentType.toLowerCase().includes('application/json')) {
    try {
      const json = JSON.parse(text);
      return { isJson: true, json, snippet, contentType };
    } catch {
      return { isJson: false, json: null, snippet, contentType };
    }
  }

  return { isJson: false, json: null, snippet, contentType };
}

/**
 * Extracts human-readable Google error message from JSON or text.
 */
function extractGoogleErrorMessage(parsed: { isJson: boolean; json: any; snippet: string }, fallbackStatus: number): string {
  if (parsed.isJson && parsed.json) {
    if (typeof parsed.json.error === 'string') return parsed.json.error;
    if (parsed.json.error?.message) return parsed.json.error.message;
    if (parsed.json.message) return parsed.json.message;
  }
  if (parsed.snippet && parsed.snippet.trim().length > 0) {
    return parsed.snippet.trim();
  }
  return `Google API request failed with HTTP ${fallbackStatus}`;
}

/**
 * Refreshes an expired Google OAuth access token using the refresh token.
 */
export async function refreshGoogleAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ success: boolean; accessToken?: string; error?: string; status?: number }> {
  try {
    const params = new URLSearchParams({
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      refresh_token: refreshToken.trim(),
      grant_type: 'refresh_token',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    });

    const parsed = await parseSafeResponseBody(res);
    if (!res.ok) {
      const errorMsg = extractGoogleErrorMessage(parsed, res.status);
      return { success: false, error: errorMsg, status: res.status };
    }

    if (parsed.isJson && parsed.json?.access_token) {
      return { success: true, accessToken: parsed.json.access_token };
    }

    return { success: false, error: 'Google OAuth token endpoint did not return an access token.', status: res.status };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err), status: 0 };
  }
}

/**
 * Inspects the token scope to ensure write access is granted.
 */
export async function verifyTokenScope(accessToken: string): Promise<{ valid: boolean; scope?: string; error?: string }> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
    if (!res.ok) {
      // If tokeninfo fails, allow proceed to API call which will return authoritative 401/403
      return { valid: true };
    }
    const data = await res.json().catch(() => null);
    const scope = String(data?.scope || '');
    if (scope && scope.includes('blogger.readonly') && !scope.includes('https://www.googleapis.com/auth/blogger')) {
      return {
        valid: false,
        scope,
        error: 'The stored OAuth token only has read-only permission (https://www.googleapis.com/auth/blogger.readonly). Please re-connect Blogger in Settings -> Integrations to grant post publishing scope (https://www.googleapis.com/auth/blogger).',
      };
    }
    return { valid: true, scope };
  } catch {
    return { valid: true };
  }
}

/**
 * Validates and retrieves an active access token, refreshing if necessary.
 */
async function resolveAccessToken(credentials: {
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
}): Promise<{ success: boolean; token?: string; error?: string; stage?: 'oauth' | 'token_refresh'; status?: number }> {
  let token = credentials.accessToken?.trim();
  const refreshToken = credentials.refreshToken?.trim();
  const clientId = credentials.clientId?.trim();
  const clientSecret = credentials.clientSecret?.trim();

  // If no accessToken but refreshToken exists, refresh immediately
  if (!token && refreshToken && clientId && clientSecret) {
    const refreshRes = await refreshGoogleAccessToken(clientId, clientSecret, refreshToken);
    if (!refreshRes.success || !refreshRes.accessToken) {
      return {
        success: false,
        stage: 'token_refresh',
        status: refreshRes.status || 401,
        error: `Token refresh failed: ${refreshRes.error || 'Invalid refresh token'}`,
      };
    }
    token = refreshRes.accessToken;
  }

  if (!token) {
    return {
      success: false,
      stage: 'oauth',
      status: 401,
      error: 'OAuth Access Token is missing. Please connect your Google Blogger account in Settings -> Integrations.',
    };
  }

  return { success: true, token };
}

/**
 * Verifies Blog ID access by checking both blogs.get and blogs.listByUser.
 */
export async function verifyBlogAccess(
  cleanBlogId: string,
  accessToken: string
): Promise<{
  accessible: boolean;
  status: number;
  statusText: string;
  contentType: string;
  blogData?: any;
  error?: string;
  accessibleBlogs?: { id: string; name: string; url: string }[];
}> {
  // 1. Direct blogs.get check
  const getUrl = `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(cleanBlogId)}`;
  let getRes: Response;
  try {
    getRes = await fetch(getUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
  } catch (err: unknown) {
    return {
      accessible: false,
      status: 0,
      statusText: 'Network Error',
      contentType: '',
      error: `Network error connecting to Blogger API: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const getParsed = await parseSafeResponseBody(getRes);
  if (getRes.ok && getParsed.json?.id) {
    return {
      accessible: true,
      status: getRes.status,
      statusText: getRes.statusText,
      contentType: getParsed.contentType,
      blogData: getParsed.json,
    };
  }

  // 2. If direct get fails, query blogs.listByUser to inspect accessible blogs
  let listRes: Response | null = null;
  let accessibleBlogs: { id: string; name: string; url: string }[] = [];
  try {
    listRes = await fetch('https://www.googleapis.com/blogger/v3/users/self/blogs', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    if (listRes.ok) {
      const listParsed = await parseSafeResponseBody(listRes);
      if (Array.isArray(listParsed.json?.items)) {
        accessibleBlogs = listParsed.json.items.map((b: any) => ({
          id: String(b.id || '').trim(),
          name: String(b.name || '').trim(),
          url: String(b.url || '').trim(),
        }));
      }
    }
  } catch {
    // Ignore listByUser network errors and proceed with direct error
  }

  // Check if listByUser contains the blog
  const matching = accessibleBlogs.find((b) => b.id === cleanBlogId);
  if (matching) {
    return {
      accessible: true,
      status: 200,
      statusText: 'OK',
      contentType: 'application/json',
      blogData: matching,
      accessibleBlogs,
    };
  }

  const googleErrMsg = extractGoogleErrorMessage(getParsed, getRes.status);
  const accountErr = 'Authenticated Google account does not have access to this Blogger blog.';

  return {
    accessible: false,
    status: getRes.status,
    statusText: getRes.statusText,
    contentType: getParsed.contentType,
    error: accessibleBlogs.length > 0 ? accountErr : googleErrMsg,
    accessibleBlogs,
  };
}

/**
 * Blogger Test Endpoint Implementation
 * Validates integration, verifies access token and blog accessibility, and returns JSON.
 */
export async function testBloggerIntegrationHandler(integration: any): Promise<BloggerServiceResult> {
  const startTime = Date.now();
  const blogId = String(integration?.blogId || '').replace(/\s+/g, '');
  const integrationId = integration?.id || 'default';

  if (!blogId) {
    return {
      success: false,
      stage: 'invalid_configuration',
      status: 400,
      error: 'Blogger Blog ID is missing.',
      message: 'Blogger Blog ID is missing.',
    };
  }

  const tokenRes = await resolveAccessToken({
    accessToken: integration?.accessToken,
    refreshToken: integration?.refreshToken,
    clientId: integration?.clientId,
    clientSecret: integration?.clientSecret,
  });

  if (!tokenRes.success || !tokenRes.token) {
    return {
      success: false,
      stage: tokenRes.stage || 'oauth',
      status: tokenRes.status || 401,
      error: tokenRes.error || 'Access token missing',
      message: tokenRes.error || 'Access token missing',
    };
  }

  let accessToken = tokenRes.token;

  // Verify scope
  const scopeRes = await verifyTokenScope(accessToken);
  if (!scopeRes.valid) {
    return {
      success: false,
      stage: 'oauth',
      status: 403,
      error: scopeRes.error,
      message: scopeRes.error,
    };
  }

  // Verify Blog access
  let accessRes = await verifyBlogAccess(blogId, accessToken);

  // If 401 expired token and refresh credentials exist, retry once with refreshed token
  if (!accessRes.accessible && accessRes.status === 401 && integration?.refreshToken && integration?.clientId && integration?.clientSecret) {
    const refreshed = await refreshGoogleAccessToken(integration.clientId, integration.clientSecret, integration.refreshToken);
    if (refreshed.success && refreshed.accessToken) {
      accessToken = refreshed.accessToken;
      accessRes = await verifyBlogAccess(blogId, accessToken);
    }
  }

  const debug: SafeBloggerDebugInfo = {
    integrationId,
    blogId,
    blogUrl: accessRes.blogData?.url || integration?.publicBlogUrl || integration?.blogUrl,
    accessTokenPresent: true,
    accessTokenLength: accessToken.length,
    requestUrl: `https://www.googleapis.com/blogger/v3/blogs/${blogId}`,
    httpMethod: 'GET',
    responseStatus: accessRes.status,
    responseContentType: accessRes.contentType,
    executionTimeMs: Date.now() - startTime,
  };

  if (!accessRes.accessible) {
    return {
      success: false,
      stage: 'blog_verification',
      status: accessRes.status,
      statusText: accessRes.statusText,
      contentType: accessRes.contentType,
      googleError: accessRes.error,
      error: accessRes.error,
      message: accessRes.error,
      debug,
    };
  }

  return {
    success: true,
    blogId: accessRes.blogData?.id || blogId,
    blogName: accessRes.blogData?.name || 'Blogger Blog',
    blogUrl: accessRes.blogData?.url || integration?.publicBlogUrl || integration?.blogUrl,
    postsCount: accessRes.blogData?.posts?.totalItems ?? 0,
    debug,
  };
}

/**
 * Blogger Post Creation Implementation
 * Validates parameters, verifies blog access, and creates draft or live post using Blogger API v3 posts.insert.
 */
export async function createBloggerPostHandler(params: BloggerPostInsertParams): Promise<BloggerServiceResult> {
  const startTime = Date.now();
  const title = (params.title || '').trim();
  const content = (params.content || '').trim();
  const rawBlogId = params.blogId || params.integration?.blogId || '';
  const cleanBlogId = String(rawBlogId).replace(/\s+/g, '');
  const integrationId = params.integrationId || params.integration?.id || 'default';
  const isDraft = typeof params.isDraft === 'boolean' ? params.isDraft : true;
  const labels = Array.isArray(params.labels)
    ? params.labels.map((l) => String(l).trim()).filter(Boolean)
    : (params.integration?.defaultLabels || ['Technology', 'AI Systems']);

  // Stage 1: Validation
  if (!cleanBlogId) {
    return {
      success: false,
      stage: 'invalid_configuration',
      status: 400,
      error: 'Blogger Blog ID is required.',
      message: 'Blogger Blog ID is required.',
    };
  }

  if (!title) {
    return {
      success: false,
      stage: 'invalid_configuration',
      status: 400,
      error: 'Article title is required.',
      message: 'Article title is required.',
    };
  }

  if (!content) {
    return {
      success: false,
      stage: 'invalid_configuration',
      status: 400,
      error: 'Article HTML content is required.',
      message: 'Article HTML content is required.',
    };
  }

  // Stage 2: Token Resolution & Scope Verification
  const tokenRes = await resolveAccessToken({
    accessToken: params.accessToken || params.integration?.accessToken,
    refreshToken: params.refreshToken || params.integration?.refreshToken || process.env.BLOGGER_REFRESH_TOKEN,
    clientId: params.clientId || params.integration?.clientId || process.env.BLOGGER_CLIENT_ID,
    clientSecret: params.clientSecret || params.integration?.clientSecret || process.env.BLOGGER_CLIENT_SECRET,
  });

  if (!tokenRes.success || !tokenRes.token) {
    return {
      success: false,
      stage: tokenRes.stage || 'oauth',
      status: tokenRes.status || 401,
      error: tokenRes.error || 'Access token missing',
      message: tokenRes.error || 'Access token missing',
    };
  }

  let accessToken = tokenRes.token;

  // Scope verification
  const scopeRes = await verifyTokenScope(accessToken);
  if (!scopeRes.valid) {
    return {
      success: false,
      stage: 'oauth',
      status: 403,
      error: scopeRes.error,
      message: scopeRes.error,
    };
  }

  // Stage 3: Verify Blog Access
  let accessRes = await verifyBlogAccess(cleanBlogId, accessToken);

  // If 401, try refreshing token once if refresh credentials available
  const refreshToken = params.refreshToken || params.integration?.refreshToken || process.env.BLOGGER_REFRESH_TOKEN;
  const clientId = params.clientId || params.integration?.clientId || process.env.BLOGGER_CLIENT_ID;
  const clientSecret = params.clientSecret || params.integration?.clientSecret || process.env.BLOGGER_CLIENT_SECRET;

  if (!accessRes.accessible && accessRes.status === 401 && refreshToken && clientId && clientSecret) {
    const refreshed = await refreshGoogleAccessToken(clientId, clientSecret, refreshToken);
    if (refreshed.success && refreshed.accessToken) {
      accessToken = refreshed.accessToken;
      accessRes = await verifyBlogAccess(cleanBlogId, accessToken);
    }
  }

  if (!accessRes.accessible) {
    return {
      success: false,
      stage: 'blog_verification',
      status: accessRes.status,
      statusText: accessRes.statusText,
      contentType: accessRes.contentType,
      googleError: accessRes.error,
      error: accessRes.error,
      message: accessRes.error,
      debug: {
        integrationId,
        blogId: cleanBlogId,
        blogUrl: accessRes.blogData?.url || params.integration?.publicBlogUrl,
        accessTokenPresent: true,
        accessTokenLength: accessToken.length,
        requestUrl: `https://www.googleapis.com/blogger/v3/blogs/${cleanBlogId}`,
        httpMethod: 'GET',
        responseStatus: accessRes.status,
        responseContentType: accessRes.contentType,
        executionTimeMs: Date.now() - startTime,
      },
    };
  }

  // Stage 4: Posts.insert Request
  const postUrl = `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(cleanBlogId)}/posts?isDraft=${isDraft ? 'true' : 'false'}`;
  const requestBody = {
    kind: 'blogger#post',
    title,
    content,
    ...(labels.length > 0 ? { labels } : {}),
  };

  let postRes: Response;
  try {
    postRes = await fetch(postUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err: unknown) {
    return {
      success: false,
      stage: 'network',
      status: 0,
      statusText: 'Network Failure',
      contentType: '',
      error: `Network error sending post to Blogger API: ${err instanceof Error ? err.message : String(err)}`,
      message: `Network error sending post to Blogger API: ${err instanceof Error ? err.message : String(err)}`,
      debug: {
        integrationId,
        blogId: cleanBlogId,
        accessTokenPresent: true,
        accessTokenLength: accessToken.length,
        requestUrl: postUrl,
        httpMethod: 'POST',
        responseStatus: 0,
        responseContentType: '',
        executionTimeMs: Date.now() - startTime,
      },
    };
  }

  const postParsed = await parseSafeResponseBody(postRes);

  const debug: SafeBloggerDebugInfo = {
    integrationId,
    blogId: cleanBlogId,
    accessTokenPresent: true,
    accessTokenLength: accessToken.length,
    requestUrl: postUrl,
    httpMethod: 'POST',
    responseStatus: postRes.status,
    responseContentType: postParsed.contentType,
    responseBodySnippet: !postRes.ok ? postParsed.snippet : undefined,
    executionTimeMs: Date.now() - startTime,
  };

  if (!postRes.ok) {
    const googleError = extractGoogleErrorMessage(postParsed, postRes.status);
    return {
      success: false,
      stage: 'post_insert',
      status: postRes.status,
      statusText: postRes.statusText,
      contentType: postParsed.contentType,
      googleError,
      error: googleError,
      message: googleError,
      debug,
    };
  }

  const postData = postParsed.json || {};
  const postId = String(postData.id || '');
  const postPublishedUrl = String(postData.url || `https://${cleanBlogId}.blogspot.com/post/${postId}`);

  let updatedArticle = null;
  if (params.articleId) {
    try {
      const { StorageService } = await import('./storage.ts');
      const storage = StorageService.getInstance();
      const article = storage.getArticleById(params.articleId);
      if (article) {
        article.bloggerPost = {
          blogId: cleanBlogId,
          postId,
          url: postPublishedUrl,
          labels,
          publishedAt: postData.published || new Date().toISOString(),
          idempotencyHash: 'post_' + postId,
        };
        if (!isDraft) {
          article.lifecycleState = 'PUBLISHED';
        }
        storage.saveArticle(article);
        updatedArticle = article;
      }
    } catch {}
  }

  return {
    success: true,
    postId,
    url: postPublishedUrl,
    status: isDraft ? 200 : 200,
    isDraft,
    data: postData,
    debug,
  };
}
