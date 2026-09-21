import React, { useState } from 'react';
import {
  Terminal,
  Filter,
  Search,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  Info,
  OctagonX,
} from 'lucide-react';
import { SystemLog } from '../types/agent.ts';

interface LogsViewProps {
  logs: SystemLog[];
  onRefresh: () => void;
}

export const LogsView: React.FC<LogsViewProps> = ({ logs, onRefresh }) => {
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const filtered = logs.filter((log) => {
    if (levelFilter !== 'ALL' && log.level !== levelFilter) return false;
    if (
      search &&
      !log.message.toLowerCase().includes(search.toLowerCase()) &&
      !log.agentName.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const handleExport = () => {
    const jsonStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `axiom_agent_logs_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="cyber-panel p-5 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white font-display">
              Autonomous Agent Telemetry Console
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time execution traces from all 12 pipeline sub-agents and background workers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExport}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
          {['ALL', 'SUCCESS', 'INFO', 'WARN', 'ERROR'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`px-3 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                levelFilter === lvl ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search logs by message or agent..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
      </div>

      {/* Terminal View */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-2 max-h-[580px] overflow-y-auto">
        {filtered.map((log) => {
          let badgeColor = 'text-cyan-400';
          let levelIcon = <Info className="w-3 h-3 text-cyan-400 shrink-0" />;

          if (log.level === 'SUCCESS') {
            badgeColor = 'text-emerald-400';
            levelIcon = <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />;
          } else if (log.level === 'WARN') {
            badgeColor = 'text-amber-400';
            levelIcon = <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />;
          } else if (log.level === 'ERROR') {
            badgeColor = 'text-rose-400';
            levelIcon = <OctagonX className="w-3 h-3 text-rose-400 shrink-0" />;
          }

          return (
            <div
              key={log.id}
              className="p-2 rounded hover:bg-slate-900/60 transition-colors flex items-start gap-2.5 border-b border-slate-900/80 last:border-0"
            >
              {levelIcon}
              <span className="text-slate-500 text-[11px] shrink-0">
                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 3 })}
              </span>
              <span className={`font-bold shrink-0 ${badgeColor}`}>
                [{log.agentName}]
              </span>
              {log.jobId && (
                <span className="text-[10px] text-slate-600 font-bold shrink-0">
                  {log.jobId}
                </span>
              )}
              <span className="text-slate-300 break-all leading-relaxed">
                {log.message}
              </span>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="p-8 text-center text-slate-600 text-xs">
            No logs match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
};
