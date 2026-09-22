import React, { useState } from 'react';
import {
  Search,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Quote,
  Layers,
  Scale,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { ResearchPackage } from '../types/agent.ts';

interface ResearchViewProps {
  researchPackages: Record<string, ResearchPackage>;
}

export const ResearchView: React.FC<ResearchViewProps> = ({ researchPackages = {} }) => {
  const safePackages = researchPackages && typeof researchPackages === 'object' ? researchPackages : {};
  const packageList = Object.values(safePackages).filter(Boolean);
  const [selectedPackageId, setSelectedPackageId] = useState<string>(
    packageList[0]?.id || ''
  );

  const activePackage =
    packageList.find((p) => p.id === selectedPackageId) || packageList[0];

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="cyber-panel p-5 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white font-display">
              Tavily Grounded Research Packages
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Empirical web extraction records. Zero fabricated URLs policy: every source is retrieved via live web search.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-500/30">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Real Source Citations Enforced</span>
        </div>
      </div>

      {packageList.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-500 text-xs">
          No research packages generated yet. Run an autonomous cycle to execute Tavily research.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Research Package Selector (4 cols) */}
          <div className="lg:col-span-4 space-y-2.5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
              Research Dossiers ({packageList.length})
            </h3>
            <div className="space-y-2">
              {packageList.map((pkg) => {
                const isSelected = activePackage?.id === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPackageId(pkg.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 text-cyan-300 border-cyan-500/50 shadow-md'
                        : 'cyber-panel text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold font-display line-clamp-1">
                      {pkg.topic}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{pkg.sources.length} sources verified</span>
                      <span>{new Date(pkg.researchTimestamp).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Research Package Deep Inspector (8 cols) */}
          {activePackage && (
            <div className="lg:col-span-8 space-y-5">
              {/* Summary Dossier */}
              <div className="cyber-panel p-5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800">
                    RESEARCH DOSSIER #{activePackage.id}
                  </span>
                  <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(activePackage.researchTimestamp).toLocaleString()}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white font-display">
                  {activePackage.topic}
                </h3>

                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
                  {activePackage.summary}
                </p>
              </div>

              {/* Verified Sources List */}
              <div className="cyber-panel p-5 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                  Verified External Sources ({activePackage.sources.length})
                </h4>

                <div className="space-y-2.5">
                  {activePackage.sources.map((src, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-100 truncate">
                          {src.title}
                        </div>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-cyan-400 hover:underline truncate block font-mono"
                        >
                          {src.url}
                        </a>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono">
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400">
                          Auth: {src.authorityScore}%
                        </span>
                        {src.publishedDate && (
                          <span className="text-slate-500">{src.publishedDate}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Extracted Facts & Claims */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Facts */}
                <div className="cyber-panel p-4 rounded-xl border border-slate-800 space-y-2.5">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Empirical Grounded Facts ({activePackage.facts.length})
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {activePackage.facts.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Conflicting Views or Claims */}
                <div className="cyber-panel p-4 rounded-xl border border-slate-800 space-y-2.5">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Scale className="w-3.5 h-3.5 text-amber-400" />
                    Detected Nuance & Conflicts ({activePackage.conflicts.length})
                  </h4>
                  {activePackage.conflicts.length > 0 ? (
                    <div className="space-y-2 text-xs">
                      {activePackage.conflicts.map((c, i) => (
                        <div key={i} className="p-2 rounded bg-slate-950 border border-slate-800 text-slate-300">
                          <div className="text-[11px] text-amber-300 font-semibold mb-1">
                            Contrasting Perspectives:
                          </div>
                          <p className="text-[11px] text-slate-400">"{c.statementA}" vs "{c.statementB}"</p>
                          <div className="mt-1 text-[10px] text-slate-500 italic">
                            Analysis: {c.analysis}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-slate-500 text-xs">
                      No conflicting claims detected among sources.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
