import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Cpu,
  Search,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  AIProviderConfig,
  ApiTestHistoryItem,
  SearchProviderConfig,
} from '../../types/agent.ts';
import { apiClient } from '../../services/apiClient.ts';

interface HealthHistoryTabProps {
  aiProviders: AIProviderConfig[];
  searchProviders: SearchProviderConfig[];
  onRefreshAll: () => void;
}

export const HealthHistoryTab: React.FC<HealthHistoryTabProps> = ({
  aiProviders,
  searchProviders,
  onRefreshAll,
}) => {
  const [history, setHistory] = useState<ApiTestHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [pingingAll, setPingingAll] = useState(false);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await apiClient.getTestHistory(25);
      setHistory(res.history || []);
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handlePingAll = async () => {
    setPingingAll(true);
    try {
      const enabledAi = aiProviders.filter((p) => p.enabled);
      const enabledSearch = searchProviders.filter((p) => p.enabled);

      for (const p of enabledAi) {
        await apiClient.testAIProvider({ providerId: p.id }).catch(() => null);
      }
      for (const s of enabledSearch) {
        await apiClient.testSearchProvider({ providerId: s.id }).catch(() => null);
      }
      await loadHistory();
      onRefreshAll();
    } finally {
      setPingingAll(false);
    }
  };

  // Sorted enabled lists for fallback sequence
  const sortedAi = [...aiProviders].filter((p) => p.enabled).sort((a, b) => a.priority - b.priority);
  const sortedSearch = [...searchProviders].filter((p) => p.enabled).sort((a, b) => a.priority - b.priority);

  const getStatusBadge = (status?: string) => {
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-800 border border-slate-700">
            NOT TESTED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Global Provider Health & Failover Map
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Real-time connection verification, latency telemetry, and the active multi-agent fallback cascade.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pingingAll}
            onClick={handlePingAll}
            className="px-3.5 py-2 rounded-lg text-xs font-bold font-mono text-white bg-cyan-600 hover:bg-cyan-500 transition-colors flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${pingingAll ? 'animate-spin' : ''}`} />
            <span>{pingingAll ? 'Pinging All Providers...' : 'Ping All Active Providers'}</span>
          </button>
          <button
            type="button"
            onClick={loadHistory}
            className="p-2 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 cursor-pointer transition-colors"
            title="Refresh Test Log"
          >
            <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Fallback Chain Visualization */}
      <div className="cyber-panel p-5 rounded-xl border border-slate-800 space-y-4">
        <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          Active AI Failover Chain (Cascade Sequence)
        </h4>

        {sortedAi.length === 0 ? (
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs text-amber-400">
            No active AI providers enabled. The autonomous agent requires at least 1 enabled provider.
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {sortedAi.map((p, index) => (
              <React.Fragment key={p.id}>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 min-w-[200px] flex-1 max-w-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
                      {index === 0 ? 'Primary' : `Fallback #${index}`}
                    </span>
                    {getStatusBadge(p.lastTestStatus)}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white truncate">{p.name}</div>
                    <div className="text-[11px] font-mono text-slate-400 truncate">
                      {p.modelName || p.defaultModel}
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between pt-1 border-t border-slate-900">
                    <span>Priority {p.priority}</span>
                    <span>{p.lastLatencyMs ? `${p.lastLatencyMs}ms` : '—'}</span>
                  </div>
                </div>

                {index < sortedAi.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Search Failover Chain */}
      <div className="cyber-panel p-5 rounded-xl border border-slate-800 space-y-4">
        <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Search className="w-4 h-4 text-emerald-400" />
          Search / Research Retrieval Failover
        </h4>

        {sortedSearch.length === 0 ? (
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs text-amber-400">
            No active search providers enabled. Research agent will use fallback knowledge mode.
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {sortedSearch.map((s, index) => (
              <React.Fragment key={s.id}>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 min-w-[200px] flex-1 max-w-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                      {index === 0 ? 'Primary Search' : `Fallback #${index}`}
                    </span>
                    {getStatusBadge(s.lastTestStatus)}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white truncate">{s.name}</div>
                    <div className="text-[11px] font-mono text-slate-400 truncate uppercase">
                      {s.type}
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between pt-1 border-t border-slate-900">
                    <span>Priority {s.priority}</span>
                    <span>{s.lastLatencyMs ? `${s.lastLatencyMs}ms` : '—'}</span>
                  </div>
                </div>

                {index < sortedSearch.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Recent Test History Log */}
      <div className="cyber-panel p-5 rounded-xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
              Recent Provider Test History (Last 25 Tests)
            </h4>
            <p className="text-[11px] text-slate-500">
              Audit record of real network ping and inference attempts with latency markers.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">{history.length} records</span>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 font-mono italic">
            No live test events recorded yet. Click &quot;Ping All Active Providers&quot; or test from the cards.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Provider</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Model / Engine</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Latency</th>
                  <th className="py-2.5 px-3">Response / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                      {item.providerName}
                    </td>
                    <td className="py-2.5 px-3 uppercase text-[11px] text-slate-400">
                      {item.providerType}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 max-w-[160px] truncate">
                      {item.target}
                    </td>
                    <td className="py-2.5 px-3">{getStatusBadge(item.status)}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {item.latencyMs ? `${item.latencyMs} ms` : '—'}
                    </td>
                    <td className="py-2.5 px-3 max-w-[280px] truncate text-slate-400">
                      {item.status === 'SUCCESS' ? (
                        <span className="text-emerald-400/80">{item.sampleOutput || '200 OK'}</span>
                      ) : (
                        <span className="text-rose-400">{item.error || 'Connection failed'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
