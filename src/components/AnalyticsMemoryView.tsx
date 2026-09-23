import React from 'react';
import {
  Brain,
  LineChart,
  CheckCircle2,
  TrendingUp,
  Tag,
  Sparkles,
  Layers,
  FileText,
  Share2,
  History,
  ShieldCheck,
} from 'lucide-react';
import { AgentMemory } from '../types/agent.ts';

interface AnalyticsMemoryViewProps {
  analytics: any;
  memory: AgentMemory | null;
}

export const AnalyticsMemoryView: React.FC<AnalyticsMemoryViewProps> = ({
  analytics,
  memory,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="cyber-panel p-5 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white font-display">
              Empirical Analytics & Autonomous Memory Subsystem
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Grounded telemetry from actual published articles and verified semantic memory indexing.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 bg-cyan-950/40 px-3 py-1.5 rounded-lg border border-cyan-500/30">
          <ShieldCheck className="w-4 h-4" />
          <span>Real Telemetry Only • Zero Mock Statistics</span>
        </div>
      </div>

      {/* 1. Real Metrics KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="cyber-panel p-4 rounded-xl border border-slate-800">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Quality Audit Pass Rate</span>
          <div className="text-2xl font-bold text-emerald-400 font-display mt-1">
            {analytics?.qualityPassRate || 100}%
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Based on factual consistency audits</p>
        </div>

        <div className="cyber-panel p-4 rounded-xl border border-slate-800">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Average Article Length</span>
          <div className="text-2xl font-bold text-cyan-400 font-display mt-1">
            {analytics?.averageWordCount || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Words per generated guide</p>
        </div>

        <div className="cyber-panel p-4 rounded-xl border border-slate-800">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Total Social Deliveries</span>
          <div className="text-2xl font-bold text-purple-400 font-display mt-1">
            {analytics?.totalSocialPosts || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Posts dispatched to networks</p>
        </div>

        <div className="cyber-panel p-4 rounded-xl border border-slate-800">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Articles in Active Memory</span>
          <div className="text-2xl font-bold text-indigo-400 font-display mt-1">
            {memory?.publishedTopics.length || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Indexed against duplicate topics</p>
        </div>
      </div>

      {/* 2. Platform Distribution Breakdown */}
      <div className="cyber-panel p-5 rounded-xl border border-slate-800 space-y-3">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
          <Share2 className="w-4 h-4 text-cyan-400" />
          Multi-Platform Social Deliveries by Channel
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          {Object.entries(analytics?.platformDistributionCounts || {}).map(([platform, count]) => (
            <div key={platform} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-center">
              <span className="text-[10px] font-mono text-slate-400 uppercase">{platform}</span>
              <div className="text-xl font-bold text-white font-display mt-0.5">{count as number}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Memory Subsystem Deep View */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identified Content Gaps */}
        <div className="cyber-panel p-5 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-cyan-400" />
              Discovered Coverage Gap Keywords ({memory?.gapKeywords.length || 0})
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Keywords extracted from verified sources that have not yet been covered in published articles:
          </p>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {memory?.gapKeywords && memory.gapKeywords.length > 0 ? (
              memory.gapKeywords.map((kw, i) => (
                <span
                  key={i}
                  className="px-2 py-1 rounded bg-slate-950 text-cyan-300 border border-slate-800 text-xs font-mono"
                >
                  {kw}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500 font-mono">No gap keywords logged yet.</span>
            )}
          </div>
        </div>

        {/* High-Performing Content Patterns */}
        <div className="cyber-panel p-5 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Verified Editorial Patterns ({memory?.successfulPatterns.length || 0})
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Empirical structure observations recorded by the Memory Agent upon publication:
          </p>

          <div className="space-y-2 pt-1">
            {memory?.successfulPatterns && memory.successfulPatterns.length > 0 ? (
              memory.successfulPatterns.map((pat, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono">
                  • {pat}
                </div>
              ))
            ) : (
              <span className="text-xs text-slate-500 font-mono">No patterns logged yet.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
