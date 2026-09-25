import React, { useState } from 'react';
import { X, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, Save, Search } from 'lucide-react';
import { SearchProviderConfig, SearchTestResult } from '../../types/agent.ts';
import { isMasked, MASKED_SECRET } from '../../services/providerStore.ts';
import { apiClient } from '../../services/apiClient.ts';

interface SearchProviderModalProps {
  provider?: SearchProviderConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (provider: SearchProviderConfig) => Promise<void> | void;
  nextPriority?: number;
}

export const SearchProviderModal: React.FC<SearchProviderModalProps> = ({
  provider,
  isOpen,
  onClose,
  onSave,
  nextPriority = 1,
}) => {
  if (!isOpen) return null;

  const isEditing = Boolean(provider);
  const [type, setType] = useState<'tavily' | 'custom'>(
    provider?.type === 'tavily' ? 'tavily' : (provider?.type as any) || 'tavily'
  );
  const [name, setName] = useState(provider?.name || (type === 'tavily' ? 'Tavily AI Search' : 'Custom Search'));
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl || 'https://api.tavily.com');
  const [apiKey, setApiKey] = useState(provider?.apiKey ? MASKED_SECRET : '');
  const [showKey, setShowKey] = useState(false);
  const [searchDepth, setSearchDepth] = useState<'basic' | 'advanced'>(provider?.searchDepth || 'advanced');
  const [maxResults, setMaxResults] = useState(provider?.maxResults || 6);
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<SearchTestResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setErrorMsg(null);

    const cleanKey = isMasked(apiKey) ? (provider?.apiKey || '') : apiKey.trim();

    const probeItem: SearchProviderConfig = {
      id: provider?.id || (type === 'tavily' ? 'search_tavily' : `search_${Date.now()}`),
      name: name.trim(),
      type,
      baseUrl: baseUrl.trim() || 'https://api.tavily.com',
      apiKey: cleanKey,
      searchDepth,
      maxResults,
      enabled,
      priority: provider?.priority || nextPriority,
    };

    try {
      const res = await apiClient.testSearchProvider({
        providerId: probeItem.id,
        provider: probeItem,
        query: 'ai autonomous agents research ping',
        depth: searchDepth,
        maxResults: 3,
      });
      setTestResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({
        success: false,
        status: 'FAILED',
        provider: name,
        latencyMs: 0,
        resultCount: 0,
        error: msg,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Please specify a provider display name.');
      return;
    }

    const cleanKey = isMasked(apiKey) ? (provider?.apiKey || '') : apiKey.trim();

    const updatedProvider: SearchProviderConfig = {
      id: isEditing && provider ? provider.id : (type === 'tavily' ? 'search_tavily' : `search_${Date.now()}`),
      name: name.trim(),
      type,
      baseUrl: baseUrl.trim() || 'https://api.tavily.com',
      apiKey: cleanKey,
      searchDepth,
      maxResults: Number(maxResults) || 6,
      enabled,
      priority: provider?.priority || nextPriority,
      updatedAt: new Date().toISOString(),
    };

    try {
      await onSave(updatedProvider);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg || 'Failed to save search provider.');
    }
  };

  return (
    <div id="search-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div id="search-modal" className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white font-mono">
              {isEditing ? `Configure ${name}` : 'Add Search Provider'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Engine Type</label>
              <select
                value={type}
                disabled={isEditing && provider?.id === 'search_tavily'}
                onChange={(e) => {
                  const t = e.target.value as 'tavily' | 'custom';
                  setType(t);
                  if (t === 'tavily') {
                    setName('Tavily AI Search');
                    setBaseUrl('https://api.tavily.com');
                  } else {
                    setName('Custom Search API');
                  }
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="tavily">Tavily Search Engine</option>
                <option value="custom">Custom Web Search Endpoint</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Status</label>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`w-full py-2 px-3 rounded-lg border font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  enabled
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <span>{enabled ? 'Enabled' : 'Disabled'}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Provider Display Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Base Endpoint URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.tavily.com"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              API Key {type === 'tavily' ? '(Required for Tavily search)' : '(Optional)'}
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="tvly-..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Keys are encrypted in browser localStorage under <code className="text-cyan-400">tara_tavily_config</code>.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Search Depth</label>
              <select
                value={searchDepth}
                onChange={(e) => setSearchDepth(e.target.value as 'basic' | 'advanced')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="basic">Basic (Fast & Lightweight)</option>
                <option value="advanced">Advanced (Deep Synthesis)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Max Citations / Query</label>
              <input
                type="number"
                min={1}
                max={15}
                value={maxResults}
                onChange={(e) => setMaxResults(Math.max(1, Number(e.target.value) || 5))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>
                  {testResult.success
                    ? `Connected! Retrieved ${testResult.resultsCount || testResult.resultCount || 0} citations (${testResult.latencyMs || 0}ms)`
                    : `Connection failed: ${testResult.error || 'Unknown error'}`}
                </span>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || (!apiKey && !provider?.apiKey)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold rounded-lg border border-slate-700 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
