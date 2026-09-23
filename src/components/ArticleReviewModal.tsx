import React, { useState } from 'react';
import {
  X,
  Send,
  Share2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Code,
  FileText,
  Sparkles,
  RefreshCw,
  Globe,
} from 'lucide-react';
import { Article } from '../types/agent.ts';

interface ArticleReviewModalProps {
  article: Article | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  onPublish: (id: string) => void;
  isActionLoading: boolean;
}

export const ArticleReviewModal: React.FC<ArticleReviewModalProps> = ({
  article,
  onClose,
  onApprove,
  onPublish,
  isActionLoading,
}) => {
  if (!article) return null;

  const [activeTab, setActiveTab] = useState<'CONTENT' | 'HTML' | 'QUALITY' | 'SEO' | 'SOCIAL'>('CONTENT');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/60">
          <div className="space-y-1 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                  article.lifecycleState === 'PUBLISHED' || article.lifecycleState === 'DISTRIBUTED'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : article.lifecycleState === 'APPROVED'
                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {article.lifecycleState}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {article.language} • {article.cleanContent.split(/\s+/).length} words
              </span>
              {article.rewriteCount > 0 && (
                <span className="text-[10px] font-mono text-amber-400 px-1.5 py-0.5 rounded bg-amber-950 border border-amber-800">
                  {article.rewriteCount} Rewrites
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white font-display">
              {article.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-950/30 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('CONTENT')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'CONTENT' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Article Text</span>
          </button>

          <button
            onClick={() => setActiveTab('HTML')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'HTML' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Blogger HTML</span>
          </button>

          <button
            onClick={() => setActiveTab('QUALITY')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'QUALITY' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Quality Audit</span>
          </button>

          <button
            onClick={() => setActiveTab('SEO')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'SEO' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>SEO & Schema</span>
          </button>

          <button
            onClick={() => setActiveTab('SOCIAL')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'SOCIAL' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Social Copies ({article.socialDistributions?.length || 0})</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: ARTICLE CONTENT */}
          {activeTab === 'CONTENT' && (
            <div className="space-y-4">
              {article.image?.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-800 max-h-56">
                  <img
                    src={article.image.imageUrl}
                    alt={article.image.altText}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                {article.cleanContent}
              </div>

              {/* Verified Citations Footnote */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                <span className="font-bold text-slate-400 uppercase font-mono block mb-1">
                  Empirical Sources & External References:
                </span>
                <ul className="space-y-1 font-mono text-[11px] text-cyan-400">
                  {article.externalReferences.map((ref, i) => (
                    <li key={i}>
                      <a href={ref} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
                        <ExternalLink className="w-3 h-3 text-slate-500" />
                        {ref}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: BLOGGER HTML */}
          {activeTab === 'HTML' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Production HTML payload prepared for Blogger API</span>
                <span>{article.bloggerHtml.length} characters</span>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-300 overflow-x-auto max-h-[420px] whitespace-pre-wrap">
                {article.bloggerHtml}
              </pre>
            </div>
          )}

          {/* TAB 3: QUALITY AUDIT */}
          {activeTab === 'QUALITY' && article.qualityReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center font-mono">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500">FACTUAL</div>
                  <div className="text-base font-bold text-emerald-400">
                    {article.qualityReport.scoreBreakdown.factualConsistency}%
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500">SOURCES</div>
                  <div className="text-base font-bold text-cyan-400">
                    {article.qualityReport.scoreBreakdown.sourceSupport}%
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500">READABILITY</div>
                  <div className="text-base font-bold text-indigo-400">
                    {article.qualityReport.scoreBreakdown.grammarReadability}%
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500">SEO STRUCT</div>
                  <div className="text-base font-bold text-purple-400">
                    {article.qualityReport.scoreBreakdown.seoStructure}%
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500">ORIGINALITY</div>
                  <div className="text-base font-bold text-teal-400">
                    {article.qualityReport.scoreBreakdown.originality}%
                  </div>
                </div>
              </div>

              {article.qualityReport.issues.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-amber-400 uppercase font-mono flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Detected Auditor Remarks ({article.qualityReport.issues.length})
                  </span>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {article.qualityReport.issues.map((iss, i) => (
                      <li key={i}>• {iss}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SEO & SCHEMA */}
          {activeTab === 'SEO' && (
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Slug</span>
                <p className="text-cyan-400 font-mono font-semibold">/{article.slug}</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Meta Description ({article.metaDescription.length} chars)</span>
                <p className="text-slate-200">{article.metaDescription}</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Focus Keywords</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {article.focusKeywords.map((k, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-800 font-mono text-[11px]">
                      {k}
                    </span>
                  ))}
                </div>
              </div>

              {article.faq && article.faq.length > 0 && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Structured FAQ Items ({article.faq.length})</span>
                  {article.faq.map((item, i) => (
                    <div key={i} className="border-b border-slate-800/80 pb-2 last:border-0 last:pb-0">
                      <p className="font-semibold text-slate-200">Q: {item.question}</p>
                      <p className="text-slate-400 mt-0.5">A: {item.answer}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SOCIAL DISTRIBUTIONS */}
          {activeTab === 'SOCIAL' && (
            <div className="space-y-3">
              {article.socialDistributions && article.socialDistributions.length > 0 ? (
                article.socialDistributions.map((post, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white uppercase font-mono">{post.platform}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        post.status === 'PUBLISHED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {post.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 whitespace-pre-wrap">{post.content}</p>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No social distributions generated yet. Publish to Blogger to trigger automatic social network delivery.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Action Bar Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            {article.bloggerPost?.url ? (
              <a
                href={article.bloggerPost.url}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <Globe className="w-3.5 h-3.5" />
                Live on Blogger
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span>Not published to Blogger yet</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>

            {article.lifecycleState === 'APPROVED' && (
              <button
                onClick={() => onPublish(article.id)}
                disabled={isActionLoading}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isActionLoading ? 'Publishing...' : 'Publish to Blogger Now'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
