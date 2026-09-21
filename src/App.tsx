import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.tsx';
import { Navigation, NavTab } from './components/Navigation.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { PipelineVisualizer } from './components/PipelineVisualizer.tsx';
import { TopicsView } from './components/TopicsView.tsx';
import { ArticlesView } from './components/ArticlesView.tsx';
import { ResearchView } from './components/ResearchView.tsx';
import { PublishingView } from './components/PublishingView.tsx';
import { ProvidersView } from './components/ProvidersView.tsx';
import { AnalyticsMemoryView } from './components/AnalyticsMemoryView.tsx';
import { LogsView } from './components/LogsView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { ArticleReviewModal } from './components/ArticleReviewModal.tsx';
import { NetlifyGuideModal } from './components/NetlifyGuideModal.tsx';
import { apiClient } from './services/apiClient.ts';
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

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [status, setStatus] = useState<'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED'>('IDLE');
  const [mode, setMode] = useState<'AUTO' | 'APPROVAL'>('AUTO');
  const [activeJob, setActiveJob] = useState<AgentJob | null>(null);
  const [jobs, setJobs] = useState<AgentJob[]>([]);

  const [settings, setSettings] = useState<SystemSettings>({
    status: 'IDLE',
    mode: 'AUTO',
    language: 'English',
    niche: 'Autonomous AI Systems & Cloud Infrastructure',
    contentNiche: 'Autonomous AI Systems & Cloud Infrastructure',
    subNiches: ['Multi-Agent Architecture', 'Serverless Cron', 'Empirical Research'],
    targetAudience: 'Software Engineers, Architects, and Tech Leaders',
    countryRegion: 'Global',
    keywords: ['Autonomous AI', 'Agent Orchestration', 'Netlify Serverless'],
    excludedKeywords: ['crypto pumps', 'get rich quick', 'unverified rumors'],
    articleFrequencyPerDay: 3,
    maxArticlesPerDay: 3,
    maxAiCallsPerDay: 60,
    maxAICallsPerDay: 60,
    maxResearchCallsPerDay: 20,
    maxWebSearchesPerDay: 20,
    maxTokensPerArticle: 4000,
    maxRewriteAttempts: 2,
    timezone: 'UTC',
    activeDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    quietHoursStart: 23,
    quietHoursEnd: 6,
    todayStats: {
      aiCalls: 0,
      researchCalls: 0,
      articlesPublished: 0,
      socialPostsCreated: 0,
      date: new Date().toISOString().slice(0, 10),
    },
  });

  const [topics, setTopics] = useState<TopicCandidate[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [researchPackages, setResearchPackages] = useState<Record<string, ResearchPackage>>({});
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [memory, setMemory] = useState<AgentMemory | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [health, setHealth] = useState<ProviderHealth | undefined>(undefined);

  const [aiProviders, setAiProviders] = useState<AIProviderConfig[]>([]);
  const [searchProviders, setSearchProviders] = useState<SearchProviderConfig[]>([]);
  const [bloggerConfig, setBloggerConfig] = useState<BloggerConfig>({
    blogId: '',
    blogUrl: '',
    defaultLabels: ['Technology', 'AI Systems'],
    isConnected: false,
  });

  // Modals
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showNetlifyGuide, setShowNetlifyGuide] = useState(false);

  // Loading flags
  const [isTriggering, setIsTriggering] = useState(false);
  const [isScouting, setIsScouting] = useState(false);
  const [isArticleActionLoading, setIsArticleActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Master Data Refresh
  const loadData = useCallback(async () => {
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

      if (statusRes.status === 'fulfilled') {
        setStatus(statusRes.value.status as any);
        setMode(statusRes.value.mode as any);
        setActiveJob(statusRes.value.activeJob);
      }
      if (topicsRes.status === 'fulfilled') setTopics(topicsRes.value);
      if (articlesRes.status === 'fulfilled') setArticles(articlesRes.value);
      if (researchRes.status === 'fulfilled') setResearchPackages(researchRes.value);
      if (jobsRes.status === 'fulfilled') setJobs(jobsRes.value);
      if (logsRes.status === 'fulfilled') setLogs(logsRes.value);
      if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value);
      if (memoryRes.status === 'fulfilled') setMemory(memoryRes.value);
      if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value);
      if (aiRes.status === 'fulfilled') setAiProviders(aiRes.value);
      if (searchRes.status === 'fulfilled') setSearchProviders(searchRes.value);
      if (bloggerRes.status === 'fulfilled') setBloggerConfig(bloggerRes.value);
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value.providers);
    } catch (err) {
      console.error('[Axiom App] Failed to load data:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling: high frequency when active job is running (2s), standard when idle (5s)
  useEffect(() => {
    const intervalMs = activeJob ? 2000 : 5000;
    const timer = setInterval(() => {
      loadData();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [activeJob, loadData]);

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
      setTopics(newTopics);
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
      setSettings(saved);
      showToast('System operational settings saved.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  const handleUpdateAI = async (providers: AIProviderConfig[]) => {
    try {
      await apiClient.updateAIProviders(providers);
      setAiProviders(providers);
      showToast('AI Providers configuration saved.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  const handleUpdateSearch = async (providers: SearchProviderConfig[]) => {
    try {
      await apiClient.updateSearchProviders(providers);
      setSearchProviders(providers);
      showToast('Tavily Search configuration saved.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  const handleUpdateBlogger = async (cfg: BloggerConfig) => {
    try {
      await apiClient.updateBloggerConfig(cfg);
      setBloggerConfig(cfg);
      showToast('Blogger target configuration updated.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

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

      {/* Navigation Sub-Bar */}
      <Navigation
        activeTab={activeTab}
        onChangeTab={setActiveTab}
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
            onViewAllArticles={() => setActiveTab('articles')}
          />
        )}

        {activeTab === 'pipeline' && (
          <PipelineVisualizer currentJob={activeJob || jobs[0]} />
        )}

        {activeTab === 'topics' && (
          <TopicsView
            topics={topics}
            isScouting={isScouting}
            onScoutTopics={handleScoutTopics}
            onRunCycleForTopic={(topicId) => {
              handleRunNow(topicId);
              setActiveTab('pipeline');
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
