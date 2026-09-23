import React, { useState } from 'react';
import {
  FileText,
  Send,
  Share2,
  ExternalLink,
  ShieldCheck,
  Search,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { Article } from '../types/agent.ts';

interface ArticlesViewProps {
  articles: Article[];
  onSelectArticle: (article: Article) => void;
  onPublishArticle: (id: string) => void;
}

export const ArticlesView: React.FC<ArticlesViewProps> = ({
  articles = [],
  onSelectArticle,
  onPublishArticle,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'APPROVED' | 'PUBLISHED' | 'DISTRIBUTED' | 'FAILED'>('ALL');
  const [search, setSearch] = useState('');

  const safeArticles = Array.isArray(articles) ? articles : [];
  const filtered = safeArticles.filter((a) => {
    if (!a) return false;
    if (filter !== 'ALL' && a.lifecycleState !== filter) return false;
    if (
      search &&
      !(a.title || '').toLowerCase().includes(search.toLowerCase()) &&
      !(a.slug || '').toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="cyber-panel p-5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white font-display">
              Autonomous Article Management & Quality Audits
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Review generated drafts, verify empirical claims, audit Blogger HTML payloads, and approve distributions.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
          Catalog Total: <span className="text-white font-bold">{safeArticles.length}</span> articles
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs overflow-x-auto">
          {(['ALL', 'APPROVED', 'PUBLISHED', 'DISTRIBUTED', 'FAILED'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                filter === f ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              {f} ({f === 'ALL' ? articles.length : articles.filter((a) => a.lifecycleState === f).length})
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search article titles or slugs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Articles Table / Cards */}
      <div className="space-y-3">
        {filtered.map((art) => (
          <div
            key={art.id}
            className="cyber-panel p-4 sm:p-5 rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                    art.lifecycleState === 'PUBLISHED' || art.lifecycleState === 'DISTRIBUTED'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : art.lifecycleState === 'APPROVED'
                      ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {art.lifecycleState}
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  {art.language}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400 font-mono text-[11px]">
                  {art.cleanContent.split(/\s+/).length} words
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-500 font-mono text-[11px]">
                  {new Date(art.createdAt).toLocaleDateString()}
                </span>
              </div>

              <h3
                onClick={() => onSelectArticle(art)}
                className="text-base font-bold text-white hover:text-cyan-300 transition-colors cursor-pointer font-display leading-snug"
              >
                {art.title}
              </h3>

              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {art.metaDescription}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono text-slate-400">
                {art.qualityReport && (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Quality: {art.qualityReport.scoreBreakdown.factualConsistency}%
                  </span>
                )}
                {art.bloggerPost?.url && (
                  <a
                    href={art.bloggerPost.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-cyan-400 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Blogger Live
                  </a>
                )}
                {art.socialDistributions && art.socialDistributions.length > 0 && (
                  <span className="flex items-center gap-1 text-purple-400">
                    <Share2 className="w-3.5 h-3.5" />
                    {art.socialDistributions.filter((s) => s.status === 'PUBLISHED').length} Networks
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0 justify-end">
              <button
                onClick={() => onSelectArticle(art)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Full Review</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
              </button>

              {art.lifecycleState === 'APPROVED' && (
                <button
                  onClick={() => onPublishArticle(art.id)}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish</span>
                </button>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="p-12 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-500 text-xs">
            No articles match this criteria.
          </div>
        )}
      </div>
    </div>
  );
};
