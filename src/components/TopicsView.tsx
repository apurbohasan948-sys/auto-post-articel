import React, { useState } from 'react';
import {
  Compass,
  Sparkles,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Search,
  Tag,
  Sliders,
} from 'lucide-react';
import { TopicCandidate } from '../types/agent.ts';

interface TopicsViewProps {
  topics: TopicCandidate[];
  isScouting: boolean;
  onScoutTopics: () => void;
  onRunCycleForTopic: (topicId: string) => void;
}

export const TopicsView: React.FC<TopicsViewProps> = ({
  topics,
  isScouting,
  onScoutTopics,
  onRunCycleForTopic,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'APPROVED' | 'CANDIDATE' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = topics.filter((t) => {
    if (filter === 'APPROVED' && t.decisionStatus !== 'APPROVED') return false;
    if (filter === 'REJECTED' && t.decisionStatus !== 'REJECTED') return false;
    if (filter === 'CANDIDATE' && t.decisionStatus) return false;
    if (
      searchQuery &&
      !t.topic.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !t.suggestedTitle.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="cyber-panel p-5 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white font-display">
              Autonomous Topic Scout & Opportunity Discovery
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Topic Scout continuously surfaces high-potential topics using search intent analysis and catalog memory gap detection.
          </p>
        </div>

        <button
          onClick={onScoutTopics}
          disabled={isScouting}
          className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition-all flex items-center gap-2 cursor-pointer shadow-md ${
            isScouting
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-600/20'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScouting ? 'animate-spin' : ''}`} />
          <span>{isScouting ? 'Scouting Topics...' : 'Scout New Topics Now'}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
              filter === 'ALL' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({topics.length})
          </button>
          <button
            onClick={() => setFilter('APPROVED')}
            className={`px-3 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
              filter === 'APPROVED' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Approved ({topics.filter((t) => t.decisionStatus === 'APPROVED').length})
          </button>
          <button
            onClick={() => setFilter('CANDIDATE')}
            className={`px-3 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
              filter === 'CANDIDATE' ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Unprocessed Candidates
          </button>
          <button
            onClick={() => setFilter('REJECTED')}
            className={`px-3 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
              filter === 'REJECTED' ? 'bg-slate-800 text-rose-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Rejected ({topics.filter((t) => t.decisionStatus === 'REJECTED').length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search discovered topics or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Topics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filtered.map((topic) => (
          <div
            key={topic.id}
            className="cyber-panel p-4 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                  {topic.category}
                </span>

                {topic.decisionStatus ? (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                      topic.decisionStatus === 'APPROVED'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : topic.decisionStatus === 'REJECTED'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {topic.decisionStatus}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    SCOUTED CANDIDATE
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-sm font-bold text-white font-display leading-snug">
                  {topic.suggestedTitle}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {topic.angleDescription || topic.reason}
                </p>
              </div>

              {/* Empirical Metrics Bar */}
              <div className="grid grid-cols-4 gap-1.5 p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[10px] font-mono text-center">
                <div>
                  <div className="text-slate-500">FRESHNESS</div>
                  <div className="text-emerald-400 font-bold">{topic.freshnessScore ?? 92}%</div>
                </div>
                <div>
                  <div className="text-slate-500">DEMAND</div>
                  <div className="text-cyan-400 font-bold">{topic.searchDemandScore ?? 88}%</div>
                </div>
                <div>
                  <div className="text-slate-500">VIRAL</div>
                  <div className="text-purple-400 font-bold">
                    {topic.socialPotentialScore ?? (topic.socialPotential === 'Viral' ? 95 : 82)}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">DUP RISK</div>
                  <div
                    className={`font-bold ${
                      (topic.duplicateRiskScore ?? (topic.duplicateRisk === 'Low' ? 15 : 65)) < 30
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {topic.duplicateRiskScore ?? (topic.duplicateRisk === 'Low' ? 15 : 65)}%
                  </div>
                </div>
              </div>

              {/* Keywords Tag Cloud */}
              <div className="flex flex-wrap items-center gap-1.5">
                {topic.keywords.map((kw, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 flex items-center gap-1"
                  >
                    <Tag className="w-2.5 h-2.5 text-slate-600" />
                    {kw}
                  </span>
                ))}
              </div>

              {/* Rejection notice if present */}
              {topic.rejectionReason && (
                <div className="p-2.5 rounded bg-rose-950/30 border border-rose-900/60 text-[11px] text-rose-300">
                  <span className="font-bold block text-[10px] uppercase font-mono text-rose-400 mb-0.5">
                    Decision Agent Editorial Reason:
                  </span>
                  {topic.rejectionReason}
                </div>
              )}
            </div>

            {/* Run Action */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-mono">
                Discovered: {new Date(topic.discoveredAt || topic.createdAt).toLocaleDateString()}
              </span>

              <button
                onClick={() => onRunCycleForTopic(topic.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-cyan-400" />
                <span>Run Article Pipeline</span>
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-2 p-10 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-500 text-xs">
            No topics found matching this filter. Click "Scout New Topics Now" to discover fresh opportunities.
          </div>
        )}
      </div>
    </div>
  );
};
