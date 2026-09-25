import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Globe,
  Sliders,
  AlertTriangle,
  Cpu,
  Search,
  Eye,
  EyeOff,
  RefreshCw,
  Key,
  AlertCircle,
} from 'lucide-react';
import { SystemSettings, SearchTestResult, SearchProviderConfig } from '../types/agent.ts';
import { providerStore, isMasked, MASKED_SECRET, TavilyConfig } from '../services/providerStore.ts';
import { apiClient } from '../services/apiClient.ts';

interface SettingsViewProps {
  settings: SystemSettings;
  onUpdateSettings: (settings: Partial<SystemSettings>) => void;
  onNavigateToProviders?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onNavigateToProviders,
}) => {
  // Tavily Configuration State (Single source of truth: tara_tavily_config)
  const [tavilyConfig, setTavilyConfig] = useState<TavilyConfig>(() => providerStore.loadTavilyConfig());
  const [tavilyApiKeyInput, setTavilyApiKeyInput] = useState<string>(() =>
    providerStore.loadTavilyConfig().apiKey ? MASKED_SECRET : ''
  );
  const [showTavilyKey, setShowTavilyKey] = useState(false);
  const [testingTavily, setTestingTavily] = useState(false);
  const [tavilyTestResult, setTavilyTestResult] = useState<SearchTestResult | null>(null);
  const [tavilySaved, setTavilySaved] = useState(false);

  useEffect(() => {
    const unsub = providerStore.subscribeTavily((conf) => {
      setTavilyConfig(conf);
      if (conf.apiKey) {
        setTavilyApiKeyInput(MASKED_SECRET);
      } else {
        setTavilyApiKeyInput('');
      }
    });
    return () => unsub();
  }, []);

  const toggleShowTavilyKey = () => {
    if (!showTavilyKey) {
      if (isMasked(tavilyApiKeyInput)) {
        setTavilyApiKeyInput(tavilyConfig.apiKey || '');
      }
      setShowTavilyKey(true);
    } else {
      if (tavilyApiKeyInput === tavilyConfig.apiKey && tavilyConfig.apiKey) {
        setTavilyApiKeyInput(MASKED_SECRET);
      }
      setShowTavilyKey(false);
    }
  };

  const handleSaveTavily = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawInput = tavilyApiKeyInput.trim();
    const resolvedKey = isMasked(rawInput) ? tavilyConfig.apiKey : rawInput;

    const saved = providerStore.saveTavilyConfig({
      apiKey: resolvedKey,
      baseUrl: tavilyConfig.baseUrl || 'https://api.tavily.com',
      searchDepth: tavilyConfig.searchDepth || 'advanced',
      maxResults: tavilyConfig.maxResults || 6,
      enabled: tavilyConfig.enabled ?? true,
    });

    setTavilyConfig(saved);
    if (saved.apiKey) {
      setTavilyApiKeyInput(showTavilyKey ? saved.apiKey : MASKED_SECRET);
    } else {
      setTavilyApiKeyInput('');
    }
    setTavilySaved(true);
    setTimeout(() => setTavilySaved(false), 3000);
  };

  const handleTestTavily = async () => {
    setTestingTavily(true);
    setTavilyTestResult(null);

    const rawInput = tavilyApiKeyInput.trim();
    const resolvedKey = isMasked(rawInput) ? tavilyConfig.apiKey : rawInput;

    // Requirement 9: If key is missing, report: "Tavily API key is not configured."
    if (!resolvedKey && !process.env.TAVILY_API_KEY) {
      setTestingTavily(false);
      setTavilyTestResult({
        success: false,
        status: 'FAILED',
        provider: 'Tavily AI Search',
        latencyMs: 0,
        resultCount: 0,
        error: 'Tavily API key is not configured.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (resolvedKey && resolvedKey !== tavilyConfig.apiKey) {
      providerStore.saveTavilyConfig({ apiKey: resolvedKey });
    }

    try {
      const probeProvider: SearchProviderConfig = {
        id: 'search_tavily',
        name: 'Tavily AI Search',
        type: 'tavily',
        apiKey: resolvedKey,
        baseUrl: tavilyConfig.baseUrl || 'https://api.tavily.com',
        searchDepth: tavilyConfig.searchDepth || 'advanced',
        maxResults: 3,
        priority: 1,
        enabled: true,
      };

      const res = await apiClient.testSearchProvider({
        providerId: 'search_tavily',
        provider: probeProvider,
        query: 'ai autonomous agents research ping',
        depth: tavilyConfig.searchDepth || 'advanced',
        maxResults: 3,
      });
      setTavilyTestResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTavilyTestResult({
        success: false,
        status: 'FAILED',
        provider: 'Tavily AI Search',
        latencyMs: 0,
        resultCount: 0,
        error: msg,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setTestingTavily(false);
    }
  };
  const [formData, setFormData] = useState<SystemSettings>(() => ({
    status: settings?.status || 'IDLE',
    mode: settings?.mode || 'AUTO',
    language: settings?.language || 'English',
    niche: settings?.niche || 'Autonomous AI Systems & Cloud Infrastructure',
    contentNiche: settings?.contentNiche || settings?.niche || 'Autonomous AI Systems & Cloud Infrastructure',
    subNiches: Array.isArray(settings?.subNiches) ? settings.subNiches : ['Multi-Agent Architecture', 'Serverless Cron', 'Empirical Research'],
    targetAudience: settings?.targetAudience || 'Software Engineers, Architects, and Tech Leaders',
    countryRegion: settings?.countryRegion || 'Global',
    keywords: Array.isArray(settings?.keywords) ? settings.keywords : ['Autonomous AI', 'Agent Orchestration', 'Netlify Serverless'],
    excludedKeywords: Array.isArray(settings?.excludedKeywords) ? settings.excludedKeywords : ['crypto pumps', 'get rich quick', 'unverified rumors'],
    articleFrequencyPerDay: settings?.articleFrequencyPerDay || 3,
    maxArticlesPerDay: settings?.maxArticlesPerDay || 3,
    maxAiCallsPerDay: settings?.maxAiCallsPerDay || 60,
    maxAICallsPerDay: settings?.maxAICallsPerDay || 60,
    maxResearchCallsPerDay: settings?.maxResearchCallsPerDay || 20,
    maxWebSearchesPerDay: settings?.maxWebSearchesPerDay || 20,
    maxTokensPerArticle: settings?.maxTokensPerArticle || 4000,
    maxRewriteAttempts: settings?.maxRewriteAttempts || 2,
    timezone: settings?.timezone || 'UTC',
    activeDays: Array.isArray(settings?.activeDays) ? settings.activeDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    quietHoursStart: typeof settings?.quietHoursStart === 'number' ? settings.quietHoursStart : 23,
    quietHoursEnd: typeof settings?.quietHoursEnd === 'number' ? settings.quietHoursEnd : 6,
    todayStats: settings?.todayStats || {
      aiCalls: 0,
      researchCalls: 0,
      articlesPublished: 0,
      socialPostsCreated: 0,
      date: new Date().toISOString().slice(0, 10),
    },
  }));
  const [isSaved, setIsSaved] = useState(false);

  React.useEffect(() => {
    if (settings) {
      setFormData((prev) => ({
        ...prev,
        ...settings,
        activeDays: Array.isArray(settings.activeDays) ? settings.activeDays : prev.activeDays,
        todayStats: settings.todayStats || prev.todayStats,
      }));
    }
  }, [settings]);

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const handleToggleDay = (day: string) => {
    const current = formData.activeDays || [];
    if (current.includes(day)) {
      setFormData({ ...formData, activeDays: current.filter((d) => d !== day) });
    } else {
      setFormData({ ...formData, activeDays: [...current, day] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="cyber-panel p-5 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white font-display">
              Autonomous Operations & Policy Settings
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure editorial niche, target audience, publication frequency, quiet hours, and cost guardrails.
          </p>
        </div>

        {isSaved && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-xs font-mono text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Settings Saved Successfully</span>
          </div>
        )}
      </div>

      {/* API Control Center Banner Link */}
      {onNavigateToProviders && (
        <div className="cyber-panel p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                Looking for API Keys & LLM Providers?
              </h4>
              <p className="text-[11px] text-slate-400">
                Manage, add, test, and prioritize OpenRouter, Gemini, OpenAI-compatible models, and Tavily search in the dedicated API Control Center.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToProviders}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono text-white bg-cyan-600 hover:bg-cyan-500 transition-colors flex items-center gap-1.5 shadow-md cursor-pointer self-start sm:self-auto whitespace-nowrap"
          >
            <span>Open API Control Center</span>
            <span>&rarr;</span>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tavily Web Search & Factual Grounding Section */}
        <div id="settings-tavily-panel" className="cyber-panel p-5 sm:p-6 rounded-xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Search className="w-4 h-4 text-cyan-400" />
                Tavily AI Search Engine & Grounding
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Powers real-time citation synthesis, fact-checking, and zero-hallucination web research dossiers.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-bold ${
                  tavilyConfig.apiKey
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {tavilyConfig.apiKey ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                <span>{tavilyConfig.apiKey ? 'Configured' : 'Key Missing'}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span>Tavily API Key *</span>
                <span className="text-[11px] text-slate-500 font-normal">Stored in tara_tavily_config</span>
              </label>
              <div className="relative">
                <input
                  type={showTavilyKey ? 'text' : 'password'}
                  value={tavilyApiKeyInput}
                  onChange={(e) => setTavilyApiKeyInput(e.target.value)}
                  placeholder="tvly-..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500 pr-10"
                />
                <button
                  type="button"
                  onClick={toggleShowTavilyKey}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showTavilyKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Tavily Base URL</label>
              <input
                type="text"
                value={tavilyConfig.baseUrl || 'https://api.tavily.com'}
                onChange={(e) => setTavilyConfig({ ...tavilyConfig, baseUrl: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Search Depth & Max Citations</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={tavilyConfig.searchDepth || 'advanced'}
                  onChange={(e) => setTavilyConfig({ ...tavilyConfig, searchDepth: e.target.value as 'basic' | 'advanced' })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                >
                  <option value="basic">Basic (Fast)</option>
                  <option value="advanced">Advanced (Deep)</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={tavilyConfig.maxResults || 6}
                  onChange={(e) => setTavilyConfig({ ...tavilyConfig, maxResults: Number(e.target.value) || 6 })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Test Result Display */}
          {tavilyTestResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                tavilyTestResult.success
                  ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-500/30 text-rose-300'
              }`}
            >
              {tavilyTestResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>
                {tavilyTestResult.success
                  ? `Tavily Search Online! (${tavilyTestResult.resultsCount || tavilyTestResult.resultCount || 0} citations returned, ${tavilyTestResult.latencyMs || 0}ms)`
                  : `Tavily Test Failed: ${tavilyTestResult.error || 'Connection error'}`}
              </span>
            </div>
          )}

          {tavilySaved && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Tavily configuration saved to tara_tavily_config!</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleTestTavily}
              disabled={testingTavily}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-mono font-bold rounded-lg border border-slate-700 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingTavily ? 'animate-spin' : ''}`} />
              <span>{testingTavily ? 'Testing Tavily...' : 'Test Tavily'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveTavily}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Tavily</span>
            </button>
          </div>
        </div>

        {/* 1. Editorial Core */}
        <div className="cyber-panel p-5 sm:p-6 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-800 pb-2">
            1. Editorial & Linguistic Direction
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Content Niche</label>
              <input
                type="text"
                value={formData.contentNiche}
                onChange={(e) => setFormData({ ...formData, contentNiche: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Target Language</label>
              <select
                value={formData.language}
                onChange={(e) =>
                  setFormData({ ...formData, language: e.target.value as 'English' | 'Bengali' | 'Banglish' })
                }
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              >
                <option value="English">English (Global Technical Standard)</option>
                <option value="Bengali">Bengali (বাংলা Standard Prose)</option>
                <option value="Banglish">Banglish (Conversational Tech Hybrid)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Target Audience</label>
              <input
                type="text"
                value={formData.targetAudience}
                onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* 2. Autonomous Mode & Quality Loops */}
        <div className="cyber-panel p-5 sm:p-6 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-800 pb-2">
            2. Autonomous Execution Mode & Quality Loops
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <label className="text-slate-200 font-semibold block">Execution Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, mode: 'AUTO' })}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    formData.mode === 'AUTO'
                      ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-xs">AUTO Mode</div>
                  <div className="text-[11px] opacity-80 font-normal mt-0.5">
                    Publishes & distributes immediately upon Quality Pass.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, mode: 'APPROVAL' })}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    formData.mode === 'APPROVAL'
                      ? 'bg-indigo-950/50 border-indigo-500 text-indigo-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-xs">APPROVAL Mode</div>
                  <div className="text-[11px] opacity-80 font-normal mt-0.5">
                    Requires human review and sign-off before publishing.
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <label className="text-slate-200 font-semibold block">Maximum Quality Rewrite Attempts</label>
              <input
                type="number"
                min={1}
                max={5}
                value={formData.maxRewriteAttempts}
                onChange={(e) =>
                  setFormData({ ...formData, maxRewriteAttempts: parseInt(e.target.value, 10) || 2 })
                }
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono"
              />
              <p className="text-[11px] text-slate-400">
                If the Quality Auditor flags unsupported claims, Writer revises up to this limit before marking FAIL.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Schedule, Active Days & Quiet Hours */}
        <div className="cyber-panel p-5 sm:p-6 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-800 pb-2">
            3. Scheduled Timings & Quiet Hours
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-300 font-semibold block mb-1.5">
                Active Publishing Days
              </label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map((day) => {
                  const active = formData.activeDays?.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleToggleDay(day)}
                      className={`px-3.5 py-1.5 rounded-lg border font-mono font-bold cursor-pointer transition-colors ${
                        active
                          ? 'bg-cyan-950 text-cyan-300 border-cyan-500'
                          : 'bg-slate-950 text-slate-500 border-slate-800'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Quiet Hours Start (UTC Hour, 0-23)</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={formData.quietHoursStart}
                  onChange={(e) =>
                    setFormData({ ...formData, quietHoursStart: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Quiet Hours End (UTC Hour, 0-23)</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={formData.quietHoursEnd}
                  onChange={(e) =>
                    setFormData({ ...formData, quietHoursEnd: parseInt(e.target.value, 10) || 6 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4. Cost Control & Quotas */}
        <div className="cyber-panel p-5 sm:p-6 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-800 pb-2">
            4. Cost Guardrails & Daily Ceilings
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Max Articles Per Day</label>
              <input
                type="number"
                value={formData.maxArticlesPerDay}
                onChange={(e) =>
                  setFormData({ ...formData, maxArticlesPerDay: parseInt(e.target.value, 10) || 3 })
                }
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Max AI API Calls / Day</label>
              <input
                type="number"
                value={formData.maxAICallsPerDay}
                onChange={(e) =>
                  setFormData({ ...formData, maxAICallsPerDay: parseInt(e.target.value, 10) || 60 })
                }
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Max Web Search Calls / Day</label>
              <input
                type="number"
                value={formData.maxWebSearchesPerDay}
                onChange={(e) =>
                  setFormData({ ...formData, maxWebSearchesPerDay: parseInt(e.target.value, 10) || 20 })
                }
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20"
          >
            <Save className="w-4 h-4" />
            <span>{isSaved ? 'Settings Saved' : 'Save System Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
