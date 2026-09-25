import React, { useState } from 'react';
import { Globe, Key, AlertTriangle } from 'lucide-react';
import { BloggerIntegration } from '../../types/integrations.ts';
import { integrationStore, MASKED_SECRET_PLACEHOLDER } from '../../services/integrationStore.ts';

interface BloggerModalProps {
  existing: BloggerIntegration | null;
  onClose: () => void;
  onSave: (saved: BloggerIntegration) => void;
}

export const BloggerModal: React.FC<BloggerModalProps> = ({ existing, onClose, onSave }) => {
  const isEditing = Boolean(existing);
  const [name, setName] = useState(existing?.name || '');
  const [blogId, setBlogId] = useState(existing?.blogId || '');
  const [publicBlogUrl, setPublicBlogUrl] = useState(existing?.publicBlogUrl || existing?.blogUrl || '');
  const [defaultLabels, setDefaultLabels] = useState(existing?.defaultLabels?.join(', ') || existing?.defaultLabel || '');
  const [defaultStatus, setDefaultStatus] = useState<'DRAFT' | 'LIVE'>(
    existing?.defaultStatus === 'LIVE' ? 'LIVE' : 'DRAFT'
  );
  const [priority, setPriority] = useState(existing?.priority || 1);

  // Masked secret handling: separate input from stored
  const [accessTokenInput, setAccessTokenInput] = useState(
    existing?.accessToken ? MASKED_SECRET_PLACEHOLDER : ''
  );
  const [clientId, setClientId] = useState(existing?.clientId || '');
  const [clientSecretInput, setClientSecretInput] = useState(
    existing?.clientSecret ? MASKED_SECRET_PLACEHOLDER : ''
  );
  const [validationError, setValidationError] = useState<string | null>(null);

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
        };

        // Only update secret if user typed a new value (not the placeholder)
        if (accessTokenInput && accessTokenInput !== MASKED_SECRET_PLACEHOLDER) {
          updates.accessToken = accessTokenInput.trim();
        }
        if (clientSecretInput && clientSecretInput !== MASKED_SECRET_PLACEHOLDER) {
          updates.clientSecret = clientSecretInput.trim();
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
          clientSecret: clientSecretInput === MASKED_SECRET_PLACEHOLDER ? '' : clientSecretInput.trim(),
          accessToken: accessTokenInput === MASKED_SECRET_PLACEHOLDER ? '' : accessTokenInput.trim(),
          enabled: true,
          connected: false,
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

        {validationError && (
          <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <div className="space-y-4 text-sm">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Blogger Blog ID *
              </label>
              <input
                type="text"
                value={blogId}
                onChange={(e) => setBlogId(e.target.value)}
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

          {/* Credentials section */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>Google Blogger OAuth Credentials</span>
              </span>
              <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                Scope: blogger
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Access Token (Bearer)
              </label>
              <input
                type="password"
                value={accessTokenInput}
                onFocus={() => {
                  if (accessTokenInput === MASKED_SECRET_PLACEHOLDER) setAccessTokenInput('');
                }}
                onChange={(e) => setAccessTokenInput(e.target.value)}
                placeholder="Enter Google OAuth Access Token"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-xs"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                OAuth token with <code className="text-indigo-300">https://www.googleapis.com/auth/blogger</code> permission.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
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
                    if (clientSecretInput === MASKED_SECRET_PLACEHOLDER) setClientSecretInput('');
                  }}
                  onChange={(e) => setClientSecretInput(e.target.value)}
                  placeholder="Client secret"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-white placeholder-slate-600 text-xs font-mono"
                />
              </div>
            </div>
          </div>

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
