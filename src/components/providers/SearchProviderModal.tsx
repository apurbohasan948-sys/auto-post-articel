import React, { useState } from 'react';
import {
  X,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Search,
  Sparkles,
  Eye,
  EyeOff,
  Zap,
} from 'lucide-react';
import { SearchProviderConfig, SearchTestResult } from '../../types/agent.ts';
import { apiClient } from '../../services/apiClient.ts';

interface SearchProviderModalProps {
  provider: SearchProviderConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (provider: SearchProviderConfig) => void;
  nextPriority: number;
}

const SEARCH_TEMPLATES: Array<{
  name: string;
  type: SearchProviderConfig['type'];
  baseUrl: string;
  description: string;
}> = [
  {
    name: 'Tavily Search AI (Recommended)',
    type: 'tavily',
    baseUrl: 'https://api.tavily.com',
    description: 'Designed specifically for autonomous LLM research agents with clean contextual extracts.',
  },
  {
    name: 'Brave Search API',
    type: 'brave',
    baseUrl: 'https://api.search.brave.com/res/v1/web/search',
    description: 'Independent index with privacy and direct web result ranking.',
  },
  {
    name: 'Serper.dev (Google Index)',
    type: 'serper',
    baseUrl: 'https://google.serper.dev/search',
    description: 'Fast, structured Google Search scraping API for real-time indexing.',
  },
  {
    name: 'Perplexity Sonar / Online',
    type: 'perplexity',
    baseUrl: 'https://api.perplexity.ai',
    description: 'Sonar online research queries with citations and source groundings.',
  },
  {
    name: 'Custom Search API',
    type: 'custom',
    baseUrl: 'https://your-search-api.com/search',
    description: 'Custom REST search endpoint returning structured results or sources.',
  },
];

export const SearchProviderModal: React.FC<SearchProviderModalProps> = ({
  provider,
  isOpen,
  onClose,
  onSave,
  nextPriority,
}) => {
  if (!isOpen) return null;

  const isEditing = Boolean(provider);

  const [formData, setFormData] = useState<SearchProviderConfig>(() => {
    if (provider) {
      return { ...provider };
    }
    return {
      id: `search-${Date.now()}`,
      name: 'Tavily Web Search',
      type: 'tavily',
      apiKey: '',
      baseUrl: 'https://api.tavily.com',
      enabled: true,
      priority: nextPriority,
      timeoutMs: 30000,
      searchDepth: 'basic',
      maxResults: 5,
      includeDomains: [],
      excludeDomains: [],
      lastTestStatus: 'NEVER_TESTED',
    };
  });

  const [includeDomainsStr, setIncludeDomainsStr] = useState<string>(
    formData.includeDomains ? formData.includeDomains.join(', ') : ''
  );
  const [excludeDomainsStr, setExcludeDomainsStr] = useState<string>(
    formData.excludeDomains ? formData.excludeDomains.join(', ') : ''
  );

  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<SearchTestResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleApplyTemplate = (tpl: (typeof SEARCH_TEMPLATES)[number]) => {
    setFormData((prev) => ({
      ...prev,
      name: tpl.name.split(' (')[0],
      type: tpl.type,
      baseUrl: tpl.baseUrl,
    }));
    setTestResult(null);
    setErrorMsg(null);
  };

  const handleRunModalTest = async () => {
    setTesting(true);
    setTestResult(null);
    setErrorMsg(null);
    try {
      const payload: SearchProviderConfig = {
        ...formData,
        includeDomains: includeDomainsStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        excludeDomains: excludeDomainsStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };

      const res = await apiClient.testSearchProvider({ provider: payload });
      setTestResult(res);
      if (!res.success) {
        setErrorMsg(res.error || 'Search test failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setTestResult({
        success: false,
        providerId: formData.id,
        status: 'FAILED',
        latencyMs: 0,
        error: msg,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg('Provider Name is required');
      return;
    }

    onSave({
      ...formData,
      includeDomains: includeDomainsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      excludeDomains: excludeDomainsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                {isEditing ? `Edit Search Provider: ${formData.name}` : 'Add Search / Research Provider'}
              </h2>
              <p className="text-xs text-slate-400">
                Ground the autonomous agent with factual web search and verified citations.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Quick Pre-Configured Templates */}
          {!isEditing && (
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Select Search Engine
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SEARCH_TEMPLATES.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => handleApplyTemplate(t)}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/40 text-left transition-all cursor-pointer group"
                  >
                    <div className="text-[11px] font-bold text-slate-200 group-hover:text-emerald-300 truncate">
                      {t.name.split(' (')[0]}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
                      {t.type}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 font-mono">
                Provider Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Tavily Primary"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 font-mono">
                Search Engine Type
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as SearchProviderConfig['type'],
                  })
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="tavily">Tavily Research API</option>
                <option value="brave">Brave Web Search API</option>
                <option value="serper">Serper (Google Search)</option>
                <option value="perplexity">Perplexity Sonar Online</option>
                <option value="custom">Custom Search Gateway</option>
              </select>
            </div>
          </div>

          {/* Base URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 font-mono">
              Base URL / Search Endpoint
            </label>
            <input
              type="text"
              value={formData.baseUrl || ''}
              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
              placeholder="https://api.tavily.com"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 font-mono flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-emerald-400" />
                API Key (AES-256 Encrypted)
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {formData.hasKey ? 'Key is configured' : 'No key stored'}
              </span>
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={formData.apiKey || ''}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder={
                  formData.hasKey
                    ? '•••••••••••••••• (leave unchanged to keep current key)'
                    : 'Paste API Key (tvly-..., BSA..., etc.)'
                }
                className="w-full px-3 py-2 pr-10 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Routing & Search Controls */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-slate-400 font-mono text-[11px]">Priority</label>
              <input
                type="number"
                min="1"
                max="99"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: parseInt(e.target.value, 10) || 1 })
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-mono text-[11px]">Search Depth</label>
              <select
                value={formData.searchDepth || 'basic'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    searchDepth: e.target.value as 'basic' | 'advanced',
                  })
                }
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
                max="20"
                value={formData.maxResults || 5}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maxResults: parseInt(e.target.value, 10) || 5,
                  })
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-mono text-[11px]">Timeout (ms)</label>
              <input
                type="number"
                step="1000"
                min="1000"
                value={formData.timeoutMs || 30000}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    timeoutMs: parseInt(e.target.value, 10) || 30000,
                  })
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
              />
            </div>
          </div>

          {/* Domain Restrictions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-400 font-mono text-[11px]">
                Include Domains (comma-separated)
              </label>
              <input
                type="text"
                value={includeDomainsStr}
                onChange={(e) => setIncludeDomainsStr(e.target.value)}
                placeholder="techcrunch.com, arxiv.org, github.com"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-mono text-[11px]">
                Exclude Domains (comma-separated)
              </label>
              <input
                type="text"
                value={excludeDomainsStr}
                onChange={(e) => setExcludeDomainsStr(e.target.value)}
                placeholder="pinterest.com, spammy.site"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
              />
            </div>
          </div>

          {/* Enabled Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
            <div>
              <span className="text-xs font-bold text-white">Enable search provider</span>
              <p className="text-[11px] text-slate-400">
                Allows topic scout and deep research agents to query this engine for citations.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* Test Result Banner */}
          {testResult && (
            <div
              className={`p-3 rounded-lg border text-xs font-mono space-y-1.5 ${
                testResult.success
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  )}
                  <span>Status: {testResult.status}</span>
                </div>
                {testResult.latencyMs && (
                  <span className="text-[11px] opacity-80">{testResult.latencyMs} ms</span>
                )}
              </div>
              {testResult.resultsCount !== undefined && (
                <div className="text-[11px] text-slate-300">
                  Retrieved {testResult.resultsCount} search sources and citations.
                </div>
              )}
              {testResult.sampleTitles && testResult.sampleTitles.length > 0 && (
                <ul className="text-[11px] space-y-0.5 text-slate-400 list-disc list-inside">
                  {testResult.sampleTitles.slice(0, 3).map((t, idx) => (
                    <li key={idx} className="truncate">{t}</li>
                  ))}
                </ul>
              )}
              {testResult.error && (
                <div className="text-[11px] text-rose-300 font-mono">{testResult.error}</div>
              )}
            </div>
          )}

          {errorMsg && !testResult && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300 font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </form>

        {/* Footer actions */}
        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/80">
          <button
            type="button"
            disabled={testing}
            onClick={handleRunModalTest}
            className="px-3.5 py-2 rounded-lg text-xs font-bold font-mono bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Zap className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            <span>{testing ? 'Executing Query...' : 'Test Search API'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-lg cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Save Changes' : 'Add Search Provider'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
