import React, { useState } from 'react';
import {
  Cpu,
  Search,
  Key,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import { AIProviderConfig, SearchProviderConfig } from '../types/agent.ts';

interface ProvidersViewProps {
  aiProviders: AIProviderConfig[];
  searchProviders: SearchProviderConfig[];
  onUpdateAI: (providers: AIProviderConfig[]) => void;
  onUpdateSearch: (providers: SearchProviderConfig[]) => void;
}

export const ProvidersView: React.FC<ProvidersViewProps> = ({
  aiProviders,
  searchProviders,
  onUpdateAI,
  onUpdateSearch,
}) => {
  const [aiList, setAiList] = useState<AIProviderConfig[]>(aiProviders);
  const [searchList, setSearchList] = useState<SearchProviderConfig[]>(searchProviders);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const handleSaveAI = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateAI(aiList);
    setSavedMessage('AI Providers configuration persisted!');
    setTimeout(() => setSavedMessage(null), 3000);
  };

  const handleSaveSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSearch(searchList);
    setSavedMessage('Search Providers configuration persisted!');
    setTimeout(() => setSavedMessage(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="cyber-panel p-5 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white font-display">
              AI & Search Provider Routing Layer
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure OpenRouter, Google Gemini, Custom OpenAI endpoints, and Tavily Web Search with deterministic fallback chains.
          </p>
        </div>

        {savedMessage && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-xs font-mono text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{savedMessage}</span>
          </div>
        )}
      </div>

      {/* 1. AI Providers Section */}
      <div className="cyber-panel p-5 sm:p-6 rounded-xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              AI Model Fallback Chain
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Priority 1 is attempted first; automatically cascades to fallback providers upon timeouts or rate limits.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveAI} className="space-y-4">
          <div className="space-y-3">
            {aiList.map((p, index) => (
              <div
                key={p.id}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-400 font-mono text-xs font-bold flex items-center justify-center border border-cyan-500/30">
                      {p.priority}
                    </span>
                    <span className="text-xs font-bold text-white font-display">{p.name}</span>
                    <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 uppercase">
                      {p.type}
                    </span>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      onChange={(e) => {
                        const updated = [...aiList];
                        updated[index].enabled = e.target.checked;
                        setAiList(updated);
                      }}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                    />
                    <span>Enabled</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-slate-400 font-mono text-[11px]">Default Model</label>
                    <input
                      type="text"
                      value={p.defaultModel}
                      onChange={(e) => {
                        const updated = [...aiList];
                        updated[index].defaultModel = e.target.value;
                        setAiList(updated);
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 font-mono text-[11px]">API Key (or Netlify ENV)</label>
                    <input
                      type="password"
                      value={p.apiKey}
                      onChange={(e) => {
                        const updated = [...aiList];
                        updated[index].apiKey = e.target.value;
                        setAiList(updated);
                      }}
                      placeholder="Stored or pass via Netlify env"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 font-mono text-[11px]">Timeout (ms)</label>
                    <input
                      type="number"
                      value={p.timeoutMs}
                      onChange={(e) => {
                        const updated = [...aiList];
                        updated[index].timeoutMs = parseInt(e.target.value, 10) || 60000;
                        setAiList(updated);
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save AI Providers</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Search Providers Section (Tavily) */}
      <div className="cyber-panel p-5 sm:p-6 rounded-xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-400" />
              Tavily Web Search Integration
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Empirical web search agent powering real citations, factual groundings, and conflict detection.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSearch} className="space-y-4">
          <div className="space-y-3">
            {searchList.map((s, index) => (
              <div
                key={s.id}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                  <span className="text-xs font-bold text-white font-display">{s.name}</span>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) => {
                        const updated = [...searchList];
                        updated[index].enabled = e.target.checked;
                        setSearchList(updated);
                      }}
                      className="rounded bg-slate-900 border-slate-700 text-emerald-500"
                    />
                    <span>Enabled</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-slate-400 font-mono text-[11px]">Tavily API Key</label>
                    <input
                      type="password"
                      value={s.apiKey}
                      onChange={(e) => {
                        const updated = [...searchList];
                        updated[index].apiKey = e.target.value;
                        setSearchList(updated);
                      }}
                      placeholder="tvly-... or TAVILY_API_KEY in Netlify"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 font-mono text-[11px]">Max Sources per Research Query</label>
                    <input
                      type="number"
                      value={s.maxResults}
                      onChange={(e) => {
                        const updated = [...searchList];
                        updated[index].maxResults = parseInt(e.target.value, 10) || 5;
                        setSearchList(updated);
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Search Provider</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
