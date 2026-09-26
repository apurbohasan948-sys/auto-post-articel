import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Globe,
  Sliders,
  AlertTriangle,
  Cpu,
  Search,
  Eye,
  EyeOff,
  RefreshCw,
  Key,
  AlertCircle,
  Share2,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Power,
  XCircle,
  CheckCircle,
  Link as LinkIcon,
} from 'lucide-react';
import { SystemSettings, SearchTestResult, SearchProviderConfig, ArticleLanguage } from '../types/agent.ts';
import { providerStore, isMasked, MASKED_SECRET, TavilyConfig } from '../services/providerStore.ts';
import { apiClient } from '../services/apiClient.ts';
import { BloggerIntegration, SocialIntegration, SocialPlatform } from '../types/integrations.ts';
import { integrationStore } from '../services/integrationStore.ts';
import { BloggerAdapter } from '../services/adapters/BloggerAdapter.ts';
import { testSocialIntegration } from '../services/adapters/index.ts';
import { BloggerModal } from './integrations/BloggerModal.tsx';
import { SocialModal } from './integrations/SocialModal.tsx';

interface SettingsViewProps {
  settings: SystemSettings;
  onUpdateSettings: (settings: Partial<SystemSettings>) => void;
  onNavigateToProviders?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onNavigateToProviders,
}) => {
  // Navigation sub-tabs inside Settings
  const [activeSubTab, setActiveSubTab] = useState<'blogger' | 'social' | 'tavily' | 'policy'>('blogger');

  // =========================================================================
  // BLOGGER & SOCIAL INTEGRATIONS STATE (Stored authoritative in localStorage)
  // =========================================================================
  const [bloggers, setBloggers] = useState<BloggerIntegration[]>(() => integrationStore.loadBlogger());
  const [socials, setSocials] = useState<SocialIntegration[]>(() => integrationStore.loadSocial());
  const [isBloggerModalOpen, setIsBloggerModalOpen] = useState(false);
  const [editingBlogger, setEditingBlogger] = useState<BloggerIntegration | null>(null);
  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false);
  const [editingSocial, setEditingSocial] = useState<SocialIntegration | null>(null);
  const [testingIntegrationId, setTestingIntegrationId] = useState<string | null>(null);
  const [testFeedback, setTestFeedback] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [socialPlatformFilter, setSocialPlatformFilter] = useState<string>('all');

  useEffect(() => {
    setBloggers(integrationStore.loadBlogger());
    setSocials(integrationStore.loadSocial());

    const unsubB = integrationStore.subscribeBlogger((items) => setBloggers(items));
    const unsubS = integrationStore.subscribeSocial((items) => setSocials(items));

    return () => {
      unsubB();
      unsubS();
    };
  }, []);

  const handleToggleBlogger = (id: string) => {
    integrationStore.toggleBloggerEnabled(id);
  };

  const handleDeleteBlogger = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the Blogger integration "${name}"?`)) {
      integrationStore.removeBlogger(id);
    }
  };

  const handleTestBlogger = async (blogger: BloggerIntegration) => {
    setTestingIntegrationId(blogger.id);
    setTestFeedback(null);
    try {
      const result = await BloggerAdapter.testConnection(blogger);
      const isSuccess = result.status === 'success' || result.status === 'CONNECTED';
      integrationStore.recordBloggerTestResult(blogger.id, {
        status: isSuccess ? 'CONNECTED' : 'FAILED',
        latencyMs: result.latencyMs || 0,
        message: result.message,
        error: isSuccess ? undefined : (result.error || result.message),
      });
      if (isSuccess) {
        integrationStore.updateBlogger(blogger.id, {
          connected: true,
          lastTestStatus: 'CONNECTED',
          lastTestMessage: result.message,
          lastTestedAt: new Date().toISOString(),
        });
      } else {
        integrationStore.updateBlogger(blogger.id, {
          connected: false,
          lastTestStatus: 'FAILED',
          lastTestMessage: result.error || result.message,
          lastTestedAt: new Date().toISOString(),
        });
      }
      setTestFeedback({
        id: blogger.id,
        success: isSuccess,
        message: (result.message || (isSuccess ? 'Connected successfully' : 'Connection failed')) + (result.latencyMs ? ` (${result.latencyMs}ms)` : ''),
      });
    } catch (err: any) {
      integrationStore.recordBloggerTestResult(blogger.id, {
        status: 'FAILED',
        latencyMs: 0,
        error: err?.message || 'Connection test failed',
      });
      setTestFeedback({
        id: blogger.id,
        success: false,
        message: err?.message || 'Connection test failed',
      });
    } finally {
      setTestingIntegrationId(null);
    }
  };

  const handleConnectGoogleOAuth = (blogger: BloggerIntegration) => {
    setEditingBlogger(blogger);
    setIsBloggerModalOpen(true);
  };

  const handleToggleSocial = (id: string) => {
    integrationStore.toggleSocialEnabled(id);
  };

  const handleDeleteSocial = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the social integration "${name}"?`)) {
      integrationStore.removeSocial(id);
    }
  };

  const handleTestSocial = async (social: SocialIntegration) => {
    setTestingIntegrationId(social.id);
    setTestFeedback(null);
    try {
      const result = await testSocialIntegration(social);
      const isSuccess = result.status === 'success' || result.status === 'CONNECTED';
      integrationStore.recordSocialTestResult(social.id, {
        status: isSuccess ? 'CONNECTED' : 'FAILED',
        latencyMs: result.latencyMs || 0,
        message: result.message,
        error: isSuccess ? undefined : (result.error || result.message),
      });
      setTestFeedback({
        id: social.id,
        success: isSuccess,
        message: (result.message || (isSuccess ? 'Connected successfully' : 'Connection failed')) + (result.latencyMs ? ` (${result.latencyMs}ms)` : ''),
      });
    } catch (err: any) {
      integrationStore.recordSocialTestResult(social.id, {
        status: 'FAILED',
        latencyMs: 0,
        error: err?.message || 'Test failed',
      });
      setTestFeedback({
        id: social.id,
        success: false,
        message: err?.message || 'Test failed',
      });
    } finally {
      setTestingIntegrationId(null);
    }
  };

  // =========================================================================
  // TAVILY CONFIGURATION STATE (Single source of truth: tara_tavily_config)
  // =========================================================================
  const [tavilyConfig, setTavilyConfig] = useState<TavilyConfig>(() => providerStore.loadTavilyConfig());
  const [tavilyApiKeyInput, setTavilyApiKeyInput] = useState<string>(() =>
    providerStore.loadTavilyConfig().apiKey ? MASKED_SECRET : ''
  );
  const [showTavilyKey, setShowTavilyKey] = useState(false);
  const [testingTavily, setTestingTavily] = useState(false);
  const [tavilyTestResult, setTavilyTestResult] = useState<SearchTestResult | null>(null);
  const [tavilySaved, setTavilySaved] = useState(false);

  useEffect(() => {
    const unsub = providerStore.subscribeTavily((conf) => {
      setTavilyConfig(conf);
      if (conf.apiKey) {
        setTavilyApiKeyInput(MASKED_SECRET);
      } else {
        setTavilyApiKeyInput('');
      }
    });
    return () => unsub();
  }, []);

  const toggleShowTavilyKey = () => {
    if (!showTavilyKey) {
      if (isMasked(tavilyApiKeyInput)) {
        setTavilyApiKeyInput(tavilyConfig.apiKey || '');
      }
      setShowTavilyKey(true);
    } else {
      if (tavilyApiKeyInput === tavilyConfig.apiKey && tavilyConfig.apiKey) {
        setTavilyApiKeyInput(MASKED_SECRET);
      }
      setShowTavilyKey(false);
    }
  };

  const handleSaveTavily = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawInput = tavilyApiKeyInput.trim();
    const resolvedKey = isMasked(rawInput) ? tavilyConfig.apiKey : rawInput;

    const saved = providerStore.saveTavilyConfig({
      apiKey: resolvedKey,
      baseUrl: tavilyConfig.baseUrl || 'https://api.tavily.com',
      searchDepth: tavilyConfig.searchDepth || 'advanced',
      maxResults: tavilyConfig.maxResults || 6,
      enabled: tavilyConfig.enabled ?? true,
    });

    setTavilyConfig(saved);
    if (saved.apiKey) {
      setTavilyApiKeyInput(showTavilyKey ? saved.apiKey : MASKED_SECRET);
    } else {
      setTavilyApiKeyInput('');
    }
    setTavilySaved(true);
    setTimeout(() => setTavilySaved(false), 3000);
  };

  const handleTestTavily = async () => {
    setTestingTavily(true);
    setTavilyTestResult(null);

    const rawInput = tavilyApiKeyInput.trim();
    const resolvedKey = isMasked(rawInput) ? tavilyConfig.apiKey : rawInput;

    if (!resolvedKey && !process.env.TAVILY_API_KEY) {
      setTestingTavily(false);
      setTavilyTestResult({
        success: false,
        status: 'FAILED',
        provider: 'Tavily AI Search',
        latencyMs: 0,
        resultCount: 0,
        error: 'Tavily API key is not configured.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (resolvedKey && resolvedKey !== tavilyConfig.apiKey) {
      providerStore.saveTavilyConfig({ apiKey: resolvedKey });
    }

    try {
      const probeProvider: SearchProviderConfig = {
        id: 'search_tavily',
        name: 'Tavily AI Search',
        type: 'tavily',
        apiKey: resolvedKey,
        baseUrl: tavilyConfig.baseUrl || 'https://api.tavily.com',
        searchDepth: tavilyConfig.searchDepth || 'advanced',
        maxResults: 3,
        priority: 1,
        enabled: true,
      };

      const res = await apiClient.testSearchProvider({
        providerId: 'search_tavily',
        provider: probeProvider,
        query: 'ai autonomous agents research ping',
        depth: tavilyConfig.searchDepth || 'advanced',
        maxResults: 3,
      });
      setTavilyTestResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTavilyTestResult({
        success: false,
        status: 'FAILED',
        provider: 'Tavily AI Search',
        latencyMs: 0,
        resultCount: 0,
        error: msg,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setTestingTavily(false);
    }
  };

  // =========================================================================
  // SYSTEM & POLICY SETTINGS STATE
  // =========================================================================
  const [formData, setFormData] = useState<SystemSettings>(() => ({
    status: settings?.status || 'IDLE',
    mode: settings?.mode || 'AUTO',
    language: settings?.language || 'English',
    niche: settings?.niche || 'Autonomous AI Systems & Cloud Infrastructure',
    contentNiche: settings?.contentNiche || settings?.niche || 'Autonomous AI Systems & Cloud Infrastructure',
    subNiches: Array.isArray(settings?.subNiches) ? settings.subNiches : ['Multi-Agent Architecture', 'Serverless Cron', 'Empirical Research'],
    targetAudience: settings?.targetAudience || 'Software Engineers, Architects, and Tech Leaders',
    countryRegion: settings?.countryRegion || 'Global',
    keywords: Array.isArray(settings?.keywords) ? settings.keywords : ['Autonomous AI', 'Agent Orchestration', 'Netlify Serverless'],
    excludedKeywords: Array.isArray(settings?.excludedKeywords) ? settings.excludedKeywords : ['crypto pumps', 'get rich quick', 'unverified rumors'],
    articleFrequencyPerDay: settings?.articleFrequencyPerDay || 3,
    maxArticlesPerDay: settings?.maxArticlesPerDay || 3,
    maxAiCallsPerDay: settings?.maxAiCallsPerDay || 60,
    maxAICallsPerDay: settings?.maxAICallsPerDay || 60,
    maxResearchCallsPerDay: settings?.maxResearchCallsPerDay || 20,
    maxWebSearchesPerDay: settings?.maxWebSearchesPerDay || 20,
    maxTokensPerArticle: settings?.maxTokensPerArticle || 4000,
    maxRewriteAttempts: settings?.maxRewriteAttempts || 2,
    timezone: settings?.timezone || 'UTC',
    activeDays: Array.isArray(settings?.activeDays) ? settings.activeDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    quietHoursStart: typeof settings?.quietHoursStart === 'number' ? settings.quietHoursStart : 23,
    quietHoursEnd: typeof settings?.quietHoursEnd === 'number' ? settings.quietHoursEnd : 6,
    todayStats: settings?.todayStats || {
      aiCalls: 0,
      researchCalls: 0,
      articlesPublished: 0,
      socialPostsCreated: 0,
      date: new Date().toISOString().slice(0, 10),
    },
  }));
  const [isSaved, setIsSaved] = useState(false);

  React.useEffect(() => {
    if (settings) {
      setFormData((prev) => ({
        ...prev,
        ...settings,
        activeDays: Array.isArray(settings.activeDays) ? settings.activeDays : prev.activeDays,
        todayStats: settings.todayStats || prev.todayStats,
      }));
    }
  }, [settings]);

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const handleToggleDay = (day: string) => {
    const current = formData.activeDays || [];
    if (current.includes(day)) {
      setFormData({ ...formData, activeDays: current.filter((d) => d !== day) });
    } else {
      setFormData({ ...formData, activeDays: [...current, day] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Filtered social items
  const filteredSocials = socials.filter((s) => {
    if (socialPlatformFilter === 'all') return true;
    return s.platform === socialPlatformFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Sub-Nav */}
      <div className="cyber-panel p-5 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white font-display">
              Settings & API Integrations Manager
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage Blogger sites, Social distribution networks, Tavily search engine, and autonomous operational policies.
          </p>
        </div>

        {/* Sub-tabs switch */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 p-1 rounded-xl self-start overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveSubTab('blogger')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
              activeSubTab === 'blogger'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Blogger</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeSubTab === 'blogger' ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
              {bloggers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('social')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
              activeSubTab === 'social'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Social Networks</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeSubTab === 'social' ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
              {socials.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('tavily')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
              activeSubTab === 'tavily'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Tavily Search</span>
          </button>

          <button
            onClick={() => setActiveSubTab('policy')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
              activeSubTab === 'policy'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Operations & Policy</span>
          </button>
        </div>
      </div>

      {/* Global Test Feedback Notice */}
      {testFeedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs animate-fade-in ${
            testFeedback.success
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-red-950/40 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {testFeedback.success ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <div className="font-mono font-medium">{testFeedback.message}</div>
          </div>
          <button
            onClick={() => setTestFeedback(null)}
            className="text-slate-400 hover:text-white px-2 py-0.5 rounded hover:bg-slate-800 cursor-pointer text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* API Control Center Banner Link */}
      {onNavigateToProviders && (
        <div className="cyber-panel p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                Looking for LLM & AI Providers?
              </h4>
              <p className="text-[11px] text-slate-400">
                Manage, add, test, and prioritize OpenRouter, Gemini, and custom LLM API endpoints in the dedicated API Control Center.
              </p>
            </div>
          </div>

          <button
            onClick={onNavigateToProviders}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-colors flex items-center justify-center gap-1.5 flex-shrink-0 cursor-pointer shadow-lg shadow-cyan-500/10"
          >
            <span>Open API Control Center</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ================================================================= */}
      {/* 1. BLOGGER TAB                                                    */}
      {/* ================================================================= */}
      {activeSubTab === 'blogger' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>Blogger Integrations (localStorage)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Configurations are persisted in browser <code className="text-cyan-300 font-mono">tara_blogger_integrations</code> and used directly by the publishing agent.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingBlogger(null);
                setIsBloggerModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 rounded-xl text-xs font-mono font-bold transition cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Blogger</span>
            </button>
          </div>

          {bloggers.length === 0 ? (
            <div className="cyber-panel border border-slate-800 border-dashed rounded-2xl p-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
                <Globe className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white font-mono">No Blogger accounts configured</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Add your Blogger Blog ID and Google OAuth Access Token to enable automatic article publishing.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingBlogger(null);
                  setIsBloggerModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Configure First Blogger Site</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {bloggers.map((blogger) => {
                const isTesting = testingIntegrationId === blogger.id;
                const isConnected = blogger.connected || blogger.lastTestStatus === 'success' || blogger.lastTestStatus === 'CONNECTED';
                const isFailed = blogger.lastTestStatus === 'failed' || blogger.lastTestStatus === 'FAILED';

                return (
                  <div
                    key={blogger.id}
                    className={`cyber-panel p-5 rounded-2xl border transition space-y-4 ${
                      blogger.enabled ? 'border-slate-800' : 'border-slate-800/60 opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm font-mono">{blogger.name}</h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                              !blogger.enabled
                                ? 'bg-slate-800 text-slate-400'
                                : isTesting
                                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                : isConnected
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : isFailed
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {!blogger.enabled
                              ? 'DISABLED'
                              : isTesting
                              ? 'TESTING...'
                              : isConnected
                              ? 'CONNECTED'
                              : isFailed
                              ? 'FAILED'
                              : 'NOT CONNECTED'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          Blog ID: <span className="text-slate-200">{blogger.blogId}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleBlogger(blogger.id)}
                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                          blogger.enabled
                            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/60'
                            : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'
                        }`}
                        title={blogger.enabled ? 'Enabled - Click to disable' : 'Disabled - Click to enable'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Metadata specs */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-900">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Default Status:</span>
                        <span className="font-mono text-cyan-400">{blogger.defaultStatus || 'DRAFT'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Public URL:</span>
                        <span className="font-mono text-slate-300 truncate block">
                          {blogger.publicBlogUrl || blogger.blogUrl || 'Not configured'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500 block text-[11px]">Labels:</span>
                        <span className="font-mono text-slate-300">
                          {blogger.defaultLabels?.join(', ') || blogger.defaultLabel || 'None'}
                        </span>
                      </div>
                    </div>

                    {blogger.lastTestMessage && (
                      <div className="text-[11px] font-mono p-2 rounded bg-slate-950 border border-slate-900 text-slate-400 truncate">
                        Diagnostic: {blogger.lastTestMessage}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTestBlogger(blogger)}
                          disabled={isTesting}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1.5"
                        >
                          <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin text-cyan-400' : ''}`} />
                          <span>{isTesting ? 'Testing API...' : 'Test Connection'}</span>
                        </button>

                        <button
                          onClick={() => handleConnectGoogleOAuth(blogger)}
                          className="px-3 py-1.5 bg-blue-950/40 hover:bg-blue-900/40 border border-blue-500/30 text-blue-300 rounded-lg text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1.5"
                          title="Authorize via Google OAuth 2.0"
                        >
                          <LinkIcon className="w-3 h-3 text-blue-400" />
                          <span>Connect Google</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingBlogger(blogger);
                            setIsBloggerModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                          title="Edit configuration"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteBlogger(blogger.id, blogger.name)}
                          className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-950/30 transition cursor-pointer"
                          title="Delete integration"
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
        </div>
      )}

      {/* ================================================================= */}
      {/* 2. SOCIAL NETWORKS TAB                                            */}
      {/* ================================================================= */}
      {activeSubTab === 'social' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Share2 className="w-4 h-4 text-cyan-400" />
                <span>Social Networks (localStorage)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-account adapters for Facebook, Instagram, YouTube, TikTok, Telegram, LinkedIn, X/Twitter, and Threads in <code className="text-cyan-300 font-mono">tara_social_integrations</code>.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingSocial(null);
                setIsSocialModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 rounded-xl text-xs font-mono font-bold transition cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Integration</span>
            </button>
          </div>

          {/* Platform Filter Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: 'All Channels' },
              { id: 'telegram', label: 'Telegram' },
              { id: 'facebook', label: 'Facebook' },
              { id: 'instagram', label: 'Instagram' },
              { id: 'youtube', label: 'YouTube' },
              { id: 'tiktok', label: 'TikTok' },
              { id: 'linkedin', label: 'LinkedIn' },
              { id: 'twitter', label: 'X / Twitter' },
              { id: 'threads', label: 'Threads' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSocialPlatformFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer ${
                  socialPlatformFilter === tab.id
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50 font-bold'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filteredSocials.length === 0 ? (
            <div className="cyber-panel border border-slate-800 border-dashed rounded-2xl p-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
                <Share2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white font-mono">No social accounts configured</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Add bot tokens or API credentials for Telegram, Facebook, LinkedIn, X, and other networks to enable automatic distribution.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingSocial(null);
                  setIsSocialModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Social Account</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredSocials.map((social) => {
                const isTesting = testingIntegrationId === social.id;
                const isConnected = social.connected || social.lastTestStatus === 'success' || social.lastTestStatus === 'CONNECTED';
                const isFailed = social.lastTestStatus === 'failed' || social.lastTestStatus === 'FAILED';

                return (
                  <div
                    key={social.id}
                    className={`cyber-panel p-5 rounded-2xl border transition space-y-4 ${
                      social.enabled ? 'border-slate-800' : 'border-slate-800/60 opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm font-mono">{social.name}</h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                              !social.enabled
                                ? 'bg-slate-800 text-slate-400'
                                : isTesting
                                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                : isConnected
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : isFailed
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {!social.enabled
                              ? 'DISABLED'
                              : isTesting
                              ? 'TESTING...'
                              : isConnected
                              ? 'CONNECTED'
                              : isFailed
                              ? 'FAILED'
                              : 'NOT CONNECTED'}
                          </span>
                        </div>
                        <div className="text-xs text-cyan-400 font-mono uppercase">
                          Platform: <span className="font-bold">{social.platform}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleSocial(social.id)}
                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                          social.enabled
                            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/60'
                            : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'
                        }`}
                        title={social.enabled ? 'Enabled - Click to disable' : 'Disabled - Click to enable'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Metadata details */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-900">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Channel / Target:</span>
                        <span className="font-mono text-slate-200 truncate block">
                          {social.channelId || social.pageId || social.accountId || social.profileId || 'Default'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Priority:</span>
                        <span className="font-mono text-cyan-400">{social.priority || 1}</span>
                      </div>
                    </div>

                    {social.lastTestMessage && (
                      <div className="text-[11px] font-mono p-2 rounded bg-slate-950 border border-slate-900 text-slate-400 truncate">
                        Diagnostic: {social.lastTestMessage}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                      <button
                        onClick={() => handleTestSocial(social)}
                        disabled={isTesting}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin text-cyan-400' : ''}`} />
                        <span>{isTesting ? 'Testing Real API...' : 'Test Connection'}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingSocial(social);
                            setIsSocialModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                          title="Edit integration"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteSocial(social.id, social.name)}
                          className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-950/30 transition cursor-pointer"
                          title="Delete integration"
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
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. TAVILY SEARCH TAB (Working, preserved intact)                  */}
      {/* ================================================================= */}
      {activeSubTab === 'tavily' && (
        <div className="cyber-panel p-5 sm:p-6 rounded-xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Search className="w-4 h-4 text-cyan-400" />
                <span>Tavily AI Search Configuration</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Single source of truth in browser <code className="text-cyan-300 font-mono">tara_tavily_config</code>. Used by ResearchAgent for empirical grounding.
              </p>
            </div>

            {tavilySaved && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-xs font-mono text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Tavily Config Saved</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSaveTavily} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Tavily API Key</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {tavilyConfig.apiKey ? (isMasked(tavilyApiKeyInput) ? 'Saved & Masked' : 'Modified') : 'Not Set'}
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showTavilyKey ? 'text' : 'password'}
                    value={tavilyApiKeyInput}
                    onChange={(e) => setTavilyApiKeyInput(e.target.value)}
                    placeholder="tvly-xxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:border-cyan-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={toggleShowTavilyKey}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showTavilyKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Tavily Base URL</label>
                <input
                  type="text"
                  value={tavilyConfig.baseUrl || 'https://api.tavily.com'}
                  onChange={(e) => setTavilyConfig({ ...tavilyConfig, baseUrl: e.target.value })}
                  placeholder="https://api.tavily.com"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Search Depth</label>
                <select
                  value={tavilyConfig.searchDepth || 'advanced'}
                  onChange={(e) =>
                    setTavilyConfig({ ...tavilyConfig, searchDepth: e.target.value as 'basic' | 'advanced' })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                >
                  <option value="basic">Basic (Fast & Economical)</option>
                  <option value="advanced">Advanced (Deep Multi-source Academic)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Max Results per Query</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={tavilyConfig.maxResults || 6}
                  onChange={(e) =>
                    setTavilyConfig({ ...tavilyConfig, maxResults: parseInt(e.target.value, 10) || 6 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleTestTavily}
                disabled={testingTavily}
                className="px-4 py-2 rounded-lg text-xs font-mono font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 hover:bg-cyan-900/60 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingTavily ? 'animate-spin' : ''}`} />
                <span>{testingTavily ? 'Testing Tavily...' : 'Test Connection'}</span>
              </button>

              <button
                type="submit"
                className="px-5 py-2 rounded-lg text-xs font-mono font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Tavily Configuration</span>
              </button>
            </div>
          </form>

          {tavilyTestResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-mono ${
                tavilyTestResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/40 border-red-500/40 text-red-300'
              }`}
            >
              <div className="flex items-center gap-2 font-bold mb-1">
                {tavilyTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                )}
                <span>
                  {tavilyTestResult.success ? 'TAVILY TEST SUCCESSFUL' : 'TAVILY TEST FAILED'}
                  {tavilyTestResult.latencyMs ? ` (${tavilyTestResult.latencyMs}ms)` : ''}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                {tavilyTestResult.success
                  ? `Returned ${tavilyTestResult.resultCount || 0} empirical web search results.`
                  : tavilyTestResult.error || 'Connection failed'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 4. POLICY & OPERATIONS TAB (Working, preserved intact)             */}
      {/* ================================================================= */}
      {activeSubTab === 'policy' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Niche & Target Audience */}
          <div className="cyber-panel p-5 sm:p-6 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-800 pb-2">
              1. Editorial Direction & Target Audience
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Primary Editorial Niche</label>
                <input
                  type="text"
                  value={formData.niche}
                  onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Target Audience</label>
                <input
                  type="text"
                  value={formData.targetAudience}
                  onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Language</label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value as ArticleLanguage })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                >
                  <option value="English">English</option>
                  <option value="Bengali">Bengali</option>
                  <option value="Banglish">Banglish</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Target Region</label>
                <input
                  type="text"
                  value={formData.countryRegion}
                  onChange={(e) => setFormData({ ...formData, countryRegion: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                />
              </div>
            </div>
          </div>

          {/* 2. Operational Mode */}
          <div className="cyber-panel p-5 sm:p-6 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-800 pb-2">
              2. Autonomy Mode & Editorial Safeguards
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Pipeline Execution Mode</label>
                <select
                  value={formData.mode}
                  onChange={(e) => setFormData({ ...formData, mode: e.target.value as 'AUTO' | 'APPROVAL' })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                >
                  <option value="AUTO">AUTO (Publish immediately upon quality approval)</option>
                  <option value="APPROVAL">APPROVAL (Require human review before publishing)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Max Quality Rewrite Attempts</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={formData.maxRewriteAttempts}
                  onChange={(e) =>
                    setFormData({ ...formData, maxRewriteAttempts: parseInt(e.target.value, 10) || 2 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                />
              </div>
            </div>
          </div>

          {/* 3. Schedule, Active Days & Quiet Hours */}
          <div className="cyber-panel p-5 sm:p-6 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-800 pb-2">
              3. Scheduled Timings & Quiet Hours
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1.5">
                  Active Publishing Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map((day) => {
                    const active = formData.activeDays?.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleToggleDay(day)}
                        className={`px-3.5 py-1.5 rounded-lg border font-mono font-bold cursor-pointer transition-colors ${
                          active
                            ? 'bg-cyan-950 text-cyan-300 border-cyan-500'
                            : 'bg-slate-950 text-slate-500 border-slate-800'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Quiet Hours Start (UTC Hour, 0-23)</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={formData.quietHoursStart}
                    onChange={(e) =>
                      setFormData({ ...formData, quietHoursStart: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Quiet Hours End (UTC Hour, 0-23)</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={formData.quietHoursEnd}
                    onChange={(e) =>
                      setFormData({ ...formData, quietHoursEnd: parseInt(e.target.value, 10) || 6 })
                    }
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Cost Control & Quotas */}
          <div className="cyber-panel p-5 sm:p-6 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-800 pb-2">
              4. Cost Guardrails & Daily Ceilings
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Max Articles Per Day</label>
                <input
                  type="number"
                  value={formData.maxArticlesPerDay}
                  onChange={(e) =>
                    setFormData({ ...formData, maxArticlesPerDay: parseInt(e.target.value, 10) || 3 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Max AI API Calls / Day</label>
                <input
                  type="number"
                  value={formData.maxAICallsPerDay}
                  onChange={(e) =>
                    setFormData({ ...formData, maxAICallsPerDay: parseInt(e.target.value, 10) || 60 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Max Web Search Calls / Day</label>
                <input
                  type="number"
                  value={formData.maxWebSearchesPerDay}
                  onChange={(e) =>
                    setFormData({ ...formData, maxWebSearchesPerDay: parseInt(e.target.value, 10) || 20 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-lg text-xs font-mono font-bold text-slate-950 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              <Save className="w-4 h-4" />
              <span>{isSaved ? 'Settings Saved' : 'Save System Settings'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* MODALS                                                                    */}
      {/* ========================================================================= */}
      {isBloggerModalOpen && (
        <BloggerModal
          existing={editingBlogger}
          onClose={() => setIsBloggerModalOpen(false)}
          onSave={() => {
            setIsBloggerModalOpen(false);
            setBloggers(integrationStore.loadBlogger());
          }}
        />
      )}

      {isSocialModalOpen && (
        <SocialModal
          existing={editingSocial}
          onClose={() => setIsSocialModalOpen(false)}
          onSave={() => {
            setIsSocialModalOpen(false);
            setSocials(integrationStore.loadSocial());
          }}
        />
      )}
    </div>
  );
};
