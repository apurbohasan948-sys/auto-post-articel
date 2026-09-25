import React, { useState } from 'react';
import { Download, Upload, RotateCcw, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { providerStore } from '../../services/providerStore.ts';

interface BackupTabProps {
  onReloadProviders?: () => void;
}

export const BackupTab: React.FC<BackupTabProps> = ({ onReloadProviders }) => {
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExport = () => {
    try {
      const aiProviders = providerStore.loadProviders();
      const searchProviders = providerStore.loadSearchProviders();
      const tavily = providerStore.loadTavilyConfig();

      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        aiProviders,
        searchProviders,
        tavily,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `axiom-providers-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMsg({ type: 'success', text: 'Provider backup exported successfully.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMsg({ type: 'error', text: `Export failed: ${msg}` });
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (Array.isArray(parsed.aiProviders)) {
          providerStore.saveProviders(parsed.aiProviders);
        }
        if (Array.isArray(parsed.searchProviders)) {
          providerStore.saveSearchProviders(parsed.searchProviders);
        }
        if (parsed.tavily && typeof parsed.tavily === 'object') {
          providerStore.saveTavilyConfig(parsed.tavily);
        }

        setStatusMsg({ type: 'success', text: 'Backup imported successfully.' });
        if (onReloadProviders) onReloadProviders();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatusMsg({ type: 'error', text: `Import failed: ${msg}` });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetDefaults = () => {
    if (!window.confirm('Reset all providers to initial default configuration? Custom keys will be cleared.')) {
      return;
    }
    try {
      providerStore.resetToDefaults();
      setStatusMsg({ type: 'success', text: 'Reset providers to default configurations.' });
      if (onReloadProviders) onReloadProviders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMsg({ type: 'error', text: `Reset failed: ${msg}` });
    }
  };

  return (
    <div className="space-y-6">
      <div className="cyber-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            Configuration Backup & Migration
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Export encrypted snapshots of all AI gateway models and Tavily search credentials.
          </p>
        </div>

        {statusMsg && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 font-mono ${
              statusMsg.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/60 border-rose-500/30 text-rose-300'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Export */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-white font-mono">Export Configuration</div>
            <p className="text-[11px] text-slate-400">Download current routing policies and provider settings as JSON.</p>
            <button
              type="button"
              onClick={handleExport}
              className="w-full py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>

          {/* Import */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-white font-mono">Import Configuration</div>
            <p className="text-[11px] text-slate-400">Restore or migrate providers from a previously saved JSON snapshot.</p>
            <label className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors border border-slate-700">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Backup</span>
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>

          {/* Reset */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-white font-mono">Reset to Defaults</div>
            <p className="text-[11px] text-slate-400">Revert all AI and search provider entries to factory baseline presets.</p>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="w-full py-2 px-3 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800 text-xs font-mono font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
