import React, { useState } from 'react';
import { Sparkles, Search, Send, CheckCircle2, AlertCircle, RefreshCw, Cpu } from 'lucide-react';
import { AIProviderConfig, SearchProviderConfig } from '../../types/agent.ts';
import { apiClient } from '../../services/apiClient.ts';

interface PlaygroundTabProps {
  aiProviders: AIProviderConfig[];
  searchProviders: SearchProviderConfig[];
}

export const PlaygroundTab: React.FC<PlaygroundTabProps> = ({ aiProviders, searchProviders }) => {
  const [mode, setMode] = useState<'ai' | 'search'>('search');
  const [selectedAiId, setSelectedAiId] = useState<string>(aiProviders[0]?.id || '');
  const [selectedSearchId, setSelectedSearchId] = useState<string>(searchProviders[0]?.id || 'search_tavily');

  // Input states
  const [searchQuery, setSearchQuery] = useState('latest breakthrough in autonomous agent architectures');
  const [aiPrompt, setAiPrompt] = useState('Explain the difference between deterministic state machines and reactive autonomous agents in 3 bullet points.');

  // Execution states
  const [loading, setLoading] = useState(false);
  const [searchOutput, setSearchOutput] = useState<any>(null);
  const [aiOutput, setAiOutput] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRunSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setSearchOutput(null);

    const targetProvider = searchProviders.find((p) => p.id === selectedSearchId) || searchProviders[0];

    try {
      const res = await apiClient.testSearchProvider({
        providerId: targetProvider?.id,
        provider: targetProvider,
        query: searchQuery,
        depth: targetProvider?.searchDepth || 'advanced',
        maxResults: targetProvider?.maxResults || 5,
      });

      if (res.success) {
        setSearchOutput(res);
      } else {
        setErrorMsg(res.error || 'Search query failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAi = async () => {
    if (!aiPrompt.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setAiOutput(null);

    const targetProvider = aiProviders.find((p) => p.id === selectedAiId) || aiProviders[0];

    try {
      const res = await apiClient.testAIProvider({
        providerId: targetProvider?.id,
        provider: targetProvider,
      });

      if (res.success) {
        setAiOutput({
          status: 'SUCCESS',
          latencyMs: res.latencyMs || res.latency_ms || 0,
          response: res.output || res.sampleOutput || res.message || 'Model successfully verified connectivity.',
        });
      } else {
        setErrorMsg(
          typeof res.error === 'string'
            ? res.error
            : (res.error as any)?.message || 'AI generation failed'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Selector */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMode('search')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all ${
            mode === 'search'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'cyber-panel text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Search Engine Playground (Tavily)</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('ai')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all ${
            mode === 'ai'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'cyber-panel text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>AI Generation Playground</span>
        </button>
      </div>

      {mode === 'search' ? (
        <div className="cyber-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <Search className="w-4 h-4 text-cyan-400" />
                Live Search Query Test
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Execute queries against the configured search providers and inspect real citations and facts.
              </p>
            </div>

            <select
              value={selectedSearchId}
              onChange={(e) => setSelectedSearchId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            >
              {searchProviders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.type})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter search terms..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
            />
            <button
              type="button"
              onClick={handleRunSearch}
              disabled={loading}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold font-mono rounded-xl flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Query</span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {searchOutput && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Search Successful ({searchOutput.latencyMs || 0}ms)
                </span>
                <span>{searchOutput.resultsCount || searchOutput.resultCount || 0} Citations</span>
              </div>

              <div className="space-y-2">
                {Array.isArray(searchOutput.results) && searchOutput.results.length > 0 ? (
                  searchOutput.results.map((r: any, idx: number) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                      <div className="font-bold text-cyan-300 font-display">{r.title || 'Untitled'}</div>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-cyan-500 hover:underline break-all font-mono"
                      >
                        {r.url}
                      </a>
                      {r.content && <p className="text-slate-400 text-[11px] leading-relaxed mt-1">{r.content}</p>}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500 font-mono py-2">No results returned for this query.</div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="cyber-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                Live Model Completion Test
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Send instructions directly to configured AI models and verify raw responses.
              </p>
            </div>

            <select
              value={selectedAiId}
              onChange={(e) => setSelectedAiId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            >
              {aiProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.model})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <textarea
              rows={3}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleRunAi}
                disabled={loading}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold font-mono rounded-xl flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Generate</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {aiOutput && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Model Connected ({aiOutput.latencyMs}ms)
                </span>
              </div>
              <pre className="text-slate-300 text-xs whitespace-pre-wrap font-sans leading-relaxed">
                {aiOutput.response}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
