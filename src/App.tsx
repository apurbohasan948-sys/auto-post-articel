import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header.tsx';
import { Navigation, NavTab } from './components/Navigation.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { PipelineVisualizer } from './components/PipelineVisualizer.tsx';
import { TopicsView } from './components/TopicsView.tsx';
import { ArticlesView } from './components/ArticlesView.tsx';
import { ResearchView } from './components/ResearchView.tsx';
import { PublishingView } from './components/PublishingView.tsx';
import { ProvidersView } from './components/ProvidersView.tsx';
import { ApiDiagnosticsView } from './components/ApiDiagnosticsView.tsx';
import { AnalyticsMemoryView } from './components/AnalyticsMemoryView.tsx';
import { LogsView } from './components/LogsView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { ArticleReviewModal } from './components/ArticleReviewModal.tsx';
import { NetlifyGuideModal } from './components/NetlifyGuideModal.tsx';
import {
  apiClient,
  normalizeAIProviders,
  normalizeSearchProviders,
  normalizeSettings,
  normalizeBloggerConfig,
  normalizeMemory,
} from './services/apiClient.ts';
import { providerStore } from './services/providerStore.ts';
import { safeStorage } from './utils/safeStorage.ts';
import {
  AgentJob,
  AgentMemory,
  AIProviderConfig,
  Article,
  BloggerConfig,
  ProviderHealth,
  ResearchPackage,
  SearchProviderConfig,
  SystemLog,
  SystemSettings,
  TopicCandidate,
} from './types/agent.ts';
import { AlertCircle, RefreshCw, Database, Cpu } from 'lucide-react';

export type AppLifecycleState = 'INITIALIZING' | 'LOADING' | 'READY' | 'ERROR';

/**
 * Maps browser URL pathname to corresponding NavTab safely.
 */
function getTabFromPath(pathname: string): NavTab {
  const clean = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (clean === '/' || clean === '/dashboard') return 'dashboard';
  if (clean === '/pipeline') return 'pipeline';
  if (clean === '/topics') return 'topics';
  if (clean === '/articles') return 'articles';
  if (clean === '/research') return 'research';
  if (clean === '/publishing') return 'publishing';
  if (clean === '/providers' || clean === '/settings/apis' || clean === '/apis') return 'providers';
  if (clean === '/diagnostics') return 'diagnostics';
  if (clean === '/analytics') return 'analytics';
  if (clean === '/logs') return 'logs';
  if (clean === '/settings') return 'settings';
  return 'dashboard';
}

function getPathForTab(tab: NavTab): string {
  if (tab === 'dashboard') return '/';
  return `/${tab}`;
}

export default function App() {
  // Application Lifecycle State
  const [appState, setAppState] = useState<AppLifecycleState>('INITIALIZING');
  const [apiErrors, setApiErrors] = useState<{
    providers?: string;
    database?: string;
    general?: string;
  }>({});

  // Client Routing State with History and Popstate Sync
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    if (typeof window !== 'undefined') {
      return getTabFromPath(window.location.pathname);
    }
    return 'dashboard';
  });

  const [status, setStatus] = useState<'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED'>('IDLE');
  const [mode, setMode] = useState<'AUTO' | 'APPROVAL'>('AUTO');
  const [activeJob, setActiveJob] = useState<AgentJob | null>(null);
  const [jobs, setJobs] = useState<AgentJob[]>([]);

  // Default normalized SystemSettings
  const [settings, setSettings] = useState<SystemSettings>(() => normalizeSettings(null));

  const [topics, setTopics] = useState<TopicCandidate[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [researchPackages, setResearchPackages] = useState<Record<string, ResearchPackage>>({});
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [memory, setMemory] = useState<AgentMemory>(() => normalizeMemory(null));
  const [analytics, setAnalytics] = useState<any>(null);
  const [health, setHealth] = useState<ProviderHealth | undefined>(undefined);

  const [aiProviders, setAiProviders] = useState<AIProviderConfig[]>(() => {
    return providerStore.loadProviders();
  });
  const [searchProviders, setSearchProviders] = useState<SearchProviderConfig[]>(() => {
    return providerStore.loadSearchProviders();
  });
  const [bloggerConfig, setBloggerConfig] = useState<BloggerConfig>(() => normalizeBloggerConfig(null));

  // Sync state with localStorage-backed providerStore across tab actions
  useEffect(() => {
    const unsubAi = providerStore.subscribe((providers) => {
      setAiProviders(providers);
    });
    const unsubTavily = providerStore.subscribeTavily(() => {
      setSearchProviders(providerStore.loadSearchProviders());
    });
    const unsubErr = providerStore.onError((errMsg) => {
      showToast(errMsg, 'error');
    });
    return () => {
      unsubAi();
      unsubTavily();
      unsubErr();
    };
  }, []);

  // Modals
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showNetlifyGuide, setShowNetlifyGuide] = useState(false);

  // Action status flags
  const [isTriggering, setIsTriggering] = useState(false);
  const [isScouting, setIsScouting] = useState(false);
  const [isArticleActionLoading, setIsArticleActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const lastAiSaveTimeRef = useRef<number>(0);
  const lastSearchSaveTimeRef = useRef<number>(0);
  const initialLoadCompletedRef = useRef<boolean>(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // URL PopState Listener for browser back/forward and direct refresh
  useEffect(() => {
    const handlePopState = () => {
      const matched = getTabFromPath(window.location.pathname);
      setActiveTab(matched);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigateTab = (tab: NavTab) => {
    setActiveTab(tab);
    try {
      const targetPath = getPathForTab(tab);
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    } catch {
      // Safe fallback if history is restricted
    }
  };

  // Master Data Refresh with granular, non-crashing promise settlement
  const loadData = useCallback(async () => {
    const fetchStartTime = Date.now();
    const errorsEncountered: { providers?: string; database?: string; general?: string } = {};

    try {
      const [
        statusRes,
        topicsRes,
        articlesRes,
        researchRes,
        jobsRes,
        logsRes,
        analyticsRes,
        memoryRes,
        settingsRes,
        aiRes,
        searchRes,
        bloggerRes,
        healthRes,
      ] = await Promise.allSettled([
        apiClient.getStatus(),
        apiClient.getTopics(),
        apiClient.getArticles(),
        apiClient.getResearchPackages(),
        apiClient.getJobs(),
        apiClient.getLogs(60),
        apiClient.getAnalytics(),
        apiClient.getMemory(),
        apiClient.getSettings(),
        apiClient.getAIProviders(),
        apiClient.getSearchProviders(),
        apiClient.getBloggerConfig(),
        apiClient.getHealth(),
      ]);

      if (statusRes.status === 'fulfilled' && statusRes.value) {
        setStatus((statusRes.value.status as any) || 'IDLE');
        setMode((statusRes.value.mode as any) || 'AUTO');
        setActiveJob(statusRes.value.activeJob || null);
      }

      if (topicsRes.status === 'fulfilled') {
        setTopics(Array.isArray(topicsRes.value) ? topicsRes.value : []);
      }

      if (articlesRes.status === 'fulfilled') {
        setArticles(Array.isArray(articlesRes.value) ? articlesRes.value : []);
      }

      if (researchRes.status === 'fulfilled' && researchRes.value) {
        setResearchPackages(researchRes.value);
      }

      if (jobsRes.status === 'fulfilled') {
        setJobs(Array.isArray(jobsRes.value) ? jobsRes.value : []);
      }

      if (logsRes.status === 'fulfilled') {
        setLogs(Array.isArray(logsRes.value) ? logsRes.value : []);
      }

      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(analyticsRes.value);
      }

      if (memoryRes.status === 'fulfilled' && memoryRes.value) {
        setMemory(normalizeMemory(memoryRes.value));
      }

      if (settingsRes.status === 'fulfilled' && settingsRes.value) {
        setSettings(normalizeSettings(settingsRes.value));
      } else if (settingsRes.status === 'rejected') {
        errorsEncountered.database = 'System operational settings unavailable. Using safe defaults.';
      }

      // AI and Search providers are authoritatively loaded from providerStore (localStorage)
      setAiProviders(providerStore.loadProviders());
      setSearchProviders(providerStore.loadSearchProviders());

      if (bloggerRes.status === 'fulfilled' && bloggerRes.value) {
        setBloggerConfig(normalizeBloggerConfig(bloggerRes.value));
      }

      if (healthRes.status === 'fulfilled' && healthRes.value) {
        setHealth(healthRes.value.providers);
      }

      setApiErrors(errorsEncountered);

      // Safe Diagnostic Logging (scrubbed of secrets)
      if (import.meta.env.DEV && !initialLoadCompletedRef.current) {
        console.log('[Axiom Diagnostics] Application startup telemetry initialized successfully.');
      }
    } catch (err: unknown) {
      console.warn('[Axiom App] Partial data fetch failure:', err);
      errorsEncountered.general = 'Some background data services failed to respond.';
      setApiErrors(errorsEncountered);
    } finally {
      initialLoadCompletedRef.current = true;
      setAppState(Object.keys(errorsEncountered).length > 0 ? 'ERROR' : 'READY');
    }
  }, []);

  // Initial load effect
  useEffect(() => {
    loadData();

    // Fallback safety timer: guarantees transition out of INITIALIZING within 3.5 seconds
    const fallbackTimer = setTimeout(() => {
      setAppState((curr) => (curr === 'INITIALIZING' ? 'READY' : curr));
    }, 3500);

    return () => clearTimeout(fallbackTimer);
  }, [loadData]);

  // Telemetry Polling (every 2s if active job running, 5s when idle)
  useEffect(() => {
    if (appState === 'INITIALIZING') return;
    const intervalMs = activeJob ? 2000 : 5000;
    const timer = setInterval(() => {
      loadData();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [activeJob, appState, loadData]);

  // Agent Actions
  const handleRunNow = async (topicId?: string) => {
    setIsTriggering(true);
    try {
      const res = await apiClient.runCycle(topicId);
      if (res.job) {
        setActiveJob(res.job);
        setStatus('RUNNING');
      }
      showToast('Autonomous content cycle successfully launched!');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    } finally {
      setIsTriggering(false);
    }
  };

  const handlePause = async () => {
    try {
      await apiClient.pauseAgent();
      setStatus('PAUSED');
      showToast('Autonomous agent paused.');
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  const handleResume = async () => {
    try {
      await apiClient.resumeAgent();
      setStatus('IDLE');
      showToast('Autonomous agent resumed.');
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  const handleStop = async () => {
    try {
      await apiClient.stopAgent();
      setStatus('STOPPED');
      setActiveJob(null);
      showToast('Emergency Stop invoked. Execution halted.', 'error');
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  const handleScoutTopics = async () => {
    setIsScouting(true);
    try {
      const newTopics = await apiClient.scoutTopics();
      setTopics(Array.isArray(newTopics) ? newTopics : []);
      showToast(`Scout completed: discovered ${newTopics.length} candidate topics.`);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    } finally {
      setIsScouting(false);
    }
  };

  const handlePublishArticle = async (id: string) => {
    setIsArticleActionLoading(true);
    try {
      const updated = await apiClient.publishArticle(id);
      showToast(`Published "${updated.title}" to Blogger successfully!`);
      if (selectedArticle && selectedArticle.id === id) {
        setSelectedArticle(updated);
      }
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    } finally {
      setIsArticleActionLoading(false);
    }
  };

  const handleApproveArticle = async (id: string) => {
    setIsArticleActionLoading(true);
    try {
      const updated = await apiClient.approveArticle(id);
      showToast(`Article approved and sent to publication pipeline.`);
      if (selectedArticle && selectedArticle.id === id) {
        setSelectedArticle(updated);
      }
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    } finally {
      setIsArticleActionLoading(false);
    }
  };

  const handleUpdateSettings = async (updated: Partial<SystemSettings>) => {
    try {
      const saved = await apiClient.updateSettings(updated);
      setSettings(normalizeSettings(saved));
      showToast('System operational settings saved.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  const handleUpdateAI = useCallback((providers: AIProviderConfig[]) => {
    lastAiSaveTimeRef.current = Date.now();
    setAiProviders(providers);
  }, []);

  const handleUpdateSearch = useCallback((providers: SearchProviderConfig[]) => {
    lastSearchSaveTimeRef.current = Date.now();
    setSearchProviders(providers);
  }, []);

  const handleUpdateBlogger = async (cfg: BloggerConfig) => {
    try {
      const res = await apiClient.updateBloggerConfig(cfg);
      setBloggerConfig(res.config);
      showToast('Blogger target configuration updated.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  // If in initial load, show clean Cybernetic loading screen (never a black screen!)
  if (appState === 'INITIALIZING') {
    return (
      <div
        id="app-initializing-screen"
        className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center p-6 selection:bg-cyan-500"
      >
        <div className="cyber-panel p-8 rounded-2xl border border-slate-800 text-center max-w-sm w-full space-y-5 shadow-2xl bg-gradient-to-b from-slate-900/90 to-[#0b0f19]">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
            <RefreshCw className="w-7 h-7 animate-spin" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-white font-display">Axiom Operations Engine</h2>
            <p className="text-xs text-slate-400">Synchronizing pipeline telemetry & AI providers...</p>
          </div>
          <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full w-2/3 animate-pulse rounded-full" />
          </div>
          <p className="text-[11px] font-mono text-slate-500">Autonomous Content Architecture</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      {/* Toast Notification Alert */}
      {notification && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl text-xs font-mono font-bold flex items-center gap-2 border transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50 shadow-emerald-950/50'
              : 'bg-rose-950 text-rose-300 border-rose-500/50 shadow-rose-950/50'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${notification.type === 'success' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <Header
        status={status}
        mode={mode}
        health={health}
        isTriggering={isTriggering}
        onRunNow={() => handleRunNow()}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
        onOpenNetlifyGuide={() => setShowNetlifyGuide(true)}
      />

      {/* Resilient Non-Blocking API Degradation Warning (Requirement 5 & 11) */}
      {(apiErrors.providers || apiErrors.database) && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-3">
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {apiErrors.providers && `⚠️ API providers could not be loaded. `}
                {apiErrors.database && `Database synchronization notice: ${apiErrors.database} `}
                The dashboard is fully operational with safe offline fallbacks.
              </span>
            </div>
            <button
              onClick={() => loadData()}
              className="px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto shrink-0 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {/* Navigation Sub-Bar */}
      <Navigation
        activeTab={activeTab}
        onChangeTab={handleNavigateTab}
        counts={{
          topics: topics.length,
          articles: articles.length,
          jobs: jobs.length,
          logs: logs.length,
        }}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            settings={settings}
            activeJob={activeJob}
            recentJobs={jobs}
            articles={articles}
            topics={topics}
            logs={logs}
            health={health}
            isTriggering={isTriggering}
            onRunNow={() => handleRunNow()}
            onViewArticle={(art) => setSelectedArticle(art)}
            onViewAllArticles={() => handleNavigateTab('articles')}
          />
        )}

        {activeTab === 'pipeline' && (
          <PipelineVisualizer currentJob={activeJob || jobs[0] || null} />
        )}

        {activeTab === 'topics' && (
          <TopicsView
            topics={topics}
            isScouting={isScouting}
            onScoutTopics={handleScoutTopics}
            onRunCycleForTopic={(topicId) => {
              handleRunNow(topicId);
              handleNavigateTab('pipeline');
            }}
          />
        )}

        {activeTab === 'articles' && (
          <ArticlesView
            articles={articles}
            onSelectArticle={(art) => setSelectedArticle(art)}
            onPublishArticle={handlePublishArticle}
          />
        )}

        {activeTab === 'research' && (
          <ResearchView researchPackages={researchPackages} />
        )}

        {activeTab === 'publishing' && (
          <PublishingView
            bloggerConfig={bloggerConfig}
            onUpdateBlogger={handleUpdateBlogger}
          />
        )}

        {activeTab === 'providers' && (
          <ProvidersView
            aiProviders={aiProviders}
            searchProviders={searchProviders}
            onUpdateAI={handleUpdateAI}
            onUpdateSearch={handleUpdateSearch}
          />
        )}

        {activeTab === 'diagnostics' && (
          <ApiDiagnosticsView
            aiProviders={aiProviders}
            searchProviders={searchProviders}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsMemoryView analytics={analytics} memory={memory} />
        )}

        {activeTab === 'logs' && (
          <LogsView logs={logs} onRefresh={loadData} />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onNavigateToProviders={() => handleNavigateTab('providers')}
          />
        )}
      </main>

      {/* Article Review Modal */}
      {selectedArticle && (
        <ArticleReviewModal
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
          onApprove={handleApproveArticle}
          onPublish={handlePublishArticle}
          isActionLoading={isArticleActionLoading}
        />
      )}

      {/* Netlify Deployment Guide Modal */}
      {showNetlifyGuide && (
        <NetlifyGuideModal onClose={() => setShowNetlifyGuide(false)} />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-4 px-4 sm:px-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Axiom Autonomous AI Content Operations System • Netlify Production Target</span>
          <span className="text-slate-600">Deterministic 12-Stage Agent Pipeline with Tavily Research & Blogger v3 API</span>
        </div>
      </footer>
    </div>
  );
}
