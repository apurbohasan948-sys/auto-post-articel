import React, { useState, useEffect } from 'react';
import {
  Globe,
  Key,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { BloggerIntegration } from '../../types/integrations.ts';
import { integrationStore, MASKED_SECRET_PLACEHOLDER } from '../../services/integrationStore.ts';
import { proxyFetch } from '../../services/apiClient.ts';

interface BloggerModalProps {
  existing: BloggerIntegration | null;
  onClose: () => void;
  onSave: (saved: BloggerIntegration) => void;
}

const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const BloggerModal: React.FC<BloggerModalProps> = ({ existing, onClose, onSave }) => {
  const isEditing = Boolean(existing);
  const [name, setName] = useState(existing?.name || '');
  const [blogId, setBlogId] = useState(existing?.blogId || '');
  const [publicBlogUrl, setPublicBlogUrl] = useState(existing?.publicBlogUrl || existing?.blogUrl || '');
  const [defaultLabels, setDefaultLabels] = useState(
    existing?.defaultLabels?.join(', ') || existing?.defaultLabel || ''
  );
  const [defaultStatus, setDefaultStatus] = useState<'DRAFT' | 'LIVE'>(
    existing?.defaultStatus === 'LIVE' ? 'LIVE' : 'DRAFT'
  );
  const [priority, setPriority] = useState(existing?.priority || 1);

  // Masked secret handling: separate input from stored
  const [accessTokenInput, setAccessTokenInput] = useState(
    existing?.accessToken ? MASKED_SECRET_PLACEHOLDER : ''
  );
  const [refreshToken, setRefreshToken] = useState(existing?.refreshToken || '');
  const [clientId, setClientId] = useState(existing?.clientId || '');
  const [clientSecretInput, setClientSecretInput] = useState(
    existing?.clientSecret ? MASKED_SECRET_PLACEHOLDER : ''
  );

  // OAuth states
  const [isConnected, setIsConnected] = useState<boolean>(
    Boolean(
      existing?.connected ||
        existing?.lastTestStatus === 'CONNECTED' ||
        existing?.lastTestStatus === 'success'
    )
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationDetails, setVerificationDetails] = useState<string | null>(
    existing?.lastTestMessage || null
  );
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showManualOptions, setShowManualOptions] = useState(false);

  // Verify access to the selected Blog ID via Google Blogger API v3
  const verifyBlogAccess = async (
    targetBlogId: string,
    token: string
  ): Promise<{
    success: boolean;
    blogName?: string;
    blogUrl?: string;
    postsCount?: number;
    error?: string;
    details?: any;
  }> => {
    const cleanBlogId = targetBlogId.trim();
    if (!cleanBlogId) {
      return { success: false, error: 'Blogger Blog ID is required for verification.' };
    }

    try {
      const res = await proxyFetch({
        url: `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(cleanBlogId)}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/json',
        },
      });

      if (res.ok && res.data && res.data.id) {
        return {
          success: true,
          blogName: res.data.name || 'Blogger Blog',
          blogUrl: res.data.url || '',
          postsCount: res.data.posts?.totalItems ?? 0,
        };
      } else {
        const errorMsg =
          res.data?.error?.message ||
          res.error ||
          (res.status === 404
            ? `Blog ID "${cleanBlogId}" was not found.`
            : res.status === 403
            ? `Permission denied: the authenticated Google account does not have access to Blog ID "${cleanBlogId}".`
            : `Google Blogger API error (HTTP ${res.status})`);
        return {
          success: false,
          error: errorMsg,
          details: res.data || { status: res.status },
        };
      }
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Network request failed while verifying Blog ID',
      };
    }
  };

  // Process successful authorization and save to tara_blogger_integrations
  const processSuccessfulAuth = async (newAccessToken: string, newRefreshToken?: string) => {
    setIsVerifying(true);
    setOauthError(null);

    if (!newAccessToken) {
      setOauthError('Authorization completed, but no access token was returned by Google.');
      setIsVerifying(false);
      return;
    }

    // Automatically assign the access token without requiring manual pasting
    setAccessTokenInput(newAccessToken);
    if (newRefreshToken) {
      setRefreshToken(newRefreshToken);
    }

    // Verify access to the selected Blog ID
    const verifyResult = await verifyBlogAccess(blogId, newAccessToken);

    if (!verifyResult.success) {
      setIsConnected(false);
      setIsVerifying(false);
      // Return clear error without faking
      const errDisplay = verifyResult.details
        ? JSON.stringify(verifyResult.details, null, 2)
        : verifyResult.error || 'Failed to verify Blog ID';
      setOauthError(`Google OAuth authorized, but Blog ID verification failed: ${errDisplay}`);
      return;
    }

    // Verification succeeded
    setIsConnected(true);
    setIsVerifying(false);

    const resolvedName = name.trim() || verifyResult.blogName || 'Blogger Blog';
    const resolvedUrl = publicBlogUrl.trim() || verifyResult.blogUrl || '';

    if (!name.trim() && verifyResult.blogName) {
      setName(verifyResult.blogName);
    }
    if (!publicBlogUrl.trim() && verifyResult.blogUrl) {
      setPublicBlogUrl(verifyResult.blogUrl);
    }

    const detailText = `Connected & verified access to "${verifyResult.blogName}" (${verifyResult.postsCount ?? 0} posts)`;
    setVerificationDetails(detailText);

    // Save the resulting configuration to tara_blogger_integrations
    const labelsArray = defaultLabels
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    let savedConfig: BloggerIntegration;
    if (isEditing && existing) {
      const updates: Partial<BloggerIntegration> = {
        name: resolvedName,
        blogId: blogId.trim(),
        publicBlogUrl: resolvedUrl,
        blogUrl: resolvedUrl,
        defaultLabels: labelsArray,
        defaultLabel: labelsArray[0] || '',
        defaultStatus,
        priority: Number(priority) || 1,
        clientId: clientId.trim(),
        accessToken: newAccessToken,
        connected: true,
        lastTestStatus: 'CONNECTED',
        lastTestMessage: detailText,
        lastTestedAt: new Date().toISOString(),
      };
      if (newRefreshToken) updates.refreshToken = newRefreshToken;
      if (clientSecretInput && clientSecretInput !== MASKED_SECRET_PLACEHOLDER) {
        updates.clientSecret = clientSecretInput.trim();
      }

      const updated = integrationStore.updateBlogger(existing.id, updates);
      savedConfig = updated || { ...existing, ...updates };
    } else {
      savedConfig = integrationStore.addBlogger({
        name: resolvedName,
        blogId: blogId.trim(),
        publicBlogUrl: resolvedUrl,
        blogUrl: resolvedUrl,
        defaultLabels: labelsArray,
        defaultLabel: labelsArray[0] || '',
        defaultStatus,
        priority: Number(priority) || 1,
        clientId: clientId.trim(),
        clientSecret:
          clientSecretInput === MASKED_SECRET_PLACEHOLDER ? '' : clientSecretInput.trim(),
        accessToken: newAccessToken,
        refreshToken: newRefreshToken || '',
        enabled: true,
        connected: true,
        lastTestStatus: 'CONNECTED',
        lastTestMessage: detailText,
        lastTestedAt: new Date().toISOString(),
      });
    }

    onSave(savedConfig);
  };

  // Start the Google OAuth 2.0 flow
  const handleConnectGoogleBlogger = async () => {
    setOauthError(null);
    setValidationError(null);

    if (!blogId.trim()) {
      setValidationError('Please enter your Blogger Blog ID first so we can verify access upon authorization.');
      return;
    }

    setIsConnecting(true);

    try {
      const redirectUri = `${window.location.origin}/api/blogger/oauth/callback`;
      const queryParams = new URLSearchParams({
        redirectUri,
      });

      if (clientId.trim()) {
        queryParams.set('clientId', clientId.trim());
      }

      const stateObj: any = {
        blogId: blogId.trim(),
        redirectUri,
      };
      if (clientId.trim()) stateObj.clientId = clientId.trim();
      if (clientSecretInput && clientSecretInput !== MASKED_SECRET_PLACEHOLDER) {
        stateObj.clientSecret = clientSecretInput.trim();
      }
      queryParams.set('state', btoa(JSON.stringify(stateObj)));

      const res = await fetch(`/api/blogger/oauth/url?${queryParams.toString()}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success || !data.url) {
        const errorJson = JSON.stringify(
          {
            error: data.error || 'Failed to initiate Google OAuth 2.0 flow.',
            instructions: data.instructions,
            statusCode: res.status,
          },
          null,
          2
        );
        setOauthError(errorJson);
        setIsConnecting(false);
        return;
      }

      // Open OAuth provider directly in popup window
      const popupWidth = 600;
      const popupHeight = 700;
      const left = window.screenX + (window.outerWidth - popupWidth) / 2;
      const top = window.screenY + (window.outerHeight - popupHeight) / 2;

      const popup = window.open(
        data.url,
        'google_blogger_oauth_popup',
        `width=${popupWidth},height=${popupHeight},left=${left},top=${top},status=no,menubar=no,toolbar=no`
      );

      if (!popup || popup.closed) {
        setOauthError('Popup window was blocked by your browser. Please allow popups for this site to complete Google OAuth.');
        setIsConnecting(false);
        return;
      }

      // Listen for message from callback window
      const messageHandler = async (event: MessageEvent) => {
        const origin = event.origin;
        if (
          !origin.endsWith('.run.app') &&
          !origin.includes('localhost') &&
          origin !== window.location.origin
        ) {
          return;
        }

        if (!event.data || typeof event.data !== 'object') return;

        if (event.data.type === 'BLOGGER_OAUTH_ERROR') {
          window.removeEventListener('message', messageHandler);
          clearInterval(popupWatchdog);
          setIsConnecting(false);
          const errDetail = event.data.details
            ? JSON.stringify(event.data.details, null, 2)
            : event.data.error || 'Google authorization was denied or failed.';
          setOauthError(errDetail);
        } else if (event.data.type === 'BLOGGER_OAUTH_CODE') {
          window.removeEventListener('message', messageHandler);
          clearInterval(popupWatchdog);
          setIsConnecting(false);
          setIsVerifying(true);

          try {
            const exchangeRes = await fetch('/api/blogger/oauth/exchange', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: event.data.payload.code,
                redirectUri: event.data.payload.redirectUri || redirectUri,
                clientId: clientId.trim() || undefined,
                clientSecret:
                  clientSecretInput && clientSecretInput !== MASKED_SECRET_PLACEHOLDER
                    ? clientSecretInput.trim()
                    : undefined,
              }),
            });
            const exchangeData = await exchangeRes.json().catch(() => ({}));
            if (!exchangeRes.ok || !exchangeData.success) {
              setOauthError(
                JSON.stringify(
                  exchangeData.details || { error: exchangeData.error || 'Failed to exchange authorization code' },
                  null,
                  2
                )
              );
              setIsVerifying(false);
              return;
            }

            await processSuccessfulAuth(exchangeData.accessToken, exchangeData.refreshToken);
          } catch (exchangeErr: any) {
            setOauthError(JSON.stringify({ error: exchangeErr?.message || 'Token exchange failed' }));
            setIsVerifying(false);
          }
        } else if (event.data.type === 'BLOGGER_OAUTH_SUCCESS') {
          window.removeEventListener('message', messageHandler);
          clearInterval(popupWatchdog);
          setIsConnecting(false);
          setIsVerifying(true);

          const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
            event.data.payload || {};
          await processSuccessfulAuth(newAccessToken, newRefreshToken);
        }
      };

      window.addEventListener('message', messageHandler);

      const popupWatchdog = setInterval(() => {
        if (popup.closed) {
          clearInterval(popupWatchdog);
          window.removeEventListener('message', messageHandler);
          setIsConnecting(false);
        }
      }, 1000);
    } catch (err: any) {
      setIsConnecting(false);
      setOauthError(JSON.stringify({ error: err?.message || 'Unexpected OAuth error' }, null, 2));
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      setValidationError('Account name is required.');
      return;
    }
    if (!blogId.trim()) {
      setValidationError('Blogger Blog ID is required.');
      return;
    }

    const labelsArray = defaultLabels
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (isEditing && existing) {
        const updates: Partial<BloggerIntegration> = {
          name: name.trim(),
          blogId: blogId.trim(),
          publicBlogUrl: publicBlogUrl.trim(),
          blogUrl: publicBlogUrl.trim(),
          defaultLabels: labelsArray,
          defaultLabel: labelsArray[0] || '',
          defaultStatus,
          priority: Number(priority) || 1,
          clientId: clientId.trim(),
          connected: isConnected,
        };

        // Preserve unedited masked secrets
        if (accessTokenInput && accessTokenInput !== MASKED_SECRET_PLACEHOLDER) {
          updates.accessToken = accessTokenInput.trim();
        }
        if (clientSecretInput && clientSecretInput !== MASKED_SECRET_PLACEHOLDER) {
          updates.clientSecret = clientSecretInput.trim();
        }
        if (refreshToken && refreshToken !== MASKED_SECRET_PLACEHOLDER) {
          updates.refreshToken = refreshToken.trim();
        }

        const saved = integrationStore.updateBlogger(existing.id, updates);
        if (saved) onSave(saved);
      } else {
        const saved = integrationStore.addBlogger({
          name: name.trim(),
          blogId: blogId.trim(),
          publicBlogUrl: publicBlogUrl.trim(),
          blogUrl: publicBlogUrl.trim(),
          defaultLabels: labelsArray,
          defaultLabel: labelsArray[0] || '',
          defaultStatus,
          priority: Number(priority) || 1,
          clientId: clientId.trim(),
          clientSecret:
            clientSecretInput === MASKED_SECRET_PLACEHOLDER ? '' : clientSecretInput.trim(),
          accessToken:
            accessTokenInput === MASKED_SECRET_PLACEHOLDER ? '' : accessTokenInput.trim(),
          refreshToken: refreshToken || '',
          enabled: true,
          connected: isConnected,
        });
        onSave(saved);
      }
    } catch (err: any) {
      setValidationError(err.message || 'Failed to save integration');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-6 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {isEditing ? 'Edit Blogger Configuration' : 'Add Blogger Account'}
              </h3>
              <p className="text-xs text-slate-400">Direct Google Blogger API v3 integration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Validation Error Alert */}
        {validationError && (
          <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <div className="space-y-4 text-sm">
          {/* Account Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Configuration Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tech Radar Official Blog"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Blog ID & Public URL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Blogger Blog ID *
              </label>
              <input
                type="text"
                value={blogId}
                onChange={(e) => {
                  setBlogId(e.target.value);
                  setIsConnected(false);
                  setVerificationDetails(null);
                }}
                placeholder="e.g. 8493029482948294"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-xs"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Found in your Blogger URL: blogger.com/blog/posts/<b>[blogId]</b>
              </span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Public Blog URL
              </label>
              <input
                type="url"
                value={publicBlogUrl}
                onChange={(e) => setPublicBlogUrl(e.target.value)}
                placeholder="https://myblog.blogspot.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* REAL CONNECT GOOGLE BLOGGER OAUTH SECTION */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-200">
                  Google Blogger OAuth 2.0 Connection
                </span>
              </div>
              <div>
                {isConnected ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                    Not Connected
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Connect your Google account to automatically authorize Blogger publishing with the{' '}
              <code className="text-indigo-300 text-[11px]">https://www.googleapis.com/auth/blogger</code>{' '}
              scope.
            </p>

            {/* Verification Success Details */}
            {verificationDetails && isConnected && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{verificationDetails}</span>
              </div>
            )}

            {/* Clear JSON OAuth Error Output */}
            {oauthError && (
              <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-red-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>OAuth Connection Error</span>
                </div>
                <pre className="font-mono text-[11px] bg-black/40 p-2.5 rounded-lg border border-red-500/20 overflow-x-auto whitespace-pre-wrap break-all text-red-300">
                  {oauthError}
                </pre>
              </div>
            )}

            {/* REAL CONNECT GOOGLE BLOGGER BUTTON */}
            <div>
              <button
                type="button"
                onClick={handleConnectGoogleBlogger}
                disabled={isConnecting || isVerifying}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-lg disabled:opacity-60 bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 hover:shadow-indigo-500/10 active:scale-[0.99]"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
                    <span>Authorizing in Google Popup...</span>
                  </>
                ) : isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
                    <span>Verifying access to Blog ID "{blogId}"...</span>
                  </>
                ) : isConnected ? (
                  <>
                    <GoogleIcon className="w-4 h-4" />
                    <span>Re-connect Google Blogger</span>
                  </>
                ) : (
                  <>
                    <GoogleIcon className="w-4 h-4" />
                    <span>Connect Google Blogger</span>
                  </>
                )}
              </button>
            </div>

            {/* Advanced & Manual Configuration Toggle */}
            <div className="pt-2 border-t border-slate-900">
              <button
                type="button"
                onClick={() => setShowManualOptions(!showManualOptions)}
                className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1 transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Advanced / Manual Access Token Options</span>
                </span>
                {showManualOptions ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showManualOptions && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Manual Access Token (Bearer)
                    </label>
                    <input
                      type="password"
                      value={accessTokenInput}
                      onFocus={() => {
                        if (accessTokenInput === MASKED_SECRET_PLACEHOLDER)
                          setAccessTokenInput('');
                      }}
                      onChange={(e) => setAccessTokenInput(e.target.value)}
                      placeholder="Enter Google OAuth Access Token manually"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Optional: Paste a token generated from Google OAuth 2.0 Playground.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        OAuth Client ID (Optional)
                      </label>
                      <input
                        type="text"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        placeholder="xxxx.apps.googleusercontent.com"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-white placeholder-slate-600 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        OAuth Client Secret (Optional)
                      </label>
                      <input
                        type="password"
                        value={clientSecretInput}
                        onFocus={() => {
                          if (clientSecretInput === MASKED_SECRET_PLACEHOLDER)
                            setClientSecretInput('');
                        }}
                        onChange={(e) => setClientSecretInput(e.target.value)}
                        placeholder="Client secret"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-white placeholder-slate-600 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Publishing Settings: Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Default Status
              </label>
              <select
                value={defaultStatus}
                onChange={(e) => setDefaultStatus(e.target.value as 'DRAFT' | 'LIVE')}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="DRAFT">Save as Draft (Recommended)</option>
                <option value="LIVE">Publish Live Directly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Priority
              </label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value) || 1)}
                min={1}
                max={100}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Default Labels */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Default Labels (comma separated)
            </label>
            <input
              type="text"
              value={defaultLabels}
              onChange={(e) => setDefaultLabels(e.target.value)}
              placeholder="AI, Automation, Technology"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition cursor-pointer shadow-lg shadow-indigo-600/20"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

