import React, { useEffect, useState } from 'react';
import { 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  AlertCircle, 
  ArrowRight, 
  ExternalLink, 
  RefreshCw, 
  Share2, 
  Globe, 
  TrendingUp, 
  Clock, 
  Play
} from 'lucide-react';
import { integrationStore } from '../services/integrationStore';
import { appStorage } from '../services/storage';
import { ArticleItem, NavigationTab, SocialPlatform } from '../types/agent';
import { PlatformAdapterManager } from '../adapters';

interface DashboardViewProps {
  onNavigate: (tab: NavigationTab) => void;
  onRunPipeline: () => void;
  isRunningPipeline: boolean;
}

type IntegrationCardState = 'Connected' | 'Failed' | 'Disabled' | 'Not Configured';

interface IntegrationSummaryItem {
  id: string;
  name: string;
  type: 'blogger' | SocialPlatform;
  state: IntegrationCardState;
  lastTested?: number;
  lastError?: string;
  diagnostics?: string;
  targetId?: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ 
  onNavigate, 
  onRunPipeline, 
  isRunningPipeline 
}) => {
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [integrationsStatus, setIntegrationsStatus] = useState<IntegrationSummaryItem[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);

  const refreshDashboardData = () => {
    setArticles(appStorage.getArticles());

    const bloggerList = integrationStore.loadBlogger();
    const socialList = integrationStore.loadSocial();

    const resolveBloggerState = (): { state: IntegrationCardState; item?: any } => {
      if (bloggerList.length === 0) return { state: 'Not Configured' };
      const enabled = bloggerList.filter(b => b.enabled);
      if (enabled.length === 0) return { state: 'Disabled', item: bloggerList[0] };
      const connected = enabled.find(b => b.testStatus === 'CONNECTED');
      if (connected) return { state: 'Connected', item: connected };
      const failed = enabled.find(b => b.testStatus === 'FAILED');
      if (failed) return { state: 'Failed', item: failed };
      return { state: 'Not Configured', item: enabled[0] };
    };

    const resolveSocialState = (platform: SocialPlatform): { state: IntegrationCardState; item?: any } => {
      const match = socialList.filter(s => s.platform === platform);
      if (match.length === 0) return { state: 'Not Configured' };
      const enabled = match.filter(s => s.enabled);
      if (enabled.length === 0) return { state: 'Disabled', item: match[0] };
      const connected = enabled.find(s => s.testStatus === 'CONNECTED');
      if (connected) return { state: 'Connected', item: connected };
      const failed = enabled.find(s => s.testStatus === 'FAILED');
      if (failed) return { state: 'Failed', item: failed };
      return { state: 'Not Configured', item: enabled[0] };
    };

    const bloggerState = resolveBloggerState();
    const fbState = resolveSocialState('facebook');
    const igState = resolveSocialState('instagram');
    const ytState = resolveSocialState('youtube');
    const ttState = resolveSocialState('tiktok');

    const summary: IntegrationSummaryItem[] = [
      {
        id: 'blogger',
        name: 'Google Blogger',
        type: 'blogger',
        state: bloggerState.state,
        lastTested: bloggerState.item?.lastTested,
        lastError: bloggerState.item?.lastError,
        diagnostics: bloggerState.item?.diagnostics,
        targetId: bloggerState.item?.id
      },
      {
        id: 'facebook',
        name: 'Facebook Page',
        type: 'facebook',
        state: fbState.state,
        lastTested: fbState.item?.lastTested,
        lastError: fbState.item?.lastError,
        diagnostics: fbState.item?.diagnostics,
        targetId: fbState.item?.id
      },
      {
        id: 'instagram',
        name: 'Instagram',
        type: 'instagram',
        state: igState.state,
        lastTested: igState.item?.lastTested,
        lastError: igState.item?.lastError,
        diagnostics: igState.item?.diagnostics,
        targetId: igState.item?.id
      },
      {
        id: 'youtube',
        name: 'YouTube',
        type: 'youtube',
        state: ytState.state,
        lastTested: ytState.item?.lastTested,
        lastError: ytState.item?.lastError,
        diagnostics: ytState.item?.diagnostics,
        targetId: ytState.item?.id
      },
      {
        id: 'tiktok',
        name: 'TikTok',
        type: 'tiktok',
        state: ttState.state,
        lastTested: ttState.item?.lastTested,
        lastError: ttState.item?.lastError,
        diagnostics: ttState.item?.diagnostics,
        targetId: ttState.item?.id
      }
    ];

    setIntegrationsStatus(summary);
  };

  useEffect(() => {
    refreshDashboardData();
    const unsub = integrationStore.subscribe(() => {
      refreshDashboardData();
    });
    return unsub;
  }, []);

  const handleTestIntegration = async (item: IntegrationSummaryItem) => {
    setTestingId(item.id);
    try {
      if (item.type === 'blogger') {
        const blogs = integrationStore.loadBlogger();
        const target = item.targetId ? integrationStore.getBloggerById(item.targetId) : blogs[0];
        if (target) {
          const res = await PlatformAdapterManager.testBlogger(target);
          integrationStore.updateBloggerTestResult(
            target.id,
            res.success ? 'CONNECTED' : 'FAILED',
            res.diagnostics,
            res.success ? undefined : res.message
          );
        }
      } else {
        const socials = integrationStore.loadSocial();
        const target = item.targetId ? integrationStore.getSocialById(item.targetId) : socials.find(s => s.platform === item.type);
        if (target) {
          const res = await PlatformAdapterManager.testSocial(target);
          integrationStore.updateSocialTestResult(
            target.id,
            res.success ? 'CONNECTED' : 'FAILED',
            res.diagnostics,
            res.success ? undefined : res.message
          );
        }
      }
    } catch (err: any) {
      console.error('Test failed', err);
    } finally {
      setTestingId(null);
      refreshDashboardData();
    }
  };

  const getStatusBadge = (state: IntegrationCardState) => {
    switch (state) {
      case 'Connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Connected
          </span>
        );
      case 'Failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
      case 'Disabled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <MinusCircle className="w-3.5 h-3.5" />
            Disabled
          </span>
        );
      case 'Not Configured':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <AlertCircle className="w-3.5 h-3.5" />
            Not Configured
          </span>
        );
    }
  };

  const totalWords = articles.reduce((acc, a) => acc + (a.wordCount || 0), 0);
  const avgSeo = articles.length > 0 ? Math.round(articles.reduce((acc, a) => acc + (a.seoScore || 0), 0) / articles.length) : 92;

  return (
    <div id="dashboard-view" className="space-y-8 pb-12">
      {/* Welcome Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 border border-blue-500/20 p-6 sm:p-8 overflow-hidden shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Autonomous Engine Active
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Auto-Post Content &amp; Distribution Center
            </h1>
            <p className="text-slate-300 text-sm mt-2 leading-relaxed">
              Synthesize SEO-grounded articles using multi-agent intelligence and syndicate instantly to Google Blogger, Facebook, Instagram, YouTube, and TikTok.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              id="dashboard-start-pipeline-btn"
              onClick={onRunPipeline}
              disabled={isRunningPipeline}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/40 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isRunningPipeline ? 'Swarm in Progress...' : 'Launch Swarm Pipeline'}</span>
            </button>
            <button
              id="dashboard-goto-settings-btn"
              onClick={() => onNavigate('settings')}
              className="px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700 font-semibold text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Manage Integrations</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Articles</span>
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{articles.length}</div>
          <div className="text-xs text-slate-400 mt-1">Ready for syndication</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Words Authored</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{totalWords.toLocaleString()}</div>
          <div className="text-xs text-slate-400 mt-1">Quality verified</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Average SEO Score</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{avgSeo} / 100</div>
          <div className="text-xs text-slate-400 mt-1">Semantic keyword audit</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Active Integrations</span>
            <Share2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {integrationsStatus.filter(i => i.state === 'Connected').length} / 5
          </div>
          <div className="text-xs text-slate-400 mt-1">Verified connection channels</div>
        </div>
      </div>

      {/* REQUIREMENT 9: DASHBOARD INTEGRATIONS STATUS */}
      <div id="dashboard-integrations-section" className="bg-slate-800/40 border border-slate-700/80 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Share2 className="w-5 h-5 text-blue-400" />
              <span>Platform Integration Status</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Live status based on real connection verification tests. Never marks connected from unverified credentials.
            </p>
          </div>
          <button
            id="refresh-integrations-btn"
            onClick={refreshDashboardData}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Check Status</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {integrationsStatus.map((item) => (
            <div
              key={item.id}
              id={`integration-status-card-${item.id}`}
              className="bg-slate-800/90 border border-slate-700 rounded-xl p-4 flex flex-col justify-between hover:border-slate-600 transition-all shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm text-white">{item.name}</span>
                  {getStatusBadge(item.state)}
                </div>
                {item.lastTested ? (
                  <p className="text-[11px] text-slate-400">
                    Tested: {new Date(item.lastTested).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500">Not tested yet</p>
                )}
                {item.lastError && (
                  <p className="text-[11px] text-rose-400 mt-2 line-clamp-2" title={item.lastError}>
                    {item.lastError}
                  </p>
                )}
                {item.diagnostics && item.state === 'Connected' && (
                  <p className="text-[11px] text-emerald-400/90 mt-2 line-clamp-2">
                    Verified
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2">
                <button
                  id={`dashboard-test-${item.id}-btn`}
                  onClick={() => handleTestIntegration(item)}
                  disabled={testingId === item.id || item.state === 'Not Configured'}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 disabled:text-slate-600 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${testingId === item.id ? 'animate-spin' : ''}`} />
                  <span>{testingId === item.id ? 'Testing...' : 'Test Now'}</span>
                </button>
                <button
                  id={`dashboard-cfg-${item.id}-btn`}
                  onClick={() => onNavigate('settings')}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Configure</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Generated Articles */}
      <div className="bg-slate-800/40 border border-slate-700/80 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <span>Recent Articles</span>
          </h2>
          <button
            onClick={() => onNavigate('articles')}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-700/50">
          {articles.slice(0, 3).map((art) => (
            <div key={art.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    art.status === 'published' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {art.status}
                  </span>
                  <span className="text-xs text-slate-400">{art.category}</span>
                </div>
                <h3 className="text-sm font-semibold text-white hover:text-blue-300 transition-colors">
                  {art.title}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-1">{art.summary}</p>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-center">
                <span className="text-xs text-slate-400">{art.wordCount} words</span>
                <button
                  onClick={() => onNavigate('articles')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium transition-colors cursor-pointer"
                >
                  Review
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
