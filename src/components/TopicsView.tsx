import React, { useEffect, useState } from 'react';
import { 
  Compass, 
  Search, 
  Sparkles, 
  TrendingUp, 
  ArrowRight, 
  Filter, 
  RefreshCw, 
  Plus, 
  CheckCircle2 
} from 'lucide-react';
import { TopicItem } from '../types/agent';
import { appStorage } from '../services/storage';
import { TopicScoutAgent } from '../agents/TopicScoutAgent';

interface TopicsViewProps {
  onSelectTopicForPipeline?: (topic: TopicItem) => void;
}

export const TopicsView: React.FC<TopicsViewProps> = ({ onSelectTopicForPipeline }) => {
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [nicheInput, setNicheInput] = useState('AI Automation & Agent Swarms');
  const [isScouting, setIsScouting] = useState(false);
  const [filterNiche, setFilterNiche] = useState<string>('all');

  const refreshTopics = () => {
    setTopics(appStorage.getTopics());
  };

  useEffect(() => {
    refreshTopics();
    const unsub = appStorage.subscribe(() => {
      refreshTopics();
    });
    return unsub;
  }, []);

  const handleScout = async () => {
    setIsScouting(true);
    try {
      await TopicScoutAgent.discoverTopics(nicheInput);
      refreshTopics();
    } finally {
      setIsScouting(false);
    }
  };

  const filtered = filterNiche === 'all' 
    ? topics 
    : topics.filter(t => t.niche.toLowerCase().includes(filterNiche.toLowerCase()));

  return (
    <div id="topics-view" className="space-y-6 pb-12">
      {/* Top Header & Scout Generator */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Compass className="w-5 h-5 text-blue-400" />
              <span>Trending Topic Scout Agent</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Autonomous agent scouting high-intent, low-competition keywords ready for multi-channel publishing.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={nicheInput}
            onChange={(e) => setNicheInput(e.target.value)}
            placeholder="Enter niche or domain (e.g. Autonomous AI, Solar Energy, FinTech)..."
            className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleScout}
            disabled={isScouting}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScouting ? 'animate-spin' : ''}`} />
            <span>{isScouting ? 'Scouting Topics...' : 'Scout New Topics'}</span>
          </button>
        </div>
      </div>

      {/* Topic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((topic) => (
          <div
            key={topic.id}
            id={`topic-card-${topic.id}`}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="px-2 py-0.5 rounded font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {topic.niche}
                </span>
                <span className="font-bold text-emerald-400">{topic.score}/100 Potential</span>
              </div>

              <h3 className="font-bold text-sm text-white mt-1 leading-snug line-clamp-2">
                {topic.title}
              </h3>

              <div className="grid grid-cols-3 gap-2 mt-4 p-3 bg-slate-800/50 rounded-xl text-center text-xs">
                <div>
                  <div className="text-[10px] text-slate-400">Search Vol</div>
                  <div className="font-semibold text-white mt-0.5">{topic.searchVolume}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Competition</div>
                  <div className="font-semibold text-white mt-0.5">{topic.competition}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Growth</div>
                  <div className="font-semibold text-emerald-400 mt-0.5">{topic.trendGrowth}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-3">
                {topic.keywords.map((kw) => (
                  <span key={kw} className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    #{kw}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 capitalize">{topic.status}</span>
              {onSelectTopicForPipeline && (
                <button
                  onClick={() => onSelectTopicForPipeline(topic)}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                >
                  <span>Generate Article</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
