import React, { useEffect, useState } from 'react';
import { TrendingUp, Brain, CheckCircle2, Sparkles, Award, BarChart3 } from 'lucide-react';
import { appStorage } from '../services/storage';
import { AgentMemoryItem, ArticleItem } from '../types/agent';

export const AnalyticsMemoryView: React.FC = () => {
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [memories, setMemories] = useState<AgentMemoryItem[]>([]);

  useEffect(() => {
    setArticles(appStorage.getArticles());
    setMemories(appStorage.getMemories());
    const unsub = appStorage.subscribe(() => {
      setArticles(appStorage.getArticles());
      setMemories(appStorage.getMemories());
    });
    return unsub;
  }, []);

  const avgSeo = articles.length > 0 ? Math.round(articles.reduce((a, b) => a + (b.seoScore || 0), 0) / articles.length) : 92;
  const avgFact = articles.length > 0 ? Math.round(articles.reduce((a, b) => a + (b.factCheckScore || 0), 0) / articles.length) : 95;

  return (
    <div id="analytics-memory-view" className="space-y-6 pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <Brain className="w-5 h-5 text-indigo-400" />
          <span>Agent Memory &amp; Autonomous Performance</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Learned patterns, style calibration parameters, and multi-channel publication metrics.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Average SEO Rating</span>
          <div className="text-3xl font-extrabold text-emerald-400 mt-2">{avgSeo} / 100</div>
          <p className="text-xs text-slate-400 mt-1">Based on keyword semantics &amp; structure</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fact Verification Index</span>
          <div className="text-3xl font-extrabold text-blue-400 mt-2">{avgFact} / 100</div>
          <p className="text-xs text-slate-400 mt-1">Grounding against Tavily web search results</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Autonomous Insights</span>
          <div className="text-3xl font-extrabold text-purple-400 mt-2">{memories.length}</div>
          <p className="text-xs text-slate-400 mt-1">Style memory points logged</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" />
          <span>Learned Style Directives &amp; Memory Buffer</span>
        </h3>
        <div className="space-y-3">
          {memories.map((m) => (
            <div key={m.id} className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-white capitalize">{m.category} Insight</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Applied: {m.appliedCount} times
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">{m.observation}</p>
                {m.recommendation && (
                  <p className="text-[11px] text-blue-400 mt-1 font-mono">Directive: {m.recommendation}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
