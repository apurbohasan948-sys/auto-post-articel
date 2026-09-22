import React, { useEffect, useState } from 'react';
import { 
  Cpu, 
  Search, 
  Share2, 
  Globe, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Save, 
  Eye, 
  EyeOff, 
  Database, 
  Download, 
  ShieldCheck, 
  Lock 
} from 'lucide-react';
import { 
  AIProviderConfig, 
  BloggerIntegration, 
  SettingsSubTab, 
  SocialIntegration, 
  SocialPlatform, 
  TavilyConfig 
} from '../types/agent';
import { providerStore, isMasked, MASKED_SECRET } from '../services/providerStore';
import { integrationStore, BLOGGER_KEY, SOCIAL_KEY } from '../services/integrationStore';
import { PlatformAdapterManager } from '../adapters';
import { ProviderTestingService } from '../services/providerTestingService';
import { BloggerModal } from './providers/BloggerModal';
import { SocialModal } from './providers/SocialModal';
import { ProviderModal } from './providers/ProviderModal';

export const SettingsView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('blogger');

  // Stores data
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [tavilyConfig, setTavilyConfig] = useState<TavilyConfig>(providerStore.getTavilyConfig());
  const [bloggerList, setBloggerList] = useState<BloggerIntegration[]>([]);
  const [socialList, setSocialList] = useState<SocialIntegration[]>([]);

  // Tavily editing state
  const [tavilyApiKey, setTavilyApiKey] = useState(
    tavilyConfig.apiKey ? MASKED_SECRET : ''
  );
  const [showTavilyKey, setShowTavilyKey] = useState(false);
  const [tavilyTesting, setTavilyTesting] = useState(false);
  const [tavilyMessage, setTavilyMessage] = useState<string | null>(null);

  // Modals
  const [editingBlogger, setEditingBlogger] = useState<BloggerIntegration | null | undefined>(undefined);
  const [editingSocial, setEditingSocial] = useState<SocialIntegration | null | undefined>(undefined);
  const [editingProvider, setEditingProvider] = useState<AIProviderConfig | null | undefined>(undefined);
  const [defaultSocialPlatform, setDefaultSocialPlatform] = useState<SocialPlatform>('facebook');

  // Inline testing state
  const [testingItemId, setTestingItemId] = useState<string | null>(null);

  // Sync state from stores
  const refreshAllStores = () => {
    setProviders(providerStore.loadProviders());
    const tc = providerStore.getTavilyConfig();
    setTavilyConfig(tc);
    if (!tavilyApiKey || isMasked(tavilyApiKey)) {
      setTavilyApiKey(tc.apiKey ? MASKED_SECRET : '');
    }
    setBloggerList(integrationStore.loadBlogger());
    setSocialList(integrationStore.loadSocial());
  };

  useEffect(() => {
    refreshAllStores();

    // Subscribe to stores for multi-tab and same-tab sync
    const unsubProviders = providerStore.subscribe(() => {
      refreshAllStores();
    });
    const unsubIntegrations = integrationStore.subscribe(() => {
      refreshAllStores();
    });

    return () => {
      unsubProviders();
      unsubIntegrations();
    };
  }, []);

  // --- Blogger Actions ---
  const handleToggleBlogger = (id: string) => {
    integrationStore.toggleBloggerEnabled(id);
    refreshAllStores();
  };

  const handleDeleteBlogger = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove the Blogger account "${name}"?`)) {
      integrationStore.removeBlogger(id);
      refreshAllStores();
    }
  };

  const handleTestBlogger = async (item: BloggerIntegration) => {
    setTestingItemId(item.id);
    try {
      const res = await PlatformAdapterManager.testBlogger(item);
      integrationStore.updateBloggerTestResult(
        item.id,
        res.success ? 'CONNECTED' : 'FAILED',
        res.diagnostics,
        res.success ? undefined : res.message
      );
    } catch (e: any) {
      console.error(e);
    } finally {
      setTestingItemId(null);
      refreshAllStores();
    }
  };

  // --- Social Actions ---
  const handleToggleSocial = (id: string) => {
    integrationStore.toggleSocialEnabled(id);
    refreshAllStores();
  };

  const handleDeleteSocial = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove the Social integration "${name}"?`)) {
      integrationStore.removeSocial(id);
      refreshAllStores();
    }
  };

  const handleTestSocial = async (item: SocialIntegration) => {
    setTestingItemId(item.id);
    try {
      const res = await PlatformAdapterManager.testSocial(item);
      integrationStore.updateSocialTestResult(
        item.id,
        res.success ? 'CONNECTED' : 'FAILED',
        res.diagnostics,
        res.success ? undefined : res.message
      );
    } catch (e: any) {
      console.error(e);
    } finally {
      setTestingItemId(null);
      refreshAllStores();
    }
  };

  // --- AI Provider Actions ---
  const handleToggleProvider = (id: string) => {
    providerStore.toggleProvider(id);
    refreshAllStores();
  };

  const handleDeleteProvider = (id: string, name: string) => {
    if (window.confirm(`Delete AI provider "${name}"?`)) {
      providerStore.removeProvider(id);
      refreshAllStores();
    }
  };

  const handleTestProvider = async (p: AIProviderConfig) => {
    setTestingItemId(p.id);
    try {
      await ProviderTestingService.testProvider(p);
    } finally {
      setTestingItemId(null);
      refreshAllStores();
    }
  };

  // --- Tavily Actions ---
  const handleSaveTavily = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      providerStore.saveTavilyConfig({
        apiKey: tavilyApiKey,
        enabled: tavilyConfig.enabled,
        searchDepth: tavilyConfig.searchDepth,
        maxResults: tavilyConfig.maxResults
      });
      setTavilyMessage('Tavily configuration saved successfully.');
      setTimeout(() => setTavilyMessage(null), 3000);
      refreshAllStores();
    } catch (err: any) {
      setTavilyMessage(`Save failed: ${err?.message}`);
    }
  };

  const handleTestTavily = async () => {
    setTavilyTesting(true);
    setTavilyMessage(null);
    try {
      const current = providerStore.getTavilyConfig();
      const res = await ProviderTestingService.testTavily({
        ...current,
        apiKey: isMasked(tavilyApiKey) ? current.apiKey : tavilyApiKey
      });
      setTavilyMessage(res.message);
    } finally {
      setTavilyTesting(false);
      refreshAllStores();
    }
  };

  // Export Backup
  const handleExportBackup = () => {
    const backupData = {
      timestamp: Date.now(),
      version: '1.0',
      providers: providerStore.loadProviders(),
      tavily: providerStore.getTavilyConfig(),
      blogger: integrationStore.loadBlogger(),
      social: integrationStore.loadSocial()
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tara-integrations-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="settings-view" className="space-y-6 pb-12">
      {/* Settings Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-800 space-x-2 sm:space-x-4 overflow-x-auto pb-px">
        <button
          id="tab-blogger"
          onClick={() => setActiveSubTab('blogger')}
          className={`flex items-center gap-2 py-3 px-3.5 border-b-2 font-semibold text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer ${
            activeSubTab === 'blogger'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Blogger Integrations</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {bloggerList.length}
          </span>
        </button>

        <button
          id="tab-social"
          onClick={() => setActiveSubTab('social')}
          className={`flex items-center gap-2 py-3 px-3.5 border-b-2 font-semibold text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer ${
            activeSubTab === 'social'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>Social Media</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {socialList.length}
          </span>
        </button>

        <button
          id="tab-providers"
          onClick={() => setActiveSubTab('providers')}
          className={`flex items-center gap-2 py-3 px-3.5 border-b-2 font-semibold text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer ${
            activeSubTab === 'providers'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>AI Providers</span>
        </button>

        <button
          id="tab-search"
          onClick={() => setActiveSubTab('search')}
          className={`flex items-center gap-2 py-3 px-3.5 border-b-2 font-semibold text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer ${
            activeSubTab === 'search'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Web Search (Tavily)</span>
        </button>

        <button
          id="tab-backup"
          onClick={() => setActiveSubTab('backup')}
          className={`flex items-center gap-2 py-3 px-3.5 border-b-2 font-semibold text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer ${
            activeSubTab === 'backup'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Storage &amp; Backup</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 1. BLOGGER IN SETTINGS                                  */}
      {/* ======================================================== */}
      {activeSubTab === 'blogger' && (
        <div id="settings-blogger-section" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" />
                <span>Google Blogger Integrations</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Configure multiple Google Blogger accounts for direct auto-posting. All credentials are stored with masked protection in localStorage (<code>{BLOGGER_KEY}</code>) with verified read-back.
              </p>
            </div>
            <button
              id="add-blogger-btn"
              onClick={() => setEditingBlogger(null)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Blogger Account</span>
            </button>
          </div>

          {bloggerList.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
              <Globe className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white">No Blogger accounts configured</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Connect your first Google Blogger blog with Blog ID and OAuth access token to enable autonomous blog publishing.
              </p>
              <button
                onClick={() => setEditingBlogger(null)}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Add Account Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {bloggerList.map((blog) => (
                <div
                  key={blog.id}
                  id={`blogger-account-card-${blog.id}`}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-md">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-sm text-white">{blog.name}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleBlogger(blog.id)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
                          blog.enabled
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {blog.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                        {blog.defaultStatus}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-mono">
                      <span>Blog ID: <span className="text-slate-300">{blog.blogId}</span></span>
                      {blog.defaultLabel && (
                        <span>Label: <span className="text-slate-300">{blog.defaultLabel}</span></span>
                      )}
                    </div>

                    {/* Diagnostics or error */}
                    {blog.lastError && (
                      <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{blog.lastError}</span>
                      </p>
                    )}
                    {blog.diagnostics && blog.testStatus === 'CONNECTED' && (
                      <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{blog.diagnostics}</span>
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    {/* Status Badge */}
                    <div className="mr-2">
                      {blog.testStatus === 'CONNECTED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          CONNECTED
                        </span>
                      ) : blog.testStatus === 'FAILED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3.5 h-3.5" />
                          FAILED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          UNTESTED
                        </span>
                      )}
                    </div>

                    <button
                      id={`test-blogger-btn-${blog.id}`}
                      onClick={() => handleTestBlogger(blog)}
                      disabled={testingItemId === blog.id}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingItemId === blog.id ? 'animate-spin' : ''}`} />
                      <span>{testingItemId === blog.id ? 'Testing...' : 'Test Connection'}</span>
                    </button>

                    <button
                      id={`edit-blogger-btn-${blog.id}`}
                      onClick={() => setEditingBlogger(blog)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                      title="Edit Account"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      id={`delete-blogger-btn-${blog.id}`}
                      onClick={() => handleDeleteBlogger(blog.id, blog.name)}
                      className="p-1.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                      title="Delete Account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. SOCIAL MEDIA IN SETTINGS                             */}
      {/* ======================================================== */}
      {activeSubTab === 'social' && (
        <div id="settings-social-section" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Share2 className="w-5 h-5 text-blue-400" />
                <span>Social Media Integrations</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Connect Facebook Pages, Instagram Business, YouTube Channels, and TikTok accounts. Stored in <code>{SOCIAL_KEY}</code> with custom credential models per platform.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="add-social-btn"
                onClick={() => setEditingSocial(null)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Social Account</span>
              </button>
            </div>
          </div>

          {socialList.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
              <Share2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white">No Social channels configured</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Add Facebook Page, Instagram, YouTube, or TikTok accounts to syndicate articles automatically.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {(['facebook', 'instagram', 'youtube', 'tiktok'] as SocialPlatform[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setDefaultSocialPlatform(p);
                      setEditingSocial(null);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 capitalize transition-colors cursor-pointer"
                  >
                    + {p === 'facebook' ? 'Facebook Page' : p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {socialList.map((social) => (
                <div
                  key={social.id}
                  id={`social-account-card-${social.id}`}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-md">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-sm text-white">{social.name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {social.platform}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleSocial(social.id)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
                          social.enabled
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {social.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>

                    <div className="text-xs text-slate-400 font-mono">
                      {social.platform === 'facebook' && (
                        <span>Page ID: <span className="text-slate-300">{social.credentials['pageId'] || 'N/A'}</span></span>
                      )}
                      {social.platform === 'instagram' && (
                        <span>Account ID: <span className="text-slate-300">{social.credentials['accountId'] || 'N/A'}</span></span>
                      )}
                      {social.platform === 'youtube' && (
                        <span>Channel ID: <span className="text-slate-300">{social.credentials['channelId'] || 'N/A'}</span></span>
                      )}
                      {social.platform === 'tiktok' && (
                        <span>Open ID: <span className="text-slate-300">{social.credentials['openId'] || 'N/A'}</span></span>
                      )}
                    </div>

                    {social.lastError && (
                      <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{social.lastError}</span>
                      </p>
                    )}
                    {social.diagnostics && social.testStatus === 'CONNECTED' && (
                      <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{social.diagnostics}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <div className="mr-2">
                      {social.testStatus === 'CONNECTED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          CONNECTED
                        </span>
                      ) : social.testStatus === 'FAILED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3.5 h-3.5" />
                          FAILED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          UNTESTED
                        </span>
                      )}
                    </div>

                    <button
                      id={`test-social-btn-${social.id}`}
                      onClick={() => handleTestSocial(social)}
                      disabled={testingItemId === social.id}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingItemId === social.id ? 'animate-spin' : ''}`} />
                      <span>{testingItemId === social.id ? 'Testing...' : 'Test Connection'}</span>
                    </button>

                    <button
                      id={`edit-social-btn-${social.id}`}
                      onClick={() => setEditingSocial(social)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                      title="Edit Account"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      id={`delete-social-btn-${social.id}`}
                      onClick={() => handleDeleteSocial(social.id, social.name)}
                      className="p-1.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                      title="Delete Account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. AI PROVIDERS IN SETTINGS                              */}
      {/* ======================================================== */}
      {activeSubTab === 'providers' && (
        <div id="settings-providers-section" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-400" />
                <span>AI Language Model Providers</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Configure LLM endpoints for Topic Scouting, Content Drafting, and Fact Checking. Stored in <code>tara_ai_api_providers</code> with masked secret protection.
              </p>
            </div>
            <button
              id="add-provider-btn"
              onClick={() => setEditingProvider(null)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Provider</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {providers.map((p) => (
              <div
                key={p.id}
                id={`provider-card-${p.id}`}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{p.name}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleProvider(p.id)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
                        p.enabled
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {p.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    Model: <span className="text-slate-300">{p.model}</span> | Key: {p.apiKey ? MASKED_SECRET : '<Not Configured>'}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <div className="mr-2">
                    {p.testStatus === 'CONNECTED' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        CONNECTED
                      </span>
                    ) : p.testStatus === 'FAILED' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <XCircle className="w-3.5 h-3.5" />
                        FAILED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                        UNTESTED
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleTestProvider(p)}
                    disabled={testingItemId === p.id}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingItemId === p.id ? 'animate-spin' : ''}`} />
                    <span>Test</span>
                  </button>

                  <button
                    onClick={() => setEditingProvider(p)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {!p.isDefault && (
                    <button
                      onClick={() => handleDeleteProvider(p.id, p.name)}
                      className="p-1.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. TAVILY WEB SEARCH IN SETTINGS                         */}
      {/* ======================================================== */}
      {activeSubTab === 'search' && (
        <div id="settings-search-section" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-400" />
                <span>Tavily AI Search Configuration</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Enables real-time web search grounding and research citations for ResearchAgent.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveTavily} className="space-y-4">
            {tavilyMessage && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300">
                {tavilyMessage}
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-slate-800/60 border border-slate-700 rounded-xl">
              <div>
                <span className="font-semibold text-sm text-white">Enable Tavily Grounding</span>
                <p className="text-xs text-slate-400">Use live web sources during article research</p>
              </div>
              <button
                type="button"
                id="tavily-enable-toggle"
                onClick={() => setTavilyConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                  tavilyConfig.enabled
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {tavilyConfig.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tavily API Key
              </label>
              <div className="relative">
                <input
                  id="tavily-api-key-input"
                  type={showTavilyKey ? 'text' : 'password'}
                  value={tavilyApiKey}
                  onChange={(e) => setTavilyApiKey(e.target.value)}
                  placeholder="tvly-..."
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowTavilyKey(!showTavilyKey)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showTavilyKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Get an API key from <a href="https://tavily.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">tavily.com</a>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Search Depth
                </label>
                <select
                  value={tavilyConfig.searchDepth}
                  onChange={(e) => setTavilyConfig(prev => ({ ...prev, searchDepth: e.target.value as any }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="basic">Basic (Fast)</option>
                  <option value="advanced">Advanced (Deep)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Max Results
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={tavilyConfig.maxResults}
                  onChange={(e) => setTavilyConfig(prev => ({ ...prev, maxResults: parseInt(e.target.value) || 5 }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                id="tavily-test-btn"
                onClick={handleTestTavily}
                disabled={tavilyTesting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${tavilyTesting ? 'animate-spin' : ''}`} />
                <span>{tavilyTesting ? 'Testing...' : 'Test Tavily Connection'}</span>
              </button>

              <button
                type="submit"
                id="tavily-save-btn"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Tavily Config</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. STORAGE & BACKUP                                      */}
      {/* ======================================================== */}
      {activeSubTab === 'backup' && (
        <div id="settings-backup-section" className="space-y-6 max-w-3xl">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              <span>Storage Architecture &amp; Verifications</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Tara AI uses authoritative browser-level localStorage persistence with synchronous read-back verification and masked secret security.
            </p>

            <div className="mt-6 space-y-3">
              <div className="p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-semibold text-xs text-white">tara_blogger_integrations</span>
                  <p className="text-[11px] text-slate-400">Stores multiple Google Blogger accounts</p>
                </div>
                <span className="text-xs font-mono text-blue-400 font-semibold">
                  {bloggerList.length} records
                </span>
              </div>

              <div className="p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-semibold text-xs text-white">tara_social_integrations</span>
                  <p className="text-[11px] text-slate-400">Stores Facebook, Instagram, YouTube, TikTok configs</p>
                </div>
                <span className="text-xs font-mono text-purple-400 font-semibold">
                  {socialList.length} records
                </span>
              </div>

              <div className="p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-semibold text-xs text-white">tara_ai_api_providers</span>
                  <p className="text-[11px] text-slate-400">LLM provider endpoints and credentials</p>
                </div>
                <span className="text-xs font-mono text-emerald-400 font-semibold">
                  {providers.length} records
                </span>
              </div>

              <div className="p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-semibold text-xs text-white">tara_tavily_config</span>
                  <p className="text-[11px] text-slate-400">Web search depth and API configuration</p>
                </div>
                <span className="text-xs font-mono text-amber-400 font-semibold">
                  {tavilyConfig.apiKey ? 'Configured' : 'Empty'}
                </span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Export all configurations to an encrypted JSON backup file.
              </span>
              <button
                id="export-backup-btn"
                onClick={handleExportBackup}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Configuration Backup</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {editingBlogger !== undefined && (
        <BloggerModal
          integration={editingBlogger}
          onClose={() => setEditingBlogger(undefined)}
          onSaved={refreshAllStores}
        />
      )}

      {editingSocial !== undefined && (
        <SocialModal
          integration={editingSocial}
          defaultPlatform={defaultSocialPlatform}
          onClose={() => setEditingSocial(undefined)}
          onSaved={refreshAllStores}
        />
      )}

      {editingProvider !== undefined && (
        <ProviderModal
          provider={editingProvider}
          onClose={() => setEditingProvider(undefined)}
          onSaved={refreshAllStores}
        />
      )}
    </div>
  );
};
