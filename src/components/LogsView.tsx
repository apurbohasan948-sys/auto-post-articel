import React, { useEffect, useState } from 'react';
import { Terminal, Trash2, Filter, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { appStorage } from '../services/storage';
import { LogItem } from '../types/agent';

export const LogsView: React.FC = () => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const refreshLogs = () => {
    setLogs(appStorage.getLogs());
  };

  useEffect(() => {
    refreshLogs();
    const unsub = appStorage.subscribe(() => {
      refreshLogs();
    });
    return unsub;
  }, []);

  const handleClear = () => {
    if (window.confirm('Clear all agent system logs?')) {
      appStorage.clearLogs();
      refreshLogs();
    }
  };

  const filtered = logs.filter((log) => {
    const matchLevel = filterLevel === 'all' || log.level === filterLevel;
    const matchQuery = !searchQuery || 
      log.agent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchLevel && matchQuery;
  });

  const getLevelBadge = (level: LogItem['level']) => {
    switch (level) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-bold uppercase">
            <CheckCircle2 className="w-3.5 h-3.5" />
            SUCCESS
          </span>
        );
      case 'warn':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-bold uppercase">
            <AlertTriangle className="w-3.5 h-3.5" />
            WARN
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-bold uppercase">
            <AlertCircle className="w-3.5 h-3.5" />
            ERROR
          </span>
        );
      case 'info':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-blue-400 font-bold uppercase">
            <Info className="w-3.5 h-3.5" />
            INFO
          </span>
        );
    }
  };

  return (
    <div id="logs-view" className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-400" />
            <span>Agent System &amp; Syndication Logs</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telemetry stream from TopicScout, ResearchAgent, WriterAgent, BloggerPublisher, and SocialDistribution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshLogs}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleClear}
            className="px-3.5 py-2 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 border border-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by agent or message..."
          className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />

        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
          {['all', 'info', 'success', 'warn', 'error'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                filterLevel === lvl
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Log Feed */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs overflow-x-auto shadow-inner">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-slate-500 font-sans">
            No matching log entries found.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((log) => (
              <div
                key={log.id}
                className="py-1.5 px-3 rounded-lg hover:bg-slate-900/80 flex flex-col sm:flex-row sm:items-baseline gap-2 transition-colors border-b border-slate-900/60"
              >
                <div className="flex items-center gap-2.5 shrink-0 text-slate-500 text-[11px]">
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  {getLevelBadge(log.level)}
                  <span className="text-slate-300 font-bold bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                    {log.agent}
                  </span>
                </div>
                <div className="text-slate-200 break-words flex-1">
                  {log.message}
                  {log.details && (
                    <span className="text-slate-500 ml-2 text-[10px]">
                      {JSON.stringify(log.details)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
