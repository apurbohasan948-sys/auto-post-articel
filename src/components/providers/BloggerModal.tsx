import React, { useState } from 'react';
import { X, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, Save } from 'lucide-react';
import { BloggerIntegration } from '../../types/agent';
import { integrationStore } from '../../services/integrationStore';
import { isMasked, MASKED_SECRET } from '../../services/providerStore';
import { BloggerAdapter } from '../../adapters/BloggerAdapter';

interface BloggerModalProps {
  integration?: BloggerIntegration | null;
  onClose: () => void;
  onSaved: () => void;
}

export const BloggerModal: React.FC<BloggerModalProps> = ({
  integration,
  onClose,
  onSaved
}) => {
  const isEditing = Boolean(integration);

  const [name, setName] = useState(integration?.name || '');
  const [enabled, setEnabled] = useState(integration?.enabled ?? true);
  const [blogId, setBlogId] = useState(integration?.blogId || '');
  const [clientId, setClientId] = useState(integration?.clientId || '');
  
  // Sensitive secrets initialized as masked if editing and existing value present
  const [clientSecret, setClientSecret] = useState(
    integration?.clientSecret ? MASKED_SECRET : ''
  );
  const [accessToken, setAccessToken] = useState(
    integration?.accessToken ? MASKED_SECRET : ''
  );
  const [refreshToken, setRefreshToken] = useState(
    integration?.refreshToken ? MASKED_SECRET : ''
  );

  const [defaultStatus, setDefaultStatus] = useState<'DRAFT' | 'LIVE'>(
    integration?.defaultStatus || 'DRAFT'
  );
  const [defaultLabel, setDefaultLabel] = useState(integration?.defaultLabel || '');

  // Secret visibility states
  const [showSecret, setShowSecret] = useState(false);
  const [showAccess, setShowAccess] = useState(false);
  const [showRefresh, setShowRefresh] = useState(false);

  // Testing & Error states
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

    // Resolve unmasked secrets for test if user entered new ones, or fallback to existing
    const cleanSecret = isMasked(clientSecret) ? (integration?.clientSecret || '') : clientSecret;
    const cleanAccess = isMasked(accessToken) ? (integration?.accessToken || '') : accessToken;
    const cleanRefresh = isMasked(refreshToken) ? (integration?.refreshToken || '') : refreshToken;

    const probeItem: BloggerIntegration = {
      id: integration?.id || 'temp',
      name: name || 'Test Blog',
      enabled,
      blogId: blogId.trim(),
      clientId: clientId.trim(),
      clientSecret: cleanSecret,
      accessToken: cleanAccess,
      refreshToken: cleanRefresh,
      defaultStatus,
      defaultLabel
    };

    try {
      const res = await BloggerAdapter.testConnection(probeItem);
      setTestResult(res);

      if (integration?.id) {
        integrationStore.updateBloggerTestResult(
          integration.id,
          res.success ? 'CONNECTED' : 'FAILED',
          res.diagnostics,
          res.success ? undefined : res.message
        );
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Connection test encountered an unexpected exception',
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
      setErrorMsg('Please provide a descriptive account name.');
      return;
    }
    if (!blogId.trim()) {
      setErrorMsg('Blog ID is required.');
      return;
    }

    try {
      if (isEditing && integration) {
        integrationStore.updateBlogger(integration.id, {
          name: name.trim(),
          enabled,
          blogId: blogId.trim(),
          clientId: clientId.trim(),
          clientSecret,
          accessToken,
          refreshToken,
          defaultStatus,
          defaultLabel: defaultLabel.trim()
        });
      } else {
        integrationStore.addBlogger({
          name: name.trim(),
          enabled,
          blogId: blogId.trim(),
          clientId: clientId.trim(),
          clientSecret: isMasked(clientSecret) ? '' : clientSecret,
          accessToken: isMasked(accessToken) ? '' : accessToken,
          refreshToken: isMasked(refreshToken) ? '' : refreshToken,
          defaultStatus,
          defaultLabel: defaultLabel.trim()
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save Blogger integration.');
    }
  };

  return (
    <div id="blogger-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div id="blogger-modal" className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">
              {isEditing ? 'Edit Blogger Account' : 'Add Blogger Account'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure credentials for Google Blogger API v3 auto-publishing
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

          {/* Account Name & Enable Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Account / Blog Name *
              </label>
              <input
                id="blogger-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tech Insights Daily"
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
                id="blogger-enabled-toggle"
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

          {/* Blog ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Blog ID *
            </label>
            <input
              id="blogger-blogid-input"
              type="text"
              value={blogId}
              onChange={(e) => setBlogId(e.target.value)}
              placeholder="e.g. 1827491029384756102"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">
              The numeric ID found in your Blogger dashboard URL after /blog/posts/.
            </p>
          </div>

          {/* Client ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Client ID (Optional)
            </label>
            <input
              id="blogger-clientid-input"
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          {/* Client Secret */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Client Secret (Optional)
            </label>
            <div className="relative">
              <input
                id="blogger-secret-input"
                type={showSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Google OAuth Client Secret"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* OAuth Access Token */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              OAuth Access Token *
            </label>
            <div className="relative">
              <input
                id="blogger-token-input"
                type={showAccess ? 'text' : 'password'}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="ya29.a0AfH6SM..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowAccess(!showAccess)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
              >
                {showAccess ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Bearer token with Google Blogger scope (https://www.googleapis.com/auth/blogger).
            </p>
          </div>

          {/* Refresh Token */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Refresh Token (Optional)
            </label>
            <div className="relative">
              <input
                id="blogger-refresh-input"
                type={showRefresh ? 'text' : 'password'}
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                placeholder="1//04..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowRefresh(!showRefresh)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
              >
                {showRefresh ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Default Post Status & Label */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Default Post Status
              </label>
              <select
                id="blogger-default-status-select"
                value={defaultStatus}
                onChange={(e) => setDefaultStatus(e.target.value as 'DRAFT' | 'LIVE')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="DRAFT">DRAFT (Recommended for review)</option>
                <option value="LIVE">LIVE (Directly public)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Default Label / Tag
              </label>
              <input
                id="blogger-label-input"
                type="text"
                value={defaultLabel}
                onChange={(e) => setDefaultLabel(e.target.value)}
                placeholder="e.g. Technology"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Test Connection Results Card */}
          {testResult && (
            <div
              id="blogger-test-result-box"
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
              id="blogger-test-conn-btn"
              onClick={handleTestConnection}
              disabled={testing || !blogId || !accessToken}
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
                id="blogger-save-btn"
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
