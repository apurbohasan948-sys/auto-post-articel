import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Activity,
  Save,
  Youtube,
  Instagram,
  Facebook,
  Video,
} from 'lucide-react';
import { SocialIntegration, SocialPlatform } from '../../types/integrations.ts';
import {
  facebookAdapter,
  instagramAdapter,
  youtubeAdapter,
  tikTokAdapter,
} from '../../services/adapters/index.ts';
import { integrationStore } from '../../services/integrationStore.ts';

interface SocialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (social: SocialIntegration) => void;
  editingSocial?: SocialIntegration | null;
  defaultPlatform?: SocialPlatform;
}

const MASK_PLACEHOLDER = '••••••••••••••••';

export const SocialModal: React.FC<SocialModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingSocial,
  defaultPlatform = 'facebook',
}) => {
  const [platform, setPlatform] = useState<SocialPlatform>(defaultPlatform);
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);

  // Platform specific credential states
  // Facebook
  const [fbPageId, setFbPageId] = useState('');
  const [fbAccessToken, setFbAccessToken] = useState('');
  const [fbAppId, setFbAppId] = useState('');
  const [fbAppSecret, setFbAppSecret] = useState('');

  // Instagram
  const [igAccountId, setIgAccountId] = useState('');
  const [igAccessToken, setIgAccessToken] = useState('');

  // YouTube
  const [ytChannelId, setYtChannelId] = useState('');
  const [ytApiKey, setYtApiKey] = useState('');
  const [ytAccessToken, setYtAccessToken] = useState('');

  // TikTok
  const [ttOpenId, setTtOpenId] = useState('');
  const [ttAccessToken, setTtAccessToken] = useState('');
  const [ttClientKey, setTtClientKey] = useState('');

  // Password visibility
  const [showMasked, setShowMasked] = useState<Record<string, boolean>>({});

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status: 'CONNECTED' | 'FAILED';
    latencyMs: number;
    message?: string;
    error?: string;
  } | null>(null);

  const [formError, setFormError] = useState<string | null>(null);

  const toggleShow = (key: string) => {
    setShowMasked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (editingSocial) {
      setPlatform(editingSocial.platform);
      setName(editingSocial.name || '');
      setEnabled(editingSocial.enabled ?? true);

      const creds = editingSocial.credentials || {};
      if (editingSocial.platform === 'facebook') {
        setFbPageId(creds.pageId || '');
        setFbAccessToken(creds.accessToken ? MASK_PLACEHOLDER : '');
        setFbAppId(creds.appId || '');
        setFbAppSecret(creds.appSecret ? MASK_PLACEHOLDER : '');
      } else if (editingSocial.platform === 'instagram') {
        setIgAccountId(creds.instagramAccountId || '');
        setIgAccessToken(creds.accessToken ? MASK_PLACEHOLDER : '');
      } else if (editingSocial.platform === 'youtube') {
        setYtChannelId(creds.channelId || '');
        setYtApiKey(creds.apiKey ? MASK_PLACEHOLDER : '');
        setYtAccessToken(creds.accessToken ? MASK_PLACEHOLDER : '');
      } else if (editingSocial.platform === 'tiktok') {
        setTtOpenId(creds.openId || '');
        setTtAccessToken(creds.accessToken ? MASK_PLACEHOLDER : '');
        setTtClientKey(creds.clientKey || '');
      }

      if (editingSocial.lastTestStatus && editingSocial.lastTestStatus !== 'NOT_CONFIGURED') {
        setTestResult({
          success: editingSocial.lastTestStatus === 'CONNECTED',
          status: editingSocial.lastTestStatus,
          latencyMs: editingSocial.lastLatencyMs || 0,
          message: editingSocial.lastTestStatus === 'CONNECTED' ? 'Previously connected' : undefined,
          error: editingSocial.lastError,
        });
      } else {
        setTestResult(null);
      }
    } else {
      setPlatform(defaultPlatform);
      setName('');
      setEnabled(true);
      setFbPageId('');
      setFbAccessToken('');
      setFbAppId('');
      setFbAppSecret('');
      setIgAccountId('');
      setIgAccessToken('');
      setYtChannelId('');
      setYtApiKey('');
      setYtAccessToken('');
      setTtOpenId('');
      setTtAccessToken('');
      setTtClientKey('');
      setTestResult(null);
    }
    setFormError(null);
    setShowMasked({});
  }, [editingSocial, defaultPlatform, isOpen]);

  if (!isOpen) return null;

  // Build current credentials payload with masked key preservation
  const buildCredentials = (): Record<string, string> => {
    const origCreds = editingSocial?.credentials || {};
    const creds: Record<string, string> = {};

    if (platform === 'facebook') {
      creds.pageId = fbPageId.trim();
      creds.accessToken = fbAccessToken.includes('••••') ? origCreds.accessToken : fbAccessToken.trim();
      if (fbAppId.trim()) creds.appId = fbAppId.trim();
      if (fbAppSecret.trim()) {
        creds.appSecret = fbAppSecret.includes('••••') ? origCreds.appSecret : fbAppSecret.trim();
      }
    } else if (platform === 'instagram') {
      creds.instagramAccountId = igAccountId.trim();
      creds.accessToken = igAccessToken.includes('••••') ? origCreds.accessToken : igAccessToken.trim();
    } else if (platform === 'youtube') {
      creds.channelId = ytChannelId.trim();
      if (ytApiKey.trim()) {
        creds.apiKey = ytApiKey.includes('••••') ? origCreds.apiKey : ytApiKey.trim();
      }
      if (ytAccessToken.trim()) {
        creds.accessToken = ytAccessToken.includes('••••') ? origCreds.accessToken : ytAccessToken.trim();
      }
    } else if (platform === 'tiktok') {
      creds.openId = ttOpenId.trim();
      creds.accessToken = ttAccessToken.includes('••••') ? origCreds.accessToken : ttAccessToken.trim();
      if (ttClientKey.trim()) creds.clientKey = ttClientKey.trim();
    }

    return creds;
  };

  const handleTestConnection = async () => {
    setFormError(null);
    const creds = buildCredentials();

    // Client-side quick check
    if (platform === 'facebook' && (!creds.pageId || !creds.accessToken)) {
      setFormError('Facebook Page ID and Page Access Token are both required to test.');
      return;
    }
    if (platform === 'instagram' && (!creds.instagramAccountId || !creds.accessToken)) {
      setFormError('Instagram Business Account ID and Access Token are both required to test.');
      return;
    }
    if (platform === 'youtube' && (!creds.channelId && !creds.accessToken && !creds.apiKey)) {
      setFormError('YouTube Channel ID and API Key or Access Token are required to test.');
      return;
    }
    if (platform === 'tiktok' && !creds.accessToken) {
      setFormError('TikTok Creator Access Token is required to test.');
      return;
    }

    setIsTesting(true);
    const tempIntegration: SocialIntegration = {
      id: editingSocial?.id || 'temp',
      platform,
      name: name.trim() || `${platform} Integration`,
      enabled,
      credentials: creds,
    };

    let res;
    if (platform === 'facebook') {
      res = await facebookAdapter.testConnection(tempIntegration);
    } else if (platform === 'instagram') {
      res = await instagramAdapter.testConnection(tempIntegration);
    } else if (platform === 'youtube') {
      res = await youtubeAdapter.testConnection(tempIntegration);
    } else {
      res = await tikTokAdapter.testConnection(tempIntegration);
    }

    setIsTesting(false);
    setTestResult(res);

    if (editingSocial?.id) {
      integrationStore.recordSocialTestResult(editingSocial.id, res);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Account / Channel Name is required.');
      return;
    }

    const creds = buildCredentials();

    const payload: SocialIntegration = {
      id: editingSocial?.id || `soc_${platform}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      platform,
      name: name.trim(),
      enabled,
      credentials: creds,
      lastTestedAt: testResult ? new Date().toISOString() : editingSocial?.lastTestedAt,
      lastTestStatus: testResult ? testResult.status : editingSocial?.lastTestStatus || 'NOT_CONFIGURED',
      lastLatencyMs: testResult ? testResult.latencyMs : editingSocial?.lastLatencyMs,
      lastError: testResult?.status === 'FAILED' ? (testResult.error || testResult.message) : undefined,
    };

    onSave(payload);
    onClose();
  };

  const getPlatformIcon = (p: SocialPlatform) => {
    switch (p) {
      case 'facebook':
        return <Facebook className="w-4 h-4 text-blue-400" />;
      case 'instagram':
        return <Instagram className="w-4 h-4 text-pink-400" />;
      case 'youtube':
        return <Youtube className="w-4 h-4 text-red-400" />;
      case 'tiktok':
        return <Video className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col my-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
              {getPlatformIcon(platform)}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-display">
                {editingSocial ? `Edit ${name || 'Social Account'}` : 'Add Social Media Integration'}
              </h3>
              <p className="text-xs text-slate-400">
                Configure credentials for autonomous social amplification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Test Result Display */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                testResult.status === 'CONNECTED'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {testResult.status === 'CONNECTED' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold flex items-center justify-between">
                  <span>
                    {testResult.status === 'CONNECTED'
                      ? 'Live Connection Verified'
                      : 'Connection Test Failed'}
                  </span>
                  <span className="font-mono text-[11px] opacity-80">
                    {testResult.latencyMs}ms
                  </span>
                </div>
                <p className="text-[11px] mt-0.5 opacity-90 break-words">
                  {testResult.status === 'CONNECTED'
                    ? testResult.message
                    : testResult.error || 'Verify tokens and permissions.'}
                </p>
              </div>
            </div>
          )}

          {/* Platform Selector */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Select Social Network
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['facebook', 'instagram', 'youtube', 'tiktok'] as SocialPlatform[]).map((p) => {
                const isSel = platform === p;
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={Boolean(editingSocial)}
                    onClick={() => {
                      setPlatform(p);
                      setTestResult(null);
                    }}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all cursor-pointer ${
                      isSel
                        ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    } ${editingSocial ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {getPlatformIcon(p)}
                    <span className="capitalize font-semibold text-[11px]">
                      {p === 'facebook' ? 'Facebook Page' : p}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account Display Name */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Account / Channel Display Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`e.g. Official ${platform.toUpperCase()} Channel`}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Platform Specific Credential Fields */}
          {platform === 'facebook' && (
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  Facebook Page Credentials
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Meta Graph API v19.0</span>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">
                  Facebook Page ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={fbPageId}
                  onChange={(e) => setFbPageId(e.target.value)}
                  placeholder="e.g. 102938475619283"
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400">
                    Page Access Token <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleShow('fb_token')}
                    className="text-slate-500 hover:text-slate-300 flex items-center gap-1 text-[11px]"
                  >
                    {showMasked['fb_token'] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showMasked['fb_token'] ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  type={showMasked['fb_token'] ? 'text' : 'password'}
                  value={fbAccessToken}
                  onChange={(e) => setFbAccessToken(e.target.value)}
                  placeholder="EAAB..."
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 mb-1">App ID (Optional)</label>
                  <input
                    type="text"
                    value={fbAppId}
                    onChange={(e) => setFbAppId(e.target.value)}
                    placeholder="e.g. 987654321"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">App Secret (Optional)</label>
                  <input
                    type={showMasked['fb_secret'] ? 'text' : 'password'}
                    value={fbAppSecret}
                    onChange={(e) => setFbAppSecret(e.target.value)}
                    placeholder="Secret"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}

          {platform === 'instagram' && (
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-pink-400" />
                  Instagram Business Account Credentials
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Instagram Graph API</span>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">
                  Instagram Business Account ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={igAccountId}
                  onChange={(e) => setIgAccountId(e.target.value)}
                  placeholder="e.g. 17841400123456789"
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400">
                    Graph API Access Token <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleShow('ig_token')}
                    className="text-slate-500 hover:text-slate-300 flex items-center gap-1 text-[11px]"
                  >
                    {showMasked['ig_token'] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showMasked['ig_token'] ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  type={showMasked['ig_token'] ? 'text' : 'password'}
                  value={igAccessToken}
                  onChange={(e) => setIgAccessToken(e.target.value)}
                  placeholder="IGQV..."
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {platform === 'youtube' && (
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-red-400" />
                  YouTube Data API v3 Credentials
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Google YouTube API</span>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">
                  Channel ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={ytChannelId}
                  onChange={(e) => setYtChannelId(e.target.value)}
                  placeholder="e.g. UC_x5XG1OV2P6uZZ5FSM9Ttw"
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400">API Key</label>
                  <button
                    type="button"
                    onClick={() => toggleShow('yt_key')}
                    className="text-slate-500 hover:text-slate-300 flex items-center gap-1 text-[11px]"
                  >
                    {showMasked['yt_key'] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
                <input
                  type={showMasked['yt_key'] ? 'text' : 'password'}
                  value={ytApiKey}
                  onChange={(e) => setYtApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400">OAuth Access Token (Optional for Community Posts)</label>
                  <button
                    type="button"
                    onClick={() => toggleShow('yt_token')}
                    className="text-slate-500 hover:text-slate-300 flex items-center gap-1 text-[11px]"
                  >
                    {showMasked['yt_token'] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
                <input
                  type={showMasked['yt_token'] ? 'text' : 'password'}
                  value={ytAccessToken}
                  onChange={(e) => setYtAccessToken(e.target.value)}
                  placeholder="ya29..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {platform === 'tiktok' && (
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  TikTok Open API Credentials
                </span>
                <span className="text-[10px] text-slate-400 font-mono">TikTok API v2</span>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">
                  Creator Open ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={ttOpenId}
                  onChange={(e) => setTtOpenId(e.target.value)}
                  placeholder="e.g. _000abc123..."
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400">
                    Access Token <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleShow('tt_token')}
                    className="text-slate-500 hover:text-slate-300 flex items-center gap-1 text-[11px]"
                  >
                    {showMasked['tt_token'] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showMasked['tt_token'] ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  type={showMasked['tt_token'] ? 'text' : 'password'}
                  value={ttAccessToken}
                  onChange={(e) => setTtAccessToken(e.target.value)}
                  placeholder="act.exampleToken..."
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Client Key / App ID (Optional)</label>
                <input
                  type="text"
                  value={ttClientKey}
                  onChange={(e) => setTtClientKey(e.target.value)}
                  placeholder="aw123456"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {/* Enabled Switch */}
          <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
            <div>
              <span className="font-semibold text-slate-200">Enable Account</span>
              <p className="text-[11px] text-slate-400">
                Allow the distribution agent to broadcast snippets to this account.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                enabled ? 'bg-cyan-500' : 'bg-slate-800'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 font-medium rounded-xl flex items-center justify-center gap-2 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Activity className={`w-3.5 h-3.5 text-cyan-400 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? `Pinging ${platform}...` : 'Test Connection'}</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-400 hover:to-cyan-500 text-white font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Integration</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
