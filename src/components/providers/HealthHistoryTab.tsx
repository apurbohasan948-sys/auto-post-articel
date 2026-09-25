import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, AlertCircle, Clock, RefreshCw, Layers } from 'lucide-react';
import { AIProviderConfig, SearchProviderConfig } from '../../types/agent.ts';
import { apiClient } from '../../services/apiClient.ts';

interface HealthHistoryTabProps {
  aiProviders: AIProviderConfig[];
  searchProviders: SearchProviderConfig[];
  onRefreshAll?: () => void;
}

export const HealthHistoryTab: React.FC<HealthHistoryTabProps> = ({
  aiProviders,
  searchProviders,
  onRefreshAll,
}) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getTestHistory(30);
      setHistory(Array.isArray(res) ? res : []);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="cyber-panel p-4 rounded-xl border border-slate-800 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">AI Providers</div>
          <div className="text-xl font-bold text-white font-mono flex items-center justify-between">
            <span>{aiProviders.filter((p) => p.enabled).length} Active</span>
            <span className="text-xs text-slate-500 font-normal">/ {aiProviders.length} total</span>
          </div>
        </div>

        <div className="cyber-panel p-4 rounded-xl border border-slate-800 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Search Engines</div>
          <div className="text-xl font-bold text-white font-mono flex items-center justify-between">
            <span>{searchProviders.filter((p) => p.enabled).length} Active</span>
            <span className="text-xs text-slate-500 font-normal">/ {searchProviders.length} total</span>
          </div>
        </div>

        <div className="cyber-panel p-4 rounded-xl border border-slate-800 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Audit Log Size</div>
          <div className="text-xl font-bold text-cyan-400 font-mono flex items-center justify-between">
            <span>{history.length}</span>
            <button
              type="button"
              onClick={() => {
                fetchHistory();
                if (onRefreshAll) onRefreshAll();
              }}
              disabled={loading}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer font-sans"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Test Execution History */}
      <div className="cyber-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Provider Connectivity Verification Log
            </h3>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 font-mono">
            No connectivity test runs recorded yet. Test an AI or Search provider to populate history.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">Provider</th>
                  <th className="px-4 py-2.5">Target</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Latency</th>
                  <th className="px-4 py-2.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {history.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40">
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-200">{item.providerName || item.providerId}</td>
                    <td className="px-4 py-2.5 text-slate-400 max-w-xs truncate">{item.modelOrQuery || '-'}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.result === 'SUCCESS'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {item.result === 'SUCCESS' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        {item.result}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">
                      {item.latencyMs !== undefined ? `${item.latencyMs}ms` : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 max-w-sm truncate">
                      {item.error || item.summary || 'OK'}
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
