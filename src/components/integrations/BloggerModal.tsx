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
  const [diagnostics, setDiagnostics] = useState<{
    oauthAccount: string | null;
    requestedBlogId: string;
    requestedBlogUrl: string;
    getBlogIdStatus: number;
    getByUrlStatus: number;
    listByUserStatus: number;
    listByUserCount: number;
    returnedBlogIds: string[];
    returnedBlogUrls: string[];
    explanation?: string;
  } | null>(null);

  // Verify access via Google Blogger API v3 (blogs.get, blogs.getByUrl, and blogs.listByUser)
  const verifyBlogAccess = async (
    targetBlogId: string,
    targetBlogUrl: string,
    token: string,
    tokenRefresh?: string
  ) => {
    const cleanBlogId = targetBlogId.trim();
    const cleanUrl = targetBlogUrl.trim();
    if (!cleanBlogId && !cleanUrl) {
      return {
        success: false,
        status: 'FAILED',
        error: 'Blogger Blog ID or Public Blog URL is required for verification.',
      };
    }

    try {
      const res = await fetch('/api/integrations/blogger/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blogId: cleanBlogId,
          publicBlogUrl: cleanUrl,
          accessToken: token.trim(),
          refreshToken: tokenRefresh?.trim() || refreshToken?.trim() || undefined,
          clientId: clientId.trim() || undefined,
          clientSecret:
            clientSecretInput && clientSecretInput !== MASKED_SECRET_PLACEHOLDER
              ? clientSecretInput.trim()
              : undefined,
        }),
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED',
        error: err?.message || 'Network request failed while verifying Blog ID',
      };
    }
  };

  // Process successful authorization and save to tara_blogger_integrations
  const processSuccessfulAuth = async (newAccessToken: string, newRefreshToken?: string) => {
    setIsVerifying(true);
    setOauthError(null);
    setDiagnostics(null);

    if (!newAccessToken) {
      setOauthError('Authorization completed, but no access token was returned by Google.');
      setIsVerifying(false);
      return;
    }

    // Assign the fresh access token from THIS session
    setAccessTokenInput(newAccessToken);
    if (newRefreshToken) {
      setRefreshToken(newRefreshToken);
    }

    // Verify access using the SAME authenticated OAuth access token from THIS session
    const verifyResult = await verifyBlogAccess(
      blogId,
      publicBlogUrl,
      newAccessToken,
      newRefreshToken
    );

    if (verifyResult.diagnostics) {
      setDiagnostics(verifyResult.diagnostics);
    }

    if (!verifyResult.success || verifyResult.status !== 'CONNECTED') {
      setIsConnected(false);
      setIsVerifying(false);
      const errMsg =
        verifyResult.error ||
        verifyResult.message ||
        'The Google account used for OAuth does not have access to this Blogger blog.';
      setOauthError(errMsg);
      return;
    }

    // Verification succeeded!
    setIsConnected(true);
    setIsVerifying(false);

    // Rule 6 & Rule 7: Automatically use returned verified blog ID, URL, and name
    const resolvedBlogId = verifyResult.blogId || blogId.trim();
    const resolvedUrl = verifyResult.blogUrl || publicBlogUrl.trim();
    const resolvedName = verifyResult.blogName || name.trim() || 'Blogger Blog';

    setBlogId(resolvedBlogId);
    setPublicBlogUrl(resolvedUrl);
    if (!name.trim() || name === 'Blogger Blog') {
      setName(resolvedName);
    }

    const detailText =
      verifyResult.message ||
      `Connected & verified access to "${resolvedName}" (${verifyResult.postsCount ?? 0} posts)`;
    setVerificationDetails(detailText);

    // Save the resulting configuration to tara_blogger_integrations in localStorage
    const labelsArray = defaultLabels
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    let savedConfig: BloggerIntegration;
    if (isEditing && existing) {
      const updates: Partial<BloggerIntegration> = {
        name: resolvedName,
        blogId: resolvedBlogId,
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
        blogId: resolvedBlogId,
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

  // Test current connection without triggering a new OAuth popup
  const handleTestCurrentConnection = async () => {
    const tokenToUse =
      accessTokenInput && accessTokenInput !== MASKED_SECRET_PLACEHOLDER
        ? accessTokenInput
        : existing?.accessToken || '';

    if (!tokenToUse) {
      setOauthError('No access token available. Please click "Connect Google Blogger" to authorize.');
      return;
    }

    setIsVerifying(true);
    setOauthError(null);
    setDiagnostics(null);

    const verifyResult = await verifyBlogAccess(
      blogId,
      publicBlogUrl,
      tokenToUse,
      refreshToken
    );

    if (verifyResult.diagnostics) {
      setDiagnostics(verifyResult.diagnostics);
    }

    if (!verifyResult.success || verifyResult.status !== 'CONNECTED') {
      setIsConnected(false);
      setIsVerifying(false);
      const errMsg =
        verifyResult.error ||
        verifyResult.message ||
        'The Google account used for OAuth does not have access to this Blogger blog.';
      setOauthError(errMsg);
      if (existing) {
        integrationStore.updateBlogger(existing.id, {
          connected: false,
          lastTestStatus: 'FAILED',
          lastTestMessage: errMsg,
          lastTestedAt: new Date().toISOString(),
        });
      }
      return;
    }

    setIsConnected(true);
    setIsVerifying(false);

    const resolvedBlogId = verifyResult.blogId || blogId.trim();
    const resolvedUrl = verifyResult.blogUrl || publicBlogUrl.trim();
    const resolvedName = verifyResult.blogName || name.trim() || 'Blogger Blog';

    setBlogId(resolvedBlogId);
    setPublicBlogUrl(resolvedUrl);
    if (!name.trim() || name === 'Blogger Blog') {
      setName(resolvedName);
    }

    const detailText =
      verifyResult.message ||
      `Connected & verified access to "${resolvedName}" (${verifyResult.postsCount ?? 0} posts)`;
    setVerificationDetails(detailText);

    if (existing) {
      integrationStore.updateBlogger(existing.id, {
        blogId: resolvedBlogId,
        publicBlogUrl: resolvedUrl,
        blogUrl: resolvedUrl,
        name: resolvedName,
        connected: true,
        lastTestStatus: 'CONNECTED',
        lastTestMessage: detailText,
        lastTestedAt: new Date().toISOString(),
      });
    }
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
                <div className="font-mono text-[11px] bg-black/40 p-2.5 rounded-lg border border-red-500/20 text-red-300">
                  {oauthError}
                </div>
              </div>
            )}

            {/* Safe Google Blogger API Diagnostics */}
            {diagnostics && (
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 font-mono">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Google Blogger API Diagnostics</span>
                  </span>
                  {diagnostics.oauthAccount && (
                    <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                      Account: {diagnostics.oauthAccount}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px] uppercase">blogs.get(blogId)</span>
                    <span
                      className={`text-xs font-bold ${
                        diagnostics.getBlogIdStatus === 200 ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      HTTP {diagnostics.getBlogIdStatus || 'N/A'}
                    </span>
                    <span className="text-slate-500 block truncate text-[10px] mt-0.5">
                      Requested: {diagnostics.requestedBlogId || 'None'}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px] uppercase">blogs.getByUrl</span>
                    <span
                      className={`text-xs font-bold ${
                        diagnostics.getByUrlStatus === 200 ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      HTTP {diagnostics.getByUrlStatus || 'N/A'}
                    </span>
                    <span className="text-slate-500 block truncate text-[10px] mt-0.5">
                      {diagnostics.requestedBlogUrl || 'None'}
                    </span>
                  </div>

                  <div className="col-span-1 sm:col-span-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px] uppercase">blogs.listByUser (self)</span>
                      <span
                        className={`font-bold text-xs ${
                          diagnostics.listByUserCount > 0 ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        {diagnostics.listByUserCount} blog{diagnostics.listByUserCount !== 1 ? 's' : ''} found (HTTP {diagnostics.listByUserStatus})
                      </span>
                    </div>
                    {diagnostics.returnedBlogIds && diagnostics.returnedBlogIds.length > 0 ? (
                      <div className="mt-2 space-y-1 text-[11px]">
                        {diagnostics.returnedBlogIds.map((bId, idx) => (
                          <div
                            key={bId}
                            className="flex items-center justify-between text-slate-300 bg-slate-900/60 px-2 py-1 rounded"
                          >
                            <span className="text-indigo-300 font-bold">{bId}</span>
                            <span className="text-slate-400 truncate max-w-[260px]">
                              {diagnostics.returnedBlogUrls[idx] || 'No URL'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1 text-[10px] text-slate-500 italic">
                        No Blogger blogs returned for this Google account.
                      </div>
                    )}
                  </div>
                </div>

                {diagnostics.explanation && (
                  <div className="text-[11px] text-slate-300 bg-slate-950/80 p-2 rounded-lg border border-slate-800 font-mono">
                    {diagnostics.explanation}
                  </div>
                )}
              </div>
            )}

            {/* CONNECT & TEST BUTTONS */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={handleConnectGoogleBlogger}
                disabled={isConnecting || isVerifying}
                className="w-full flex-1 flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-lg disabled:opacity-60 bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 hover:shadow-indigo-500/10 active:scale-[0.99]"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
                    <span>Authorizing in Google Popup...</span>
                  </>
                ) : isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
                    <span>Verifying access to Blog...</span>
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

              {(accessTokenInput || existing?.accessToken) && (
                <button
                  type="button"
                  onClick={handleTestCurrentConnection}
                  disabled={isConnecting || isVerifying}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-mono font-medium transition cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-60"
                  title="Verify currently held credentials without opening Google OAuth popup"
                >
                  {isVerifying ? 'Verifying...' : 'Test Connection'}
                </button>
              )}
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

