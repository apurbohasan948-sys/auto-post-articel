import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Search,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Key,
  Layers,
  Sparkles,
  Activity,
  Sliders,
  DollarSign,
  Star,
  RefreshCw,
} from 'lucide-react';
import {
  AIProviderConfig,
  AITestResult,
  SearchProviderConfig,
  SearchTestResult,
} from '../types/agent.ts';
import { apiClient } from '../services/apiClient.ts';
import { ProviderModal } from './providers/ProviderModal.tsx';
import { SearchProviderModal } from './providers/SearchProviderModal.tsx';
import { PlaygroundTab } from './providers/PlaygroundTab.tsx';
import { HealthHistoryTab } from './providers/HealthHistoryTab.tsx';
import { BackupTab } from './providers/BackupTab.tsx';

interface ProvidersViewProps {
  aiProviders: AIProviderConfig[];
  searchProviders: SearchProviderConfig[];
  onUpdateAI: (providers: AIProviderConfig[]) => void;
  onUpdateSearch: (providers: SearchProviderConfig[]) => void;
}

type ControlCenterTab = 'routing' | 'playground' | 'health' | 'backup';

export const ProvidersView: React.FC<ProvidersViewProps> = ({
  aiProviders,
  searchProviders,
  onUpdateAI,
  onUpdateSearch,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<ControlCenterTab>('routing');
  const [aiList, setAiList] = useState<AIProviderConfig[]>(aiProviders);
  const [searchList, setSearchList] = useState<SearchProviderConfig[]>(searchProviders);

  // Modals state
  const [editingAi, setEditingAi] = useState<AIProviderConfig | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [editingSearch, setEditingSearch] = useState<SearchProviderConfig | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Live testing state map
  const [aiTestStates, setAiTestStates] = useState<Record<string, { loading: boolean; result?: AITestResult }>>({});
  const [searchTestStates, setSearchTestStates] = useState<Record<string, { loading: boolean; result?: SearchTestResult }>>({});
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setAiList(aiProviders);
  }, [aiProviders]);

  useEffect(() => {
    setSearchList(searchProviders);
  }, [searchProviders]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const refreshAllData = async () => {
    try {
      const [ais, searches] = await Promise.all([
        apiClient.getAIProviders(),
        apiClient.getSearchProviders(),
      ]);
      setAiList(ais);
      setSearchList(searches);
      onUpdateAI(ais);
      onUpdateSearch(searches);
    } catch {
      // Ignore
    }
  };

  // --- AI Provider Actions ---
  const handleSaveAiProvider = async (provider: AIProviderConfig) => {
    try {
      const res = await apiClient.saveAIProvider(provider);
      if (res.success) {
        showToast(`AI Provider "${provider.name}" saved!`);
        await refreshAllData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  const handleDeleteAiProvider = async (id: string, name: string) => {
    if (!window.confirm(`Delete AI provider "${name}"?`)) return;
    try {
      await apiClient.deleteAIProvider(id);
      showToast(`Provider "${name}" removed.`);
      await refreshAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  const handleToggleAi = async (id: string, currentEnabled: boolean) => {
    try {
      await apiClient.toggleAIProvider(id, !currentEnabled);
      await refreshAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  const handleSetAiPrimary = async (id: string) => {
    const target = aiList.find((p) => p.id === id);
    if (!target) return;
    const others = aiList.filter((p) => p.id !== id).sort((a, b) => a.priority - b.priority);
    const newOrder = [target.id, ...others.map((p) => p.id)];
    try {
      await apiClient.reorderAIProviders(newOrder);
      showToast(`"${target.name}" set as Primary AI provider!`);
      await refreshAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  const handleMoveAiPriority = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= aiList.length) return;

    const copy = [...aiList];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);

    try {
      await apiClient.reorderAIProviders(copy.map((p) => p.id));
      await refreshAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  const handleTestAi = async (p: AIProviderConfig) => {
    setAiTestStates((prev) => ({ ...prev, [p.id]: { loading: true } }));
    try {
      const res = await apiClient.testAIProvider({ providerId: p.id });
      setAiTestStates((prev) => ({ ...prev, [p.id]: { loading: false, result: res } }));
      if (res.success) {
        showToast(`Test passed for ${p.name} (${res.latencyMs}ms)`);
      } else {
        showToast(`Test failed for ${p.name}: ${res.error || 'Connection error'}`, 'error');
      }
      await refreshAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAiTestStates((prev) => ({
        ...prev,
        [p.id]: {
          loading: false,
          result: { success: false, providerId: p.id, status: 'FAILED', latencyMs: 0, error: msg, timestamp: new Date().toISOString() },
        },
      }));
      showToast(msg, 'error');
    }
  };

  // --- Search Provider Actions ---
  const handleSaveSearchProvider = async (provider: SearchProviderConfig) => {
    try {
      const res = await apiClient.saveSearchProvider(provider);
      if (res.success) {
        showToast(`Search Provider "${provider.name}" saved!`);
        await refreshAllData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  const handleDeleteSearchProvider = async (id: string, name: string) => {
    if (!window.confirm(`Delete search provider "${name}"?`)) return;
    try {
      await apiClient.deleteSearchProvider(id);
      showToast(`Search provider "${name}" removed.`);
      await refreshAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  const handleToggleSearch = async (id: string, currentEnabled: boolean) => {
    try {
      await apiClient.toggleSearchProvider(id, !currentEnabled);
      await refreshAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  const handleTestSearch = async (s: SearchProviderConfig) => {
    setSearchTestStates((prev) => ({ ...prev, [s.id]: { loading: true } }));
    try {
      const res = await apiClient.testSearchProvider({ providerId: s.id });
      setSearchTestStates((prev) => ({ ...prev, [s.id]: { loading: false, result: res } }));
      if (res.success) {
        showToast(`Search test passed for ${s.name} (${res.resultsCount || res.resultCount} citations, ${res.latencyMs}ms)`);
      } else {
        showToast(`Search test failed: ${res.error}`, 'error');
      }
      await refreshAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSearchTestStates((prev) => ({
        ...prev,
        [s.id]: {
          loading: false,
          result: { success: false, providerId: s.id, status: 'FAILED', latencyMs: 0, error: msg, timestamp: new Date().toISOString() },
        },
      }));
      showToast(msg, 'error');
    }
  };

  const getStatusPill = (status?: string) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> ONLINE
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-3 h-3" /> FAILED
          </span>
        );
      case 'TIMEOUT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" /> TIMEOUT
          </span>
        );
      case 'RATE_LIMITED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
            RATE LIMITED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800">
            NEVER TESTED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="cyber-panel p-5 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white font-display">
              API Control Center
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              Zero Code Changes Required
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Centrally register, prioritize, test, and manage all AI model gateways and empirical web search engines.
          </p>
        </div>

        {/* Global Toast */}
        {toastMessage && (
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono shadow-lg transition-all ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto scrollbar-none">
        {[
          { id: 'routing' as ControlCenterTab, label: 'Providers & Failover Routing', icon: Layers },
          { id: 'playground' as ControlCenterTab, label: 'Test Playground', icon: Sparkles },
          { id: 'health' as ControlCenterTab, label: 'Health & Test History', icon: Activity },
          { id: 'backup' as ControlCenterTab, label: 'Backup & Import/Export', icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                isActive
                  ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUB-VIEW 1: Routing & Providers */}
      {activeSubTab === 'routing' && (
        <div className="space-y-8">
          {/* Section 1: AI Model Providers */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  AI Generation Models & Fallback Chain
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Ordered by priority (Priority 1 = Primary). The autonomous orchestrator automatically cascades on timeouts, errors, or rate limits.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingAi(null);
                  setIsAiModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-lg text-xs font-bold font-mono text-white bg-cyan-600 hover:bg-cyan-500 transition-colors flex items-center gap-1.5 shadow-md cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Add AI Provider</span>
              </button>
            </div>

            {/* AI Providers Grid / Cards */}
            <div className="grid grid-cols-1 gap-4">
              {aiList.map((p, index) => {
                const testState = aiTestStates[p.id];
                const isPrimary = index === 0;

                return (
                  <div
                    key={p.id}
                    className={`p-4 sm:p-5 rounded-xl border transition-all ${
                      p.enabled
                        ? isPrimary
                          ? 'bg-slate-950/90 border-cyan-500/40 shadow-lg shadow-cyan-950/20'
                          : 'bg-slate-950/80 border-slate-800'
                        : 'bg-slate-950/40 border-slate-900 opacity-65'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Priority, Title, Protocol */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span
                            className={`w-6 h-6 rounded-full font-mono text-xs font-bold flex items-center justify-center border ${
                              isPrimary
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                            title={`Priority #${p.priority}`}
                          >
                            {p.priority}
                          </span>

                          <span className="text-sm font-bold text-white font-display">
                            {p.name}
                          </span>

                          {isPrimary && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              <Star className="w-3 h-3 fill-cyan-400 text-cyan-400" /> PRIMARY
                            </span>
                          )}

                          <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 uppercase">
                            {p.type}
                          </span>

                          {getStatusPill(p.lastTestStatus)}
                        </div>

                        {/* Details row: Model, Base URL, Key mask */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono text-slate-400">
                          <div>
                            <span className="text-slate-500 block text-[10px]">Active Model:</span>
                            <span className="text-slate-200 font-bold">
                              {p.modelName || p.defaultModel}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Endpoint:</span>
                            <span className="text-slate-300 truncate block">
                              {p.baseUrl || (p.type === 'gemini' ? 'Google SDK' : 'Default Gateway')}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">API Key Status:</span>
                            <span className="text-slate-300 flex items-center gap-1">
                              <Key className="w-3 h-3 text-cyan-400" />
                              {p.hasKey ? (
                                <span>{p.apiKey || '••••••••••••'}</span>
                              ) : (
                                <span className="text-rose-400">Not configured</span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Error notice if last test failed */}
                        {p.lastError && (
                          <div className="text-[11px] font-mono text-rose-300 bg-rose-950/40 border border-rose-900/40 p-2 rounded-lg flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">Last error: {p.lastError}</span>
                          </div>
                        )}

                        {/* Usage widget (e.g. OpenRouter) */}
                        {p.usageInfo?.hasUsageData && (
                          <div className="text-[11px] font-mono text-cyan-300 bg-cyan-950/30 border border-cyan-900/40 p-2 rounded-lg flex items-center gap-2">
                            <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
                            <span>
                              Usage Credit: {p.usageInfo.usage !== undefined ? `$${p.usageInfo.usage.toFixed(4)}` : '—'}
                              {p.usageInfo.limit ? ` / Limit $${p.usageInfo.limit}` : ''}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right: Actions & Controls */}
                      <div className="flex flex-wrap items-center gap-2 border-t lg:border-t-0 border-slate-800 pt-3 lg:pt-0">
                        {/* Priority Reordering */}
                        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveAiPriority(index, 'up')}
                            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Move Priority Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === aiList.length - 1}
                            onClick={() => handleMoveAiPriority(index, 'down')}
                            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Move Priority Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {!isPrimary && (
                          <button
                            type="button"
                            onClick={() => handleSetAiPrimary(p.id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:border-cyan-500 hover:text-cyan-300 cursor-pointer transition-colors"
                          >
                            Set Primary
                          </button>
                        )}

                        {/* Test Button */}
                        <button
                          type="button"
                          disabled={testState?.loading}
                          onClick={() => handleTestAi(p)}
                          className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          <Zap className={`w-3.5 h-3.5 ${testState?.loading ? 'animate-spin' : ''}`} />
                          <span>{testState?.loading ? 'Testing...' : 'Test API'}</span>
                        </button>

                        {/* Enable/Disable Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleAi(p.id, p.enabled)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors ${
                            p.enabled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {p.enabled ? 'Enabled' : 'Disabled'}
                        </button>

                        {/* Edit & Delete */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAi(p);
                            setIsAiModalOpen(true);
                          }}
                          className="p-2 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 cursor-pointer transition-colors"
                          title="Edit Provider"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteAiProvider(p.id, p.name)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-800 hover:bg-rose-950/40 cursor-pointer transition-colors"
                          title="Delete Provider"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Inline Test Result Feedback if triggered */}
                    {testState?.result && (
                      <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs font-mono flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">Response:</span>
                          <span className={testState.result.success ? 'text-emerald-300' : 'text-rose-300'}>
                            {testState.result.sampleOutput || testState.result.error || testState.result.status}
                          </span>
                        </div>
                        {testState.result.latencyMs && (
                          <span className="text-slate-400">{testState.result.latencyMs} ms</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Search / Research Providers */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <Search className="w-4 h-4 text-emerald-400" />
                  Search & Web Grounding Engines
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Empirical search providers utilized by Topic Scout and Deep Research agents for citations and source groundings.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingSearch(null);
                  setIsSearchModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-lg text-xs font-bold font-mono text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center gap-1.5 shadow-md cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Add Search Provider</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {searchList.map((s) => {
                const testState = searchTestStates[s.id];

                return (
                  <div
                    key={s.id}
                    className={`p-4 sm:p-5 rounded-xl border transition-all ${
                      s.enabled
                        ? 'bg-slate-950/80 border-slate-800'
                        : 'bg-slate-950/40 border-slate-900 opacity-65'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-sm font-bold text-white font-display">
                            {s.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 uppercase">
                            {s.type}
                          </span>
                          {getStatusPill(s.lastTestStatus)}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono text-slate-400">
                          <div>
                            <span className="text-slate-500 block text-[10px]">Endpoint:</span>
                            <span className="text-slate-300 truncate block">
                              {s.baseUrl || 'Default Search API'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Depth & Max Sources:</span>
                            <span className="text-slate-200">
                              {s.searchDepth || 'basic'} • {s.maxResults || 5} sources
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">API Key Status:</span>
                            <span className="text-slate-300 flex items-center gap-1">
                              <Key className="w-3 h-3 text-emerald-400" />
                              {s.hasKey ? (
                                <span>{s.apiKey || '••••••••••••'}</span>
                              ) : (
                                <span className="text-rose-400">Not configured</span>
                              )}
                            </span>
                          </div>
                        </div>

                        {s.lastError && (
                          <div className="text-[11px] font-mono text-rose-300 bg-rose-950/40 border border-rose-900/40 p-2 rounded-lg flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">Last error: {s.lastError}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 border-t lg:border-t-0 border-slate-800 pt-3 lg:pt-0">
                        <button
                          type="button"
                          disabled={testState?.loading}
                          onClick={() => handleTestSearch(s)}
                          className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          <Zap className={`w-3.5 h-3.5 ${testState?.loading ? 'animate-spin' : ''}`} />
                          <span>{testState?.loading ? 'Testing...' : 'Test Search'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleSearch(s.id, s.enabled)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors ${
                            s.enabled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {s.enabled ? 'Enabled' : 'Disabled'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingSearch(s);
                            setIsSearchModalOpen(true);
                          }}
                          className="p-2 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 cursor-pointer transition-colors"
                          title="Edit Search Provider"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSearchProvider(s.id, s.name)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-800 hover:bg-rose-950/40 cursor-pointer transition-colors"
                          title="Delete Search Provider"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: Interactive Playground */}
      {activeSubTab === 'playground' && (
        <PlaygroundTab aiProviders={aiList} searchProviders={searchList} />
      )}

      {/* SUB-VIEW 3: Health & Test History */}
      {activeSubTab === 'health' && (
        <HealthHistoryTab
          aiProviders={aiList}
          searchProviders={searchList}
          onRefreshAll={refreshAllData}
        />
      )}

      {/* SUB-VIEW 4: Backup & Import/Export */}
      {activeSubTab === 'backup' && (
        <BackupTab onReloadProviders={refreshAllData} />
      )}

      {/* Modals */}
      <ProviderModal
        provider={editingAi}
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onSave={handleSaveAiProvider}
        nextPriority={aiList.length + 1}
      />

      <SearchProviderModal
        provider={editingSearch}
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSave={handleSaveSearchProvider}
        nextPriority={searchList.length + 1}
      />
    </div>
  );
};
