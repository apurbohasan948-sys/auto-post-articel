import React, { useState, useEffect } from 'react';
import {
  X,
  Globe,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Activity,
  Save,
} from 'lucide-react';
import { BloggerIntegration } from '../../types/integrations.ts';
import { bloggerAdapter } from '../../services/adapters/BloggerAdapter.ts';
import { integrationStore } from '../../services/integrationStore.ts';

interface BloggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (blogger: BloggerIntegration) => void;
  editingBlogger?: BloggerIntegration | null;
}

const MASK_PLACEHOLDER = '••••••••••••••••';

export const BloggerModal: React.FC<BloggerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingBlogger,
}) => {
  const [name, setName] = useState('');
  const [blogId, setBlogId] = useState('');
  const [blogUrl, setBlogUrl] = useState('');
  const [defaultStatus, setDefaultStatus] = useState<'DRAFT' | 'LIVE'>('DRAFT');
  const [defaultLabel, setDefaultLabel] = useState('Technology, AI Systems');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [enabled, setEnabled] = useState(true);

  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showRefresh, setShowRefresh] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status: 'CONNECTED' | 'FAILED';
    latencyMs: number;
    message?: string;
    error?: string;
  } | null>(null);

  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (editingBlogger) {
      setName(editingBlogger.name || '');
      setBlogId(editingBlogger.blogId || '');
      setBlogUrl(editingBlogger.blogUrl || '');
      setDefaultStatus(editingBlogger.defaultStatus || 'DRAFT');
      setDefaultLabel(editingBlogger.defaultLabel || '');
      setClientId(editingBlogger.clientId || '');
      setClientSecret(editingBlogger.clientSecret ? MASK_PLACEHOLDER : '');
      setAccessToken(editingBlogger.accessToken ? MASK_PLACEHOLDER : '');
      setRefreshToken(editingBlogger.refreshToken ? MASK_PLACEHOLDER : '');
      setEnabled(editingBlogger.enabled ?? true);
      if (editingBlogger.lastTestStatus && editingBlogger.lastTestStatus !== 'NOT_CONFIGURED') {
        setTestResult({
          success: editingBlogger.lastTestStatus === 'CONNECTED',
          status: editingBlogger.lastTestStatus,
          latencyMs: editingBlogger.lastLatencyMs || 0,
          message: editingBlogger.lastTestStatus === 'CONNECTED' ? 'Previously connected' : undefined,
          error: editingBlogger.lastError,
        });
      } else {
        setTestResult(null);
      }
    } else {
      setName('');
      setBlogId('');
      setBlogUrl('');
      setDefaultStatus('DRAFT');
      setDefaultLabel('Technology, AI Systems');
      setClientId('');
      setClientSecret('');
      setAccessToken('');
      setRefreshToken('');
      setEnabled(true);
      setTestResult(null);
    }
    setFormError(null);
    setShowSecret(false);
    setShowToken(false);
    setShowRefresh(false);
  }, [editingBlogger, isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!blogId.trim()) {
      setFormError('Blog ID is required to run a connection test.');
      return;
    }
    setFormError(null);
    setIsTesting(true);

    const tempIntegration: BloggerIntegration = {
      id: editingBlogger?.id || 'temp',
      name: name.trim() || 'Testing Blog',
      enabled,
      blogId: blogId.trim(),
      blogUrl: blogUrl.trim(),
      defaultStatus,
      defaultLabel: defaultLabel.trim(),
      clientId: clientId.trim(),
      clientSecret: clientSecret.includes('••••') ? editingBlogger?.clientSecret : clientSecret.trim(),
      accessToken: accessToken.includes('••••') ? editingBlogger?.accessToken : accessToken.trim(),
      refreshToken: refreshToken.includes('••••') ? editingBlogger?.refreshToken : refreshToken.trim(),
    };

    const res = await bloggerAdapter.testConnection(tempIntegration);
    setIsTesting(false);
    setTestResult(res);

    if (editingBlogger?.id) {
      integrationStore.recordBloggerTestResult(editingBlogger.id, res);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Account / Blog Display Name is required.');
      return;
    }
    if (!blogId.trim()) {
      setFormError('Blogger Blog ID is required.');
      return;
    }

    const payload: BloggerIntegration = {
      id: editingBlogger?.id || `blogger_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      blogId: blogId.trim(),
      blogUrl: blogUrl.trim(),
      defaultStatus,
      defaultLabel: defaultLabel.trim(),
      clientId: clientId.trim(),
      clientSecret: clientSecret.includes('••••') ? editingBlogger?.clientSecret : clientSecret.trim(),
      accessToken: accessToken.includes('••••') ? editingBlogger?.accessToken : accessToken.trim(),
      refreshToken: refreshToken.includes('••••') ? editingBlogger?.refreshToken : refreshToken.trim(),
      enabled,
      lastTestedAt: testResult ? new Date().toISOString() : editingBlogger?.lastTestedAt,
      lastTestStatus: testResult ? testResult.status : editingBlogger?.lastTestStatus || 'NOT_CONFIGURED',
      lastLatencyMs: testResult ? testResult.latencyMs : editingBlogger?.lastLatencyMs,
      lastError: testResult?.status === 'FAILED' ? (testResult.error || testResult.message) : undefined,
    };

    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col my-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
              <Globe className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-display">
                {editingBlogger ? 'Edit Blogger Configuration' : 'Add Blogger Account'}
              </h3>
              <p className="text-xs text-slate-400">Google Blogger API v3 Integration</p>
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
                      : 'Connection Failed'}
                  </span>
                  <span className="font-mono text-[11px] opacity-80">
                    {testResult.latencyMs}ms
                  </span>
                </div>
                <p className="text-[11px] mt-0.5 opacity-90 break-words">
                  {testResult.status === 'CONNECTED'
                    ? testResult.message
                    : testResult.error || 'Check blog ID or credentials'}
                </p>
              </div>
            </div>
          )}

          {/* Core Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Account / Blog Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. AI Architecture Digest"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Blogger Blog ID <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={blogId}
                onChange={(e) => setBlogId(e.target.value)}
                placeholder="e.g. 7842918491823910294"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Blog URL (Optional)
            </label>
            <input
              type="url"
              value={blogUrl}
              onChange={(e) => setBlogUrl(e.target.value)}
              placeholder="https://yourblog.blogspot.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Default Publishing Status
              </label>
              <select
                value={defaultStatus}
                onChange={(e) => setDefaultStatus(e.target.value as 'DRAFT' | 'LIVE')}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="DRAFT">DRAFT (Safe Review Queue)</option>
                <option value="LIVE">LIVE (Immediate Auto-Publish)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Default Labels / Categories
              </label>
              <input
                type="text"
                value={defaultLabel}
                onChange={(e) => setDefaultLabel(e.target.value)}
                placeholder="Technology, AI Systems"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Credentials Accordion / Panel */}
          <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                OAuth 2.0 Credentials (Encrypted & Masked)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Stored in localStorage</span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Client ID</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxx.apps.googleusercontent.com"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white placeholder-slate-600 font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-400">Client Secret</label>
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-slate-500 hover:text-slate-300 flex items-center gap-1 text-[11px]"
                >
                  {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showSecret ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              <input
                type={showSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="GOCSPX-..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white placeholder-slate-600 font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400">Access Token (Bearer)</label>
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="text-slate-500 hover:text-slate-300 flex items-center gap-1 text-[11px]"
                  >
                    {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
                <input
                  type={showToken ? 'text' : 'password'}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="ya29.a0A..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white placeholder-slate-600 font-mono text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400">Refresh Token</label>
                  <button
                    type="button"
                    onClick={() => setShowRefresh(!showRefresh)}
                    className="text-slate-500 hover:text-slate-300 flex items-center gap-1 text-[11px]"
                  >
                    {showRefresh ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
                <input
                  type={showRefresh ? 'text' : 'password'}
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  placeholder="1//04..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white placeholder-slate-600 font-mono text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              Note: Unchanged masked values (<code className="font-mono text-slate-400">••••</code>) are automatically preserved when saving.
            </p>
          </div>

          {/* Enabled Switch */}
          <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
            <div>
              <span className="font-semibold text-slate-200">Enable Account</span>
              <p className="text-[11px] text-slate-400">
                Allow the autonomous publisher agent to route articles to this blog.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
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
              disabled={isTesting || !blogId.trim()}
              className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 font-medium rounded-xl flex items-center justify-center gap-2 border border-slate-700 transition-colors disabled:opacity-50"
            >
              <Activity className={`w-3.5 h-3.5 text-cyan-400 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Pinging Blogger API...' : 'Test Connection'}</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-400 hover:text-white rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
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
