import React from 'react';
import {
  FileText,
  Send,
  Share2,
  Clock,
  Sparkles,
  AlertCircle,
  Play,
  CheckCircle2,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  Layers,
  ChevronRight,
  Activity,
  Globe,
} from 'lucide-react';
import {
  AgentJob,
  Article,
  ProviderHealth,
  SystemLog,
  SystemSettings,
  TopicCandidate,
} from '../types/agent.ts';

interface DashboardViewProps {
  settings: SystemSettings;
  activeJob: AgentJob | null;
  recentJobs: AgentJob[];
  articles: Article[];
  topics: TopicCandidate[];
  logs: SystemLog[];
  health?: ProviderHealth;
  isTriggering: boolean;
  onRunNow: () => void;
  onViewArticle: (article: Article) => void;
  onViewAllArticles: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  settings,
  activeJob,
  recentJobs = [],
  articles = [],
  topics = [],
  logs = [],
  health,
  isTriggering,
  onRunNow,
  onViewArticle,
  onViewAllArticles,
}) => {
  const safeArticles = Array.isArray(articles) ? articles : [];
  const safeTopics = Array.isArray(topics) ? topics : [];
  const safeLogs = Array.isArray(logs) ? logs : [];
  const safeTodayStats = settings?.todayStats || {
    articlesPublished: 0,
    aiCalls: 0,
    researchCalls: 0,
    socialPostsCreated: 0,
    date: new Date().toISOString().slice(0, 10),
  };
  const maxArticles = settings?.maxArticlesPerDay || 3;
  const articlesPublishedToday = safeTodayStats.articlesPublished || 0;

  const publishedArticles = safeArticles.filter(
    (a) => a && (a.lifecycleState === 'PUBLISHED' || a.lifecycleState === 'DISTRIBUTED')
  );
  const pendingArticles = safeArticles.filter((a) => a && a.lifecycleState === 'APPROVED');
  const failedArticles = safeArticles.filter((a) => a && a.lifecycleState === 'FAILED');

  const totalSocialPosts = safeArticles.reduce(
    (acc, a) => acc + (a?.socialDistributions?.filter((s) => s.status === 'PUBLISHED').length || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* 1. Hero KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Published Metric */}
        <div className="cyber-panel p-4 sm:p-5 rounded-xl border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Published Articles</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-white font-display">
              {publishedArticles.length}
            </span>
            <span className="text-xs text-slate-500">
              of {articlesPublishedToday}/{maxArticles} today limit
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all"
              style={{
                width: `${Math.min(
                  100,
                  maxArticles > 0 ? (articlesPublishedToday / maxArticles) * 100 : 0
                )}%`,
              }}
            ></div>
          </div>
        </div>

        {/* Pending Review Metric */}
        <div className="cyber-panel p-4 sm:p-5 rounded-xl border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Review</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-white font-display">
              {pendingArticles.length}
            </span>
            <span className="text-xs text-slate-500">
              {settings?.mode === 'APPROVAL' ? 'awaiting manual publish' : 'auto-publish active'}
            </span>
          </div>
          <div className="mt-3 text-xs text-indigo-300 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Mode: {settings?.mode || 'AUTO'}</span>
          </div>
        </div>

        {/* Social Dispatches Metric */}
        <div className="cyber-panel p-4 sm:p-5 rounded-xl border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Social Distributions</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Share2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-white font-display">
              {totalSocialPosts}
            </span>
            <span className="text-xs text-slate-500">across 5 channels</span>
          </div>
          <div className="mt-3 text-xs text-cyan-400 flex items-center gap-1">
            <Globe className="w-3.5 h-3.5" />
            <span>Facebook, Telegram, X, LinkedIn, Threads</span>
          </div>
        </div>

        {/* Topic Candidates Metric */}
        <div className="cyber-panel p-4 sm:p-5 rounded-xl border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Scouted Topics</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-white font-display">
              {safeTopics.length}
            </span>
            <span className="text-xs text-slate-500">evaluated candidates</span>
          </div>
          <div className="mt-3 text-xs text-purple-300 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" />
            <span>Niche: {settings?.contentNiche || settings?.niche || 'Autonomous AI Systems'}</span>
          </div>
        </div>
      </div>

      {/* 2. Active Job Status & Quick Trigger */}
      <div className="cyber-panel rounded-xl p-5 border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${activeJob ? 'bg-cyan-400 animate-ping' : 'bg-slate-500'}`}></span>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Autonomous Job Engine Status
              </h3>
            </div>
            {activeJob ? (
              <p className="text-xs text-slate-300">
                Running Cycle <span className="font-mono text-cyan-400 font-bold">#{activeJob.jobNumber}</span>. Current stage:{' '}
                <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono text-[11px]">
                  {activeJob.currentStep}
                </span>{' '}
                for <span className="text-white italic font-semibold">"{activeJob.topicTitle || 'Autonomous Discovery'}"</span>
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                Engine is idle and waiting for scheduled cron or operator manual trigger. Next scheduled Netlify invocation will trigger cycle.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRunNow}
              disabled={isTriggering || Boolean(activeJob)}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold text-white transition-all shadow-md flex items-center gap-2 ${
                isTriggering || Boolean(activeJob)
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 cursor-pointer shadow-emerald-500/20'
              }`}
            >
              <Play className={`w-4 h-4 ${isTriggering ? 'animate-spin' : ''}`} />
              <span>{isTriggering ? 'Initiating Pipeline...' : 'Run Autonomous Cycle Now'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Split: Recent Articles & Live System Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Recent Articles (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Recent Generated Articles
            </h3>
            <button
              onClick={onViewAllArticles}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
            >
              View all ({safeArticles.length})
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {safeArticles.slice(0, 4).map((art) => (
              <div
                key={art.id}
                onClick={() => onViewArticle(art)}
                className="cyber-panel p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          art.lifecycleState === 'PUBLISHED' || art.lifecycleState === 'DISTRIBUTED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : art.lifecycleState === 'APPROVED'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {art.lifecycleState}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(art.createdAt).toLocaleDateString()}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {(art.cleanContent || '').split(/\s+/).filter(Boolean).length} words
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                      {art.title || 'Untitled Article'}
                    </h4>

                    <p className="text-xs text-slate-400 line-clamp-2">
                      {art.metaDescription || ''}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 text-xs text-cyan-400 group-hover:translate-x-0.5 transition-transform">
                      Review <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                    {art.qualityReport && art.qualityReport.scoreBreakdown && (
                      <div className="text-[10px] font-mono text-emerald-400 mt-1">
                        Quality: {art.qualityReport.scoreBreakdown.factualConsistency}%
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {safeArticles.length === 0 && (
              <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-500 text-xs">
                No articles generated yet. Click "Run Autonomous Cycle Now" to start the first cycle.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Telemetry Logs (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Live System Activity Stream
            </h3>
            <span className="text-[10px] font-mono text-slate-500 uppercase">Streaming JSONL</span>
          </div>

          <div className="cyber-panel p-3.5 rounded-xl border border-slate-800 font-mono text-xs max-h-[410px] overflow-y-auto space-y-2">
            {safeLogs.slice(0, 12).map((log) => (
              <div
                key={log.id}
                className="pb-2 border-b border-slate-800/60 last:border-0 last:pb-0 space-y-0.5"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span
                    className={`font-bold ${
                      log.level === 'SUCCESS'
                        ? 'text-emerald-400'
                        : log.level === 'WARN'
                        ? 'text-amber-400'
                        : log.level === 'ERROR'
                        ? 'text-rose-400'
                        : 'text-cyan-400'
                    }`}
                  >
                    [{log.agentName}]
                  </span>
                  <span className="text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed break-words">
                  {log.message}
                </p>
              </div>
            ))}

            {logs.length === 0 && (
              <div className="py-6 text-center text-slate-600 text-xs">
                System telemetry will stream here during execution.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
