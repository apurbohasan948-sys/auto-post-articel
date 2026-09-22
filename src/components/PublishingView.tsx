import React, { useEffect, useState } from 'react';
import { 
  Share2, 
  Globe, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink, 
  RefreshCw, 
  ArrowRight,
  Send,
  Sliders
} from 'lucide-react';
import { integrationStore } from '../services/integrationStore';
import { appStorage } from '../services/storage';
import { ArticleItem, BloggerIntegration, NavigationTab, SocialIntegration } from '../types/agent';
import { BloggerPublisherAgent } from '../agents/BloggerPublisherAgent';
import { SocialDistributionAgent } from '../agents/SocialDistributionAgent';

interface PublishingViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const PublishingView: React.FC<PublishingViewProps> = ({ onNavigate }) => {
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [bloggerAccounts, setBloggerAccounts] = useState<BloggerIntegration[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialIntegration[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string>('');
  const [publishing, setPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const refreshData = () => {
    const arts = appStorage.getArticles();
    setArticles(arts);
    if (arts.length > 0 && !selectedArticleId) {
      setSelectedArticleId(arts[0].id);
    }
    setBloggerAccounts(integrationStore.loadBlogger());
    setSocialAccounts(integrationStore.loadSocial());
  };

  useEffect(() => {
    refreshData();
    const unsubApp = appStorage.subscribe(refreshData);
    const unsubInteg = integrationStore.subscribe(refreshData);
    return () => {
      unsubApp();
      unsubInteg();
    };
  }, []);

  const handleBroadcast = async () => {
    const target = articles.find(a => a.id === selectedArticleId);
    if (!target) return;

    setPublishing(true);
    setStatusMessage(null);

    try {
      const bRes = await BloggerPublisherAgent.publish(target);
      const sRes = await SocialDistributionAgent.distribute(target);

      const totalSuccess = bRes.successful + sRes.successful;
      const totalAttempted = bRes.attempted + sRes.attempted;

      setStatusMessage(
        `Syndication finished: ${totalSuccess}/${totalAttempted} destination endpoints completed successfully.`
      );
    } catch (e: any) {
      setStatusMessage(`Syndication error: ${e?.message}`);
    } finally {
      setPublishing(false);
      refreshData();
    }
  };

  const enabledBloggerCount = bloggerAccounts.filter(b => b.enabled).length;
  const enabledSocialCount = socialAccounts.filter(s => s.enabled).length;

  return (
    <div id="publishing-view" className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-400" />
            <span>Multi-Channel Syndication Center</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Simultaneously push articles to Google Blogger, Facebook, Instagram, YouTube, and TikTok channels with platform-optimized payloads.
          </p>
        </div>
        <button
          onClick={() => onNavigate('settings')}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Manage Endpoints</span>
        </button>
      </div>

      {statusMessage && (
        <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Broadcast Control Box */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white mb-4">Manual Multi-Channel Broadcast</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Select Article to Syndicate
            </label>
            <select
              value={selectedArticleId}
              onChange={(e) => setSelectedArticleId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {articles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.wordCount} words)
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleBroadcast}
            disabled={publishing || articles.length === 0}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Send className={`w-3.5 h-3.5 ${publishing ? 'animate-bounce' : ''}`} />
            <span>{publishing ? 'Broadcasting...' : 'Broadcast to All Enabled Channels'}</span>
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>Blogger: <strong className="text-white">{enabledBloggerCount}</strong> active</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5 text-purple-400" />
            <span>Social: <strong className="text-white">{enabledSocialCount}</strong> active</span>
          </span>
        </div>
      </div>

      {/* Distribution Channels Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Blogger Accounts */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" />
            <span>Connected Blogger Blogs ({bloggerAccounts.length})</span>
          </h4>
          {bloggerAccounts.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No Blogger accounts configured in Settings.</p>
          ) : (
            <div className="space-y-3">
              {bloggerAccounts.map((b) => (
                <div key={b.id} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-xs text-white">{b.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">Blog ID: {b.blogId}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    b.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {b.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Social Accounts */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Share2 className="w-4 h-4 text-purple-400" />
            <span>Connected Social Media Channels ({socialAccounts.length})</span>
          </h4>
          {socialAccounts.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No Social media channels configured in Settings.</p>
          ) : (
            <div className="space-y-3">
              {socialAccounts.map((s) => (
                <div key={s.id} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-xs text-white capitalize">{s.platform}: {s.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">Status: {s.testStatus}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    s.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {s.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
