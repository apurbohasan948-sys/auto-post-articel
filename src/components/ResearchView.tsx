import React, { useEffect, useState } from 'react';
import { BookOpen, ExternalLink, Sparkles, CheckCircle2, Search, ArrowRight } from 'lucide-react';
import { ResearchData } from '../types/agent';
import { appStorage } from '../services/storage';

export const ResearchView: React.FC = () => {
  const [researchList, setResearchList] = useState<ResearchData[]>([]);
  const [selectedResearch, setSelectedResearch] = useState<ResearchData | null>(null);

  const refreshResearch = () => {
    const list = appStorage.getResearch();
    setResearchList(list);
    if (list.length > 0 && !selectedResearch) {
      setSelectedResearch(list[0]);
    }
  };

  useEffect(() => {
    refreshResearch();
    const unsub = appStorage.subscribe(() => {
      refreshResearch();
    });
    return unsub;
  }, []);

  return (
    <div id="research-view" className="space-y-6 pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-400" />
          <span>Deep Research Agent Citations</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Grounded facts, verified source citations, and structured outlines gathered prior to drafting.
        </p>
      </div>

      {researchList.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No research briefs synthesized yet</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            When you run the pipeline, the Research Agent analyzes topics and builds factual dossiers.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-3">
            {researchList.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedResearch(item)}
                className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                  selectedResearch?.id === item.id
                    ? 'bg-blue-600/15 border-blue-500/40'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">
                  Dossier
                </span>
                <h4 className="font-bold text-sm text-white mt-1 line-clamp-2">
                  {item.topicTitle}
                </h4>
                <div className="text-xs text-slate-400 mt-2">
                  {item.sources.length} sources cited
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-8">
            {selectedResearch && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div>
                  <span className="text-xs font-semibold text-blue-400">Research Brief</span>
                  <h3 className="text-xl font-bold text-white mt-1">{selectedResearch.topicTitle}</h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                    {selectedResearch.summary}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Verified Key Facts
                  </h4>
                  <ul className="space-y-2">
                    {selectedResearch.keyFacts.map((fact, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-slate-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{fact}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Web &amp; Grounded Sources
                  </h4>
                  <div className="space-y-2">
                    {selectedResearch.sources.map((src, i) => (
                      <div key={i} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{src.title}</span>
                          {src.url && (
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-400 hover:underline flex items-center gap-1 text-[11px]"
                            >
                              <span>Visit Source</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <p className="text-slate-400 mt-1 line-clamp-2">{src.snippet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
