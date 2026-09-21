import React, { useState } from 'react';
import {
  Download,
  Upload,
  RotateCcw,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  FileJson,
  Copy,
  Check,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient.ts';

interface BackupTabProps {
  onReloadProviders: () => void;
}

export const BackupTab: React.FC<BackupTabProps> = ({ onReloadProviders }) => {
  const [includeEncrypted, setIncludeEncrypted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportText, setExportText] = useState<string>('');
  const [importText, setImportText] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const handleExport = async () => {
    try {
      const data = await apiClient.exportProvidersConfig(includeEncrypted);
      const json = JSON.stringify(data, null, 2);
      setExportText(json);
      setStatusMsg({ type: 'success', text: 'Configuration exported successfully!' });

      // Trigger file download
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `axiom-api-providers-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMsg({ type: 'error', text: `Export failed: ${msg}` });
    }
  };

  const handleCopyExport = () => {
    if (!exportText) return;
    navigator.clipboard.writeText(exportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = async () => {
    if (!importText.trim()) {
      setStatusMsg({ type: 'error', text: 'Please paste valid JSON configuration to import.' });
      return;
    }
    try {
      const parsed = JSON.parse(importText);
      const res = await apiClient.importProvidersConfig(parsed);
      if (res.success) {
        setStatusMsg({
          type: 'success',
          text: `Imported successfully! (${res.aiCount} AI providers, ${res.searchCount} Search providers)`,
        });
        setImportText('');
        onReloadProviders();
      } else {
        setStatusMsg({ type: 'error', text: 'Import failed: Server returned unhandled status' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMsg({ type: 'error', text: `Invalid JSON format or import error: ${msg}` });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportText(text);
    };
    reader.readAsText(file);
  };

  const handleResetToDefaults = async () => {
    try {
      const defaultPayload = {
        aiProviders: [
          {
            id: 'openrouter-default',
            name: 'OpenRouter Unified Gateway',
            type: 'openrouter',
            modelName: 'anthropic/claude-3.5-sonnet',
            defaultModel: 'anthropic/claude-3.5-sonnet',
            apiKey: '',
            baseUrl: 'https://openrouter.ai/api/v1',
            enabled: true,
            priority: 1,
            timeoutMs: 60000,
            maxTokens: 4000,
            temperature: 0.7,
            capabilities: { jsonMode: true, toolCalling: true, webGrounding: false, vision: false },
          },
          {
            id: 'gemini-fallback',
            name: 'Google Gemini Pro (Fallback)',
            type: 'gemini',
            modelName: 'gemini-1.5-pro',
            defaultModel: 'gemini-1.5-pro',
            apiKey: '',
            enabled: true,
            priority: 2,
            timeoutMs: 60000,
            maxTokens: 4000,
            temperature: 0.7,
            capabilities: { jsonMode: true, toolCalling: true, webGrounding: true, vision: true },
          },
        ],
        searchProviders: [
          {
            id: 'tavily-default',
            name: 'Tavily Research AI',
            type: 'tavily',
            apiKey: '',
            baseUrl: 'https://api.tavily.com',
            enabled: true,
            priority: 1,
            timeoutMs: 30000,
            searchDepth: 'basic',
            maxResults: 5,
            includeDomains: [],
            excludeDomains: [],
          },
        ],
      };

      await apiClient.importProvidersConfig(defaultPayload);
      setIsResetConfirmOpen(false);
      setStatusMsg({
        type: 'success',
        text: 'Reset to default OpenRouter, Gemini, and Tavily topology completed.',
      });
      onReloadProviders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMsg({ type: 'error', text: `Reset failed: ${msg}` });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="border-b border-slate-800 pb-4">
        <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
          <FileJson className="w-5 h-5 text-cyan-400" />
          API Configuration Backup & Disaster Recovery
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Export your routing chains, priority rules, and search integrations. Safe export redacts secret keys by default.
        </p>
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-lg border text-xs font-mono flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Export Configuration */}
        <div className="cyber-panel p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Export Configuration
            </h4>
          </div>
          <p className="text-xs text-slate-400">
            Download current provider routing matrices, endpoints, parameters, and capabilities.
          </p>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={includeEncrypted}
              onChange={(e) => setIncludeEncrypted(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-cyan-500"
            />
            <span>Include encrypted secret keys (for exact backup restoration)</span>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="px-4 py-2 rounded-lg text-xs font-bold font-mono text-white bg-cyan-600 hover:bg-cyan-500 transition-colors flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Generate & Download JSON</span>
            </button>

            {exportText && (
              <button
                type="button"
                onClick={handleCopyExport}
                className="px-3 py-2 rounded-lg text-xs font-mono text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
              </button>
            )}
          </div>

          {exportText && (
            <textarea
              rows={6}
              readOnly
              value={exportText}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 resize-none"
            />
          )}
        </div>

        {/* 2. Import Configuration */}
        <div className="cyber-panel p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Import Configuration
            </h4>
          </div>
          <p className="text-xs text-slate-400">
            Upload a JSON file or paste exported configuration to instantly update your providers.
          </p>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">
              Select JSON File
            </label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
            />
          </div>

          <textarea
            rows={4}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='Paste {"aiProviders": [...], "searchProviders": [...]} here...'
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-white resize-y focus:outline-none focus:border-emerald-500"
          />

          <button
            type="button"
            onClick={handleImport}
            className="px-4 py-2 rounded-lg text-xs font-bold font-mono text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Apply Configuration</span>
          </button>
        </div>
      </div>

      {/* 3. Reset to Defaults */}
      <div className="p-5 rounded-xl border border-rose-900/40 bg-rose-950/20 space-y-3">
        <div className="flex items-center gap-2 text-rose-400 font-bold text-xs font-mono uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4" />
          Danger Zone: Reset Providers to Factory Defaults
        </div>
        <p className="text-xs text-slate-400">
          Reset all providers back to the canonical OpenRouter (Priority 1), Google Gemini (Priority 2), and Tavily Search configuration.
        </p>

        {!isResetConfirmOpen ? (
          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(true)}
            className="px-4 py-2 rounded-lg text-xs font-bold font-mono text-rose-300 bg-rose-900/40 border border-rose-700/50 hover:bg-rose-800/40 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Recommended Defaults</span>
          </button>
        ) : (
          <div className="p-3 rounded-lg bg-slate-950 border border-rose-700/60 space-y-2">
            <p className="text-xs text-rose-300 font-bold">
              Are you sure? This will overwrite custom provider entries.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetToDefaults}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono text-white bg-rose-600 hover:bg-rose-500 cursor-pointer"
              >
                Yes, Reset Everything
              </button>
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
