import React, { useState } from 'react';
import { Share2, AlertTriangle, Key } from 'lucide-react';
import { SocialIntegration, SocialPlatform } from '../../types/integrations.ts';
import { integrationStore, MASKED_SECRET_PLACEHOLDER } from '../../services/integrationStore.ts';

interface SocialModalProps {
  existing: SocialIntegration | null;
  onClose: () => void;
  onSave: (saved: SocialIntegration) => void;
}

export const SocialModal: React.FC<SocialModalProps> = ({ existing, onClose, onSave }) => {
  const isEditing = Boolean(existing);
  const [platform, setPlatform] = useState<SocialPlatform>(existing?.platform || 'telegram');
  const [name, setName] = useState(existing?.name || '');
  const [priority, setPriority] = useState(existing?.priority || 1);

  // Platform specific fields
  const [channelId, setChannelId] = useState(existing?.channelId || existing?.credentials?.chatId || '');
  const [pageId, setPageId] = useState(existing?.pageId || existing?.credentials?.pageId || '');
  const [accountId, setAccountId] = useState(existing?.accountId || existing?.credentials?.instagramAccountId || '');
  const [profileId, setProfileId] = useState(existing?.profileId || '');

  // Masked secret inputs
  const [accessTokenInput, setAccessTokenInput] = useState(
    existing?.accessToken || existing?.credentials?.accessToken ? MASKED_SECRET_PLACEHOLDER : ''
  );
  const [apiKeyInput, setApiKeyInput] = useState(
    existing?.apiKey || existing?.credentials?.botToken || existing?.credentials?.apiKey ? MASKED_SECRET_PLACEHOLDER : ''
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSave = () => {
    if (!name.trim()) {
      setValidationError('Account name is required.');
      return;
    }

    // Platform-specific validations
    if (platform === 'telegram') {
      if (!channelId.trim()) {
        setValidationError('Telegram Channel ID or Chat ID is required (e.g. @mychannel or -100xxx).');
        return;
      }
    } else if (platform === 'facebook') {
      if (!pageId.trim() && !accountId.trim()) {
        setValidationError('Facebook Page ID is required.');
        return;
      }
    }

    try {
      if (isEditing && existing) {
        const updates: Partial<SocialIntegration> = {
          platform,
          name: name.trim(),
          priority: Number(priority) || 1,
          channelId: channelId.trim(),
          pageId: pageId.trim(),
          accountId: accountId.trim(),
          profileId: profileId.trim(),
          credentials: {
            ...(existing.credentials || {}),
            channelId: channelId.trim(),
            pageId: pageId.trim(),
            accountId: accountId.trim(),
            chatId: channelId.trim(),
          },
        };

        if (accessTokenInput && accessTokenInput !== MASKED_SECRET_PLACEHOLDER) {
          updates.accessToken = accessTokenInput.trim();
          if (updates.credentials) updates.credentials.accessToken = accessTokenInput.trim();
        }
        if (apiKeyInput && apiKeyInput !== MASKED_SECRET_PLACEHOLDER) {
          updates.apiKey = apiKeyInput.trim();
          if (updates.credentials) {
            updates.credentials.apiKey = apiKeyInput.trim();
            updates.credentials.botToken = apiKeyInput.trim();
          }
        }

        const saved = integrationStore.updateSocial(existing.id, updates);
        if (saved) onSave(saved);
      } else {
        const credentialsObj: Record<string, string> = {
          channelId: channelId.trim(),
          pageId: pageId.trim(),
          accountId: accountId.trim(),
          chatId: channelId.trim(),
        };
        if (accessTokenInput && accessTokenInput !== MASKED_SECRET_PLACEHOLDER) {
          credentialsObj.accessToken = accessTokenInput.trim();
        }
        if (apiKeyInput && apiKeyInput !== MASKED_SECRET_PLACEHOLDER) {
          credentialsObj.apiKey = apiKeyInput.trim();
          credentialsObj.botToken = apiKeyInput.trim();
        }

        const saved = integrationStore.addSocial({
          platform,
          name: name.trim(),
          priority: Number(priority) || 1,
          channelId: channelId.trim(),
          pageId: pageId.trim(),
          accountId: accountId.trim(),
          profileId: profileId.trim(),
          accessToken: accessTokenInput === MASKED_SECRET_PLACEHOLDER ? '' : accessTokenInput.trim(),
          apiKey: apiKeyInput === MASKED_SECRET_PLACEHOLDER ? '' : apiKeyInput.trim(),
          credentials: credentialsObj,
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
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {isEditing ? 'Edit Social Integration' : 'Add Social Network Account'}
              </h3>
              <p className="text-xs text-slate-400">Configure multi-platform publication distribution</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Platform *
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
                disabled={isEditing}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="facebook">Facebook Pages</option>
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
                <option value="tiktok">TikTok</option>
                <option value="telegram">Telegram</option>
                <option value="linkedin">LinkedIn</option>
                <option value="twitter">X / Twitter</option>
                <option value="threads">Threads</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Account Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Official Tech Telegram"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Dynamic Platform Inputs */}
          {platform === 'telegram' && (
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-xs font-semibold text-slate-200 block">Telegram Bot Credentials</span>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Bot Token (from @BotFather) *
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onFocus={() => {
                    if (apiKeyInput === MASKED_SECRET_PLACEHOLDER) setApiKeyInput('');
                  }}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Channel Username or Chat ID *
                </label>
                <input
                  type="text"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder="@mychannel or -100123456789"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 text-xs font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Add bot as admin with "Post Messages" permission in target channel.
                </span>
              </div>
            </div>
          )}

          {platform === 'facebook' && (
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-xs font-semibold text-slate-200 block">Facebook Page Credentials</span>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Page ID *
                </label>
                <input
                  type="text"
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  placeholder="e.g. 102938475610293"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Page Access Token *
                </label>
                <input
                  type="password"
                  value={accessTokenInput}
                  onFocus={() => {
                    if (accessTokenInput === MASKED_SECRET_PLACEHOLDER) setAccessTokenInput('');
                  }}
                  onChange={(e) => setAccessTokenInput(e.target.value)}
                  placeholder="EAAG..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {platform === 'instagram' && (
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-xs font-semibold text-slate-200 block">Instagram Professional Account</span>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Instagram Account ID *
                </label>
                <input
                  type="text"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="e.g. 17841400..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Graph API Access Token *
                </label>
                <input
                  type="password"
                  value={accessTokenInput}
                  onFocus={() => {
                    if (accessTokenInput === MASKED_SECRET_PLACEHOLDER) setAccessTokenInput('');
                  }}
                  onChange={(e) => setAccessTokenInput(e.target.value)}
                  placeholder="EAAG..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {platform === 'twitter' && (
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-xs font-semibold text-slate-200 block">X / Twitter API v2 Credentials</span>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Bearer Token or User OAuth Token *
                </label>
                <input
                  type="password"
                  value={accessTokenInput}
                  onFocus={() => {
                    if (accessTokenInput === MASKED_SECRET_PLACEHOLDER) setAccessTokenInput('');
                  }}
                  onChange={(e) => setAccessTokenInput(e.target.value)}
                  placeholder="AAAAAAAAAAAAAAAAAAAAA..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {platform === 'linkedin' && (
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-xs font-semibold text-slate-200 block">LinkedIn Credentials</span>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  OAuth Access Token *
                </label>
                <input
                  type="password"
                  value={accessTokenInput}
                  onFocus={() => {
                    if (accessTokenInput === MASKED_SECRET_PLACEHOLDER) setAccessTokenInput('');
                  }}
                  onChange={(e) => setAccessTokenInput(e.target.value)}
                  placeholder="AQV..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Person or Organization URN (Optional)
                </label>
                <input
                  type="text"
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value)}
                  placeholder="urn:li:person:... or urn:li:organization:..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {platform === 'youtube' && (
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-xs font-semibold text-slate-200 block">YouTube Data API Credentials</span>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Channel ID (Optional if using OAuth)
                </label>
                <input
                  type="text"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder="UCxxxxxxxxxxxx"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  OAuth Access Token or Google API Key *
                </label>
                <input
                  type="password"
                  value={accessTokenInput}
                  onFocus={() => {
                    if (accessTokenInput === MASKED_SECRET_PLACEHOLDER) setAccessTokenInput('');
                  }}
                  onChange={(e) => setAccessTokenInput(e.target.value)}
                  placeholder="ya29... or AIzaSy..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {platform === 'tiktok' && (
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-xs font-semibold text-slate-200 block">TikTok Creator API Credentials</span>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Access Token *
                </label>
                <input
                  type="password"
                  value={accessTokenInput}
                  onFocus={() => {
                    if (accessTokenInput === MASKED_SECRET_PLACEHOLDER) setAccessTokenInput('');
                  }}
                  onChange={(e) => setAccessTokenInput(e.target.value)}
                  placeholder="act.xxxx..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {platform === 'threads' && (
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-xs font-semibold text-slate-200 block">Threads API Credentials</span>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Threads Access Token *
                </label>
                <input
                  type="password"
                  value={accessTokenInput}
                  onFocus={() => {
                    if (accessTokenInput === MASKED_SECRET_PLACEHOLDER) setAccessTokenInput('');
                  }}
                  onChange={(e) => setAccessTokenInput(e.target.value)}
                  placeholder="THQ..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 text-xs font-mono"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Priority Order
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
            Save Integration
          </button>
        </div>
      </div>
    </div>
  );
};
