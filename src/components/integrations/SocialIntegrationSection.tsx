import React, { useState, useEffect } from 'react';
import {
  Share2,
  Plus,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Edit2,
  Facebook,
  Instagram,
  Youtube,
  Video,
} from 'lucide-react';
import { SocialIntegration, SocialPlatform } from '../../types/integrations.ts';
import { integrationStore } from '../../services/integrationStore.ts';
import {
  facebookAdapter,
  instagramAdapter,
  youtubeAdapter,
  tikTokAdapter,
} from '../../services/adapters/index.ts';
import { SocialModal } from './SocialModal.tsx';

export const SocialIntegrationSection: React.FC = () => {
  const [integrations, setIntegrations] = useState<SocialIntegration[]>(() =>
    integrationStore.loadSocial()
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SocialIntegration | null>(null);
  const [defaultPlatform, setDefaultPlatform] = useState<SocialPlatform>('facebook');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setIntegrations(integrationStore.loadSocial());

    const unsubscribe = integrationStore.subscribeSocial((updated) => {
      setIntegrations(updated);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenAdd = (p: SocialPlatform = 'facebook') => {
    setDefaultPlatform(p);
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: SocialIntegration) => {
    setEditingItem(item);
    setDefaultPlatform(item.platform);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete social integration "${name}"?`)) {
      integrationStore.removeSocial(id);
      showToast(`Social integration "${name}" removed.`);
    }
  };

  const handleToggleEnabled = (id: string) => {
    integrationStore.toggleSocialEnabled(id);
  };

  const handleTestInline = async (item: SocialIntegration) => {
    setTestingId(item.id);
    let result;
    if (item.platform === 'facebook') {
      result = await facebookAdapter.testConnection(item);
    } else if (item.platform === 'instagram') {
      result = await instagramAdapter.testConnection(item);
    } else if (item.platform === 'youtube') {
      result = await youtubeAdapter.testConnection(item);
    } else {
      result = await tikTokAdapter.testConnection(item);
    }

    setTestingId(null);
    integrationStore.recordSocialTestResult(item.id, result);

    if (result.success) {
      showToast(`Connection verified (${result.latencyMs}ms): Connected to ${item.platform}`);
    } else {
      showToast(`Connection failed (${result.latencyMs}ms): ${result.error || 'Unknown error'}`);
    }
  };

  const handleSave = (saved: SocialIntegration) => {
    if (editingItem) {
      integrationStore.updateSocial(saved.id, saved);
      showToast(`Social integration "${saved.name}" updated successfully.`);
    } else {
      integrationStore.addSocial(saved);
      showToast(`Social integration "${saved.name}" added successfully.`);
    }
  };

  const filteredItems = filterPlatform === 'all'
    ? integrations
    : integrations.filter((item) => item.platform === filterPlatform);

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

  const getPlatformLabel = (p: SocialPlatform) => {
    switch (p) {
      case 'facebook':
        return 'Facebook Page';
      case 'instagram':
        return 'Instagram';
      case 'youtube':
        return 'YouTube';
      case 'tiktok':
        return 'TikTok';
    }
  };

  const getIdentifierText = (item: SocialIntegration) => {
    const creds = item.credentials || {};
    if (item.platform === 'facebook') {
      return creds.pageId ? `Page ID: ${creds.pageId}` : 'No Page ID';
    }
    if (item.platform === 'instagram') {
      return creds.instagramAccountId ? `Account ID: ${creds.instagramAccountId}` : 'No Account ID';
    }
    if (item.platform === 'youtube') {
      return creds.channelId ? `Channel ID: ${creds.channelId}` : 'OAuth Token';
    }
    if (item.platform === 'tiktok') {
      return creds.openId ? `Open ID: ${creds.openId}` : 'Access Token';
    }
    return '';
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-300 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="cyber-panel p-5 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-display">
                Social Media Integrations
              </h3>
              <p className="text-xs text-slate-400">
                Connect Facebook, Instagram, YouTube, and TikTok channels for multi-network amplification.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenAdd('facebook')}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-xl flex items-center gap-2 text-xs shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Social Account</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setFilterPlatform('all')}
          className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
            filterPlatform === 'all'
              ? 'bg-slate-800 text-white border-slate-700 font-semibold'
              : 'bg-slate-950/60 text-slate-400 border-slate-850 hover:text-slate-200'
          }`}
        >
          All Networks ({integrations.length})
        </button>
        {(['facebook', 'instagram', 'youtube', 'tiktok'] as SocialPlatform[]).map((p) => {
          const count = integrations.filter((i) => i.platform === p).length;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setFilterPlatform(p)}
              className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                filterPlatform === p
                  ? 'bg-slate-800 text-white border-slate-700 font-semibold'
                  : 'bg-slate-950/60 text-slate-400 border-slate-850 hover:text-slate-200'
              }`}
            >
              {getPlatformIcon(p)}
              <span>{getPlatformLabel(p)}</span>
              <span className="text-[10px] opacity-70 font-mono">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Integrations List */}
      {filteredItems.length === 0 ? (
        <div className="p-8 border border-dashed border-slate-800 rounded-2xl text-center bg-slate-900/40">
          <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Share2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-white mb-1">
            {filterPlatform === 'all'
              ? 'No Social Media Integrations Configured'
              : `No ${getPlatformLabel(filterPlatform as SocialPlatform)} Accounts`}
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            Connect your brand channels to automatically distribute snippets, key takeaways, and links when articles are published.
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {(['facebook', 'instagram', 'youtube', 'tiktok'] as SocialPlatform[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleOpenAdd(p)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                {getPlatformIcon(p)}
                <span>Add {getPlatformLabel(p)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredItems.map((item) => {
            const isTesting = testingId === item.id;
            const isConnected = item.lastTestStatus === 'CONNECTED';
            const isFailed = item.lastTestStatus === 'FAILED';

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all ${
                  item.enabled
                    ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-950/60 border-slate-850 opacity-70'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Info */}
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                        {getPlatformIcon(item.platform)}
                        <span>{item.name}</span>
                      </div>

                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                        {getPlatformLabel(item.platform)}
                      </span>

                      {/* Enabled Status Badge */}
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          item.enabled
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {item.enabled ? 'Enabled' : 'Disabled'}
                      </span>

                      {/* Connection Test Badge */}
                      {isConnected && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Connected ({item.lastLatencyMs || 0}ms)</span>
                        </span>
                      )}
                      {isFailed && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Failed ({item.lastLatencyMs || 0}ms)</span>
                        </span>
                      )}
                      {!isConnected && !isFailed && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          Not Tested
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono flex-wrap">
                      <span>{getIdentifierText(item)}</span>
                    </div>

                    {isFailed && item.lastError && (
                      <p className="text-[11px] text-rose-400 font-mono bg-rose-500/5 p-1.5 rounded-lg border border-rose-500/20 max-w-xl">
                        Diagnostic: {item.lastError}
                      </p>
                    )}

                    {item.lastTestedAt && (
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Last verified: {new Date(item.lastTestedAt).toLocaleString()}</span>
                      </p>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTestInline(item)}
                      disabled={isTesting}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      title="Test live API connection"
                    >
                      <Activity className={`w-3.5 h-3.5 text-cyan-400 ${isTesting ? 'animate-spin' : ''}`} />
                      <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleEnabled(item.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        item.enabled
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                      }`}
                    >
                      {item.enabled ? 'Disable' : 'Enable'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                      title="Edit Configuration"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, item.name)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg border border-rose-500/30 transition-colors cursor-pointer"
                      title="Delete Integration"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <SocialModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        editingSocial={editingItem}
        defaultPlatform={defaultPlatform}
      />
    </div>
  );
};
