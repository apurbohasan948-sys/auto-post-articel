import React, { useState } from 'react';
import {
  Cpu,
  Search,
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  Hash,
  ExternalLink,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  AIProviderConfig,
  AITestResult,
  SearchProviderConfig,
  SearchTestResult,
} from '../../types/agent.ts';
import { apiClient } from '../../services/apiClient.ts';

interface PlaygroundTabProps {
  aiProviders: AIProviderConfig[];
  searchProviders: SearchProviderConfig[];
}

export const PlaygroundTab: React.FC<PlaygroundTabProps> = ({
  aiProviders,
  searchProviders,
}) => {
  const [activePlayground, setActivePlayground] = useState<'ai' | 'search'>('ai');

  // AI Playground State
  const [selectedAiId, setSelectedAiId] = useState<string>(
    aiProviders[0]?.id || ''
  );
  const [aiPrompt, setAiPrompt] = useState<string>(
    'Summarize the core architectural benefits of multi-agent autonomous orchestrations in 3 bullet points.'
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AITestResult | null>(null);

  // Search Playground State
  const [selectedSearchId, setSelectedSearchId] = useState<string>(
    searchProviders[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    'latest breakthroughs in autonomous AI agents and tool use'
  );
  const [searchDepth, setSearchDepth] = useState<'basic' | 'advanced'>('basic');
  const [maxResults, setMaxResults] = useState<number>(5);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchTestResult | null>(null);

  const handleRunAi = async () => {
    if (!selectedAiId) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await apiClient.runAIPlayground({
        providerId: selectedAiId,
        prompt: aiPrompt,
      });
      setAiResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAiResult({
        success: false,
        providerId: selectedAiId,
        status: 'FAILED',
        latencyMs: 0,
        error: msg,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleRunSearch = async () => {
    if (!selectedSearchId) return;
    setSearchLoading(true);
    setSearchResult(null);
    try {
      const res = await apiClient.runSearchPlayground({
        providerId: selectedSearchId,
        query: searchQuery,
        depth: searchDepth,
        maxResults,
      });
      setSearchResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSearchResult({
        success: false,
        providerId: selectedSearchId,
        status: 'FAILED',
        latencyMs: 0,
        error: msg,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const currentAiProvider = aiProviders.find((p) => p.id === selectedAiId);
  const currentSearchProvider = searchProviders.find((p) => p.id === selectedSearchId);

  return (
    <div className="space-y-6">
      {/* Playground Header & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            Live Provider Testing Playground
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Dispatch ad-hoc generation prompts or live web searches to test credentials, latency, and response quality.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActivePlayground('ai')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activePlayground === 'ai'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>AI Model Generation</span>
          </button>
          <button
            type="button"
            onClick={() => setActivePlayground('search')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activePlayground === 'search'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Search & Retrieval</span>
          </button>
        </div>
      </div>

      {/* 1. AI Playground View */}
      {activePlayground === 'ai' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls & Input Form */}
          <div className="lg:col-span-5 space-y-4">
            <div className="cyber-panel p-5 rounded-xl border border-slate-800 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Target AI Provider
                </label>
                <select
                  value={selectedAiId}
                  onChange={(e) => setSelectedAiId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
                >
                  {aiProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.priority} {p.name} ({p.modelName || p.defaultModel})
                      {p.enabled ? '' : ' [Disabled]'}
                    </option>
                  ))}
                </select>
                {currentAiProvider && (
                  <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between pt-1">
                    <span>Protocol: {currentAiProvider.type}</span>
                    <span>Timeout: {currentAiProvider.timeoutMs}ms</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Test Prompt</span>
                  <span className="text-[10px] text-slate-500">Plaintext or Markdown</span>
                </label>
                <textarea
                  rows={5}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Enter custom prompt to test model reasoning..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-cyan-500 resize-y"
                />
              </div>

              <button
                type="button"
                disabled={aiLoading || !selectedAiId}
                onClick={handleRunAi}
                className="w-full py-2.5 rounded-lg text-xs font-bold font-mono text-white bg-cyan-600 hover:bg-cyan-500 transition-colors shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Play className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} />
                <span>{aiLoading ? 'Executing Inference...' : 'Run Generation Test'}</span>
              </button>
            </div>
          </div>

          {/* Output Display */}
          <div className="lg:col-span-7">
            <div className="cyber-panel p-5 rounded-xl border border-slate-800 h-full flex flex-col space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono uppercase text-slate-300">
                    Inference Output
                  </span>
                  {aiResult && (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        aiResult.success
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {aiResult.status}
                    </span>
                  )}
                </div>

                {aiResult && (
                  <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                    {aiResult.latencyMs && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        {aiResult.latencyMs} ms
                      </span>
                    )}
                    {aiResult.usage?.totalTokens && (
                      <span className="flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5 text-cyan-400" />
                        {aiResult.usage.totalTokens} tokens
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-[220px] rounded-lg bg-slate-950 p-4 border border-slate-800/80 font-mono text-xs text-slate-200 overflow-y-auto whitespace-pre-wrap">
                {aiLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 py-12">
                    <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                    <span>Transmitting payload to model endpoint...</span>
                  </div>
                ) : aiResult ? (
                  aiResult.success ? (
                    aiResult.sampleOutput
                  ) : (
                    <div className="text-rose-400 space-y-2">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" />
                        <span>Execution Failed ({aiResult.status})</span>
                      </div>
                      <p className="text-slate-300">{aiResult.error}</p>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-600 italic py-12">
                    Select an AI provider, enter a prompt, and click Run Generation Test.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Search Playground View */}
      {activePlayground === 'search' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls & Input Form */}
          <div className="lg:col-span-5 space-y-4">
            <div className="cyber-panel p-5 rounded-xl border border-slate-800 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Target Search Provider
                </label>
                <select
                  value={selectedSearchId}
                  onChange={(e) => setSelectedSearchId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                >
                  {searchProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.priority} {p.name} ({p.type})
                      {p.enabled ? '' : ' [Disabled]'}
                    </option>
                  ))}
                </select>
                {currentSearchProvider && (
                  <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between pt-1">
                    <span>Engine: {currentSearchProvider.type}</span>
                    <span>Endpoint: {currentSearchProvider.baseUrl}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Search Query
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. quantum computing advances 2026"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 font-mono text-[11px]">Search Depth</label>
                  <select
                    value={searchDepth}
                    onChange={(e) => setSearchDepth(e.target.value as 'basic' | 'advanced')}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  >
                    <option value="basic">Basic (Fast)</option>
                    <option value="advanced">Advanced (Deep)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-mono text-[11px]">Max Sources</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={maxResults}
                    onChange={(e) => setMaxResults(parseInt(e.target.value, 10) || 5)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={searchLoading || !selectedSearchId}
                onClick={handleRunSearch}
                className="w-full py-2.5 rounded-lg text-xs font-bold font-mono text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Search className={`w-4 h-4 ${searchLoading ? 'animate-spin' : ''}`} />
                <span>{searchLoading ? 'Searching Web...' : 'Run Live Search Test'}</span>
              </button>
            </div>
          </div>

          {/* Search Output Results */}
          <div className="lg:col-span-7">
            <div className="cyber-panel p-5 rounded-xl border border-slate-800 h-full flex flex-col space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono uppercase text-slate-300">
                    Retrieved Search Citations
                  </span>
                  {searchResult && (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        searchResult.success
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {searchResult.status}
                    </span>
                  )}
                </div>

                {searchResult && searchResult.latencyMs && (
                  <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    {searchResult.latencyMs} ms
                  </span>
                )}
              </div>

              <div className="flex-1 min-h-[220px] rounded-lg bg-slate-950 p-4 border border-slate-800/80 overflow-y-auto space-y-3">
                {searchLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 py-12">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                    <span>Querying real web search index...</span>
                  </div>
                ) : searchResult ? (
                  searchResult.success ? (
                    searchResult.rawResults && searchResult.rawResults.length > 0 ? (
                      searchResult.rawResults.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h5 className="text-xs font-bold text-white hover:text-emerald-300 line-clamp-1">
                              {item.title}
                            </h5>
                            {item.url && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="text-slate-400 hover:text-emerald-400 flex-shrink-0"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-2">
                            {item.snippet || item.content}
                          </p>
                          <div className="text-[10px] font-mono text-emerald-400/80 truncate">
                            {item.url}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-400 italic">
                        Query returned 0 sources for this search phrase.
                      </div>
                    )
                  ) : (
                    <div className="text-rose-400 space-y-2 text-xs font-mono">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" />
                        <span>Search Error ({searchResult.status})</span>
                      </div>
                      <p className="text-slate-300">{searchResult.error}</p>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-600 italic py-12">
                    Enter a search topic to test citation indexing and live query retrieval.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
