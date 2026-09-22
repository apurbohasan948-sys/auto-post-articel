import React, { useEffect, useState } from 'react';
import { 
  FileText, 
  ExternalLink, 
  Share2, 
  Globe, 
  CheckCircle2, 
  RefreshCw, 
  Eye, 
  Edit3, 
  Sparkles, 
  Trash2,
  Calendar,
  Clock
} from 'lucide-react';
import { ArticleItem } from '../types/agent';
import { appStorage } from '../services/storage';
import { BloggerPublisherAgent } from '../agents/BloggerPublisherAgent';
import { SocialDistributionAgent } from '../agents/SocialDistributionAgent';
import { integrationStore } from '../services/integrationStore';

export const ArticlesView: React.FC = () => {
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<ArticleItem | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  const refreshArticles = () => {
    const list = appStorage.getArticles();
    setArticles(list);
    if (list.length > 0 && !selectedArticle) {
      setSelectedArticle(list[0]);
    } else if (selectedArticle) {
      const updated = list.find(a => a.id === selectedArticle.id);
      if (updated) setSelectedArticle(updated);
    }
  };

  useEffect(() => {
    refreshArticles();
    const unsub = appStorage.subscribe(() => {
      refreshArticles();
    });
    return unsub;
  }, []);

  const handlePublishBlogger = async (art: ArticleItem) => {
    setPublishingId(art.id);
    setPublishMessage(null);
    try {
      const res = await BloggerPublisherAgent.publish(art);
      if (res.successful > 0) {
        setPublishMessage(`Successfully published to ${res.successful} Blogger account(s)!`);
      } else if (res.attempted === 0) {
        setPublishMessage('No enabled Blogger accounts found in Settings -> Integrations -> Blogger.');
      } else {
        setPublishMessage('Failed to publish to Blogger. Check credentials in Settings.');
      }
    } catch (e: any) {
      setPublishMessage(`Error: ${e?.message}`);
    } finally {
      setPublishingId(null);
      refreshArticles();
    }
  };

  const handleDistributeSocial = async (art: ArticleItem) => {
    setPublishingId(art.id);
    setPublishMessage(null);
    try {
      const res = await SocialDistributionAgent.distribute(art);
      if (res.successful > 0) {
        setPublishMessage(`Successfully distributed to ${res.successful} social account(s)!`);
      } else if (res.attempted === 0) {
        setPublishMessage('No enabled Social integrations found in Settings -> Integrations -> Social Media.');
      } else {
        setPublishMessage('Failed to distribute to social channels. Check API keys in Settings.');
      }
    } catch (e: any) {
      setPublishMessage(`Error: ${e?.message}`);
    } finally {
      setPublishingId(null);
      refreshArticles();
    }
  };

  const handleDeleteArticle = (id: string, title: string) => {
    if (window.confirm(`Delete article "${title}"?`)) {
      appStorage.deleteArticle(id);
      refreshArticles();
    }
  };

  return (
    <div id="articles-view" className="space-y-6 pb-12">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <span>Autonomous Articles &amp; Content Library</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Review AI-crafted drafts, factual audits, and trigger instant publishing to connected Blogger blogs and Social networks.
          </p>
        </div>
        <div className="text-xs text-slate-400">
          Total: <span className="font-semibold text-white">{articles.length}</span> articles
        </div>
      </div>

      {publishMessage && (
        <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 flex items-center justify-between">
          <span>{publishMessage}</span>
          <button onClick={() => setPublishMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {articles.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No articles generated yet</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Launch the agent swarm pipeline from the top header to discover topics and author complete articles.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Article List Sidebar */}
          <div className="lg:col-span-4 space-y-3">
            {articles.map((art) => {
              const isSelected = selectedArticle?.id === art.id;
              return (
                <div
                  key={art.id}
                  id={`article-card-${art.id}`}
                  onClick={() => setSelectedArticle(art)}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500/40 shadow-sm'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="font-semibold text-blue-400">{art.category}</span>
                    <span className="text-slate-400">{art.wordCount} words</span>
                  </div>
                  <h4 className="font-bold text-sm text-white line-clamp-2 leading-snug">
                    {art.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800/80 text-[11px]">
                    <span className={`px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${
                      art.status === 'published' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {art.status}
                    </span>
                    <span className="text-slate-400">SEO: {art.seoScore}%</span>
                    <span className="text-slate-400">Fact: {art.factCheckScore}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Article Detail & Preview */}
          <div className="lg:col-span-8">
            {selectedArticle && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                {/* Header & Syndication Triggers */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {selectedArticle.category}
                      </span>
                      <span className="text-xs text-slate-400">
                        {selectedArticle.wordCount} words (~{selectedArticle.readingTimeMinutes} min read)
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-tight">
                      {selectedArticle.title}
                    </h2>
                  </div>

                  {/* Syndication Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      id="publish-blogger-action-btn"
                      onClick={() => handlePublishBlogger(selectedArticle)}
                      disabled={publishingId === selectedArticle.id}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Publish to enabled Blogger accounts"
                    >
                      <Globe className="w-3.5 h-3.5 text-blue-400" />
                      <span>{publishingId === selectedArticle.id ? 'Publishing...' : 'Push to Blogger'}</span>
                    </button>

                    <button
                      id="publish-social-action-btn"
                      onClick={() => handleDistributeSocial(selectedArticle)}
                      disabled={publishingId === selectedArticle.id}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Distribute to Facebook, Instagram, YouTube, TikTok"
                    >
                      <Share2 className="w-3.5 h-3.5 text-purple-400" />
                      <span>Syndicate Social</span>
                    </button>

                    <button
                      onClick={() => handleDeleteArticle(selectedArticle.id, selectedArticle.title)}
                      className="p-2 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                      title="Delete Article"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Published URL Status (if syndicated) */}
                {selectedArticle.publishedUrls && Object.keys(selectedArticle.publishedUrls).length > 0 && (
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs space-y-1">
                    <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Live Syndication Endpoints:</span>
                    </div>
                    <div className="flex flex-wrap gap-3 pt-1">
                      {selectedArticle.publishedUrls.blogger && (
                        <a
                          href={selectedArticle.publishedUrls.blogger}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <span>Blogger Post</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {selectedArticle.publishedUrls.facebook && (
                        <a
                          href={selectedArticle.publishedUrls.facebook}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <span>Facebook Post</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {selectedArticle.publishedUrls.instagram && (
                        <a
                          href={selectedArticle.publishedUrls.instagram}
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-400 hover:underline flex items-center gap-1"
                        >
                          <span>Instagram Post</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Quality & Fact-Check Audit */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-800/60 border border-slate-700/80 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-300">SEO Audit</span>
                      <span className="text-xs font-bold text-emerald-400">{selectedArticle.seoScore}/100</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selectedArticle.tags.map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-800/60 border border-slate-700/80 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-300">Fact-Check Audit</span>
                      <span className="text-xs font-bold text-emerald-400">{selectedArticle.factCheckScore}/100</span>
                    </div>
                    <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
                      {selectedArticle.factCheckNotes?.slice(0, 2).map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Article Content Render */}
                <div className="prose prose-invert max-w-none bg-slate-950/40 p-6 rounded-xl border border-slate-800/80 text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                  {selectedArticle.content}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
