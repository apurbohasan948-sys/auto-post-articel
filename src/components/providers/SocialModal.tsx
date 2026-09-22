import React, { useState } from 'react';
import { X, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, Save } from 'lucide-react';
import { SocialIntegration, SocialPlatform } from '../../types/agent';
import { integrationStore } from '../../services/integrationStore';
import { isMasked, MASKED_SECRET } from '../../services/providerStore';
import { PlatformAdapterManager } from '../../adapters';

interface SocialModalProps {
  integration?: SocialIntegration | null;
  defaultPlatform?: SocialPlatform;
  onClose: () => void;
  onSaved: () => void;
}

export const SocialModal: React.FC<SocialModalProps> = ({
  integration,
  defaultPlatform = 'facebook',
  onClose,
  onSaved
}) => {
  const isEditing = Boolean(integration);

  const [platform, setPlatform] = useState<SocialPlatform>(
    integration?.platform || defaultPlatform
  );
  const [name, setName] = useState(integration?.name || '');
  const [enabled, setEnabled] = useState(integration?.enabled ?? true);

  // Platform specific credentials
  const [credentials, setCredentials] = useState<Record<string, string>>(() => {
    if (!integration?.credentials) return {};
    const maskedObj: Record<string, string> = {};
    for (const [k, v] of Object.entries(integration.credentials)) {
      // Mask token and secret fields
      if (k.toLowerCase().includes('token') || k.toLowerCase().includes('key') || k.toLowerCase().includes('secret')) {
        maskedObj[k] = v ? MASKED_SECRET : '';
      } else {
        maskedObj[k] = v;
      }
    }
    return maskedObj;
  });

  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const toggleShowSecret = (field: string) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleCredChange = (key: string, val: string) => {
    setCredentials(prev => ({ ...prev, [key]: val }));
  };

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    diagnostics?: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setErrorMsg(null);

    // Unmask existing credentials for test
    const cleanCredentials: Record<string, string> = {};
    for (const [k, v] of Object.entries(credentials)) {
      if (isMasked(v) && integration?.credentials[k]) {
        cleanCredentials[k] = integration.credentials[k];
      } else {
        cleanCredentials[k] = v;
      }
    }

    const probeItem: SocialIntegration = {
      id: integration?.id || 'temp',
      platform,
      name: name || 'Test Social',
      enabled,
      credentials: cleanCredentials
    };

    try {
      const res = await PlatformAdapterManager.testSocial(probeItem);
      setTestResult(res);

      if (integration?.id) {
        integrationStore.updateSocialTestResult(
          integration.id,
          res.success ? 'CONNECTED' : 'FAILED',
          res.diagnostics,
          res.success ? undefined : res.message
        );
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Connection test failed with an exception',
        diagnostics: err?.message
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Please provide an account or page name.');
      return;
    }

    try {
      if (isEditing && integration) {
        integrationStore.updateSocial(integration.id, {
          name: name.trim(),
          enabled,
          credentials
        });
      } else {
        // Clean masked placeholders for new creation
        const finalCreds: Record<string, string> = {};
        for (const [k, v] of Object.entries(credentials)) {
          finalCreds[k] = isMasked(v) ? '' : v.trim();
        }

        integrationStore.addSocial({
          platform,
          name: name.trim(),
          enabled,
          credentials: finalCreds
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save social integration.');
    }
  };

  const renderPlatformFields = () => {
    switch (platform) {
      case 'facebook':
        return (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Facebook Page ID *
              </label>
              <input
                id="social-fb-pageid"
                type="text"
                value={credentials['pageId'] || ''}
                onChange={(e) => handleCredChange('pageId', e.target.value)}
                placeholder="e.g. 102938475619283"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">Numeric Page ID from Facebook Page About / Settings.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Page Access Token *
              </label>
              <div className="relative">
                <input
                  id="social-fb-token"
                  type={showSecrets['accessToken'] ? 'text' : 'password'}
                  value={credentials['accessToken'] || ''}
                  onChange={(e) => handleCredChange('accessToken', e.target.value)}
                  placeholder="EAAG..."
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => toggleShowSecret('accessToken')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showSecrets['accessToken'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Permanent or extended Page Access Token with pages_manage_posts.</p>
            </div>
          </>
        );

      case 'instagram':
        return (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Instagram Business Account ID *
              </label>
              <input
                id="social-ig-accountid"
                type="text"
                value={credentials['accountId'] || ''}
                onChange={(e) => handleCredChange('accountId', e.target.value)}
                placeholder="e.g. 17841400000000000"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">Instagram Business / Professional Account ID connected to Meta.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Instagram Access Token *
              </label>
              <div className="relative">
                <input
                  id="social-ig-token"
                  type={showSecrets['accessToken'] ? 'text' : 'password'}
                  value={credentials['accessToken'] || ''}
                  onChange={(e) => handleCredChange('accessToken', e.target.value)}
                  placeholder="EAAG..."
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => toggleShowSecret('accessToken')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showSecrets['accessToken'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </>
        );

      case 'youtube':
        return (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                YouTube Channel ID *
              </label>
              <input
                id="social-yt-channelid"
                type="text"
                value={credentials['channelId'] || ''}
                onChange={(e) => handleCredChange('channelId', e.target.value)}
                placeholder="UC..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">24-character Channel ID starting with UC.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                YouTube API Key (For Channel Data / Read)
              </label>
              <div className="relative">
                <input
                  id="social-yt-apikey"
                  type={showSecrets['apiKey'] ? 'text' : 'password'}
                  value={credentials['apiKey'] || ''}
                  onChange={(e) => handleCredChange('apiKey', e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => toggleShowSecret('apiKey')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showSecrets['apiKey'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                OAuth Access Token (Required for Video Upload)
              </label>
              <div className="relative">
                <input
                  id="social-yt-token"
                  type={showSecrets['accessToken'] ? 'text' : 'password'}
                  value={credentials['accessToken'] || ''}
                  onChange={(e) => handleCredChange('accessToken', e.target.value)}
                  placeholder="ya29.a0..."
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => toggleShowSecret('accessToken')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showSecrets['accessToken'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </>
        );

      case 'tiktok':
        return (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                TikTok Open ID *
              </label>
              <input
                id="social-tt-openid"
                type="text"
                value={credentials['openId'] || ''}
                onChange={(e) => handleCredChange('openId', e.target.value)}
                placeholder="e.g. _000abc123..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                TikTok Access Token *
              </label>
              <div className="relative">
                <input
                  id="social-tt-token"
                  type={showSecrets['accessToken'] ? 'text' : 'password'}
                  value={credentials['accessToken'] || ''}
                  onChange={(e) => handleCredChange('accessToken', e.target.value)}
                  placeholder="act.example_token..."
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => toggleShowSecret('accessToken')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showSecrets['accessToken'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">OAuth 2.0 user token with video.publish scope.</p>
            </div>
          </>
        );
    }
  };

  return (
    <div id="social-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div id="social-modal" className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">
              {isEditing ? `Edit ${platform.toUpperCase()} Account` : 'Add Social Media Channel'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure credentials for direct platform API syndication
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Platform Selector (only changeable on Add) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Select Social Platform
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['facebook', 'instagram', 'youtube', 'tiktok'] as SocialPlatform[]).map((p) => (
                <button
                  type="button"
                  key={p}
                  disabled={isEditing}
                  onClick={() => setPlatform(p)}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold capitalize transition-all cursor-pointer ${
                    platform === p
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                  } ${isEditing ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {p === 'facebook' ? 'Facebook Page' : p}
                </button>
              ))}
            </div>
          </div>

          {/* Name & Enable Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Account / Display Name *
              </label>
              <input
                id="social-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Official Tech Channel"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Status
              </label>
              <button
                type="button"
                id="social-enabled-toggle"
                onClick={() => setEnabled(!enabled)}
                className={`w-full py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  enabled
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <span>{enabled ? 'Enabled' : 'Disabled'}</span>
              </button>
            </div>
          </div>

          {/* Platform Specific Credential Fields */}
          <div className="pt-2 border-t border-slate-800 space-y-4">
            {renderPlatformFields()}
          </div>

          {/* Test Connection Results */}
          {testResult && (
            <div
              id="social-test-result-box"
              className={`p-3.5 rounded-xl border text-xs ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                )}
                <span>{testResult.message}</span>
              </div>
              {testResult.diagnostics && (
                <p className="mt-1.5 text-[11px] opacity-80 font-mono">
                  {testResult.diagnostics}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              id="social-test-conn-btn"
              onClick={handleTestConnection}
              disabled={testing}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="social-save-btn"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Configuration</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
