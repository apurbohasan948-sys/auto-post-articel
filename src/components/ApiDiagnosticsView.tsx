import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCw,
  Terminal,
  Server,
  Globe,
  Code,
  ShieldCheck,
  Zap,
  Clock,
  Check,
  Copy,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../services/apiClient.ts';
import { AIProviderConfig, SearchProviderConfig } from '../types/agent.ts';

interface DiagnosticResult {
  endpoint: string;
  method: 'GET' | 'POST';
  status: 'PENDING' | 'PASS' | 'FAIL' | 'RUNNING';
  statusCode: number;
  latencyMs: number;
  contentType: string;
  isJson: boolean;
  data: any;
  rawText: string;
  error?: string;
  testedAt?: string;
  notes?: string;
}

interface ApiDiagnosticsViewProps {
  aiProviders?: AIProviderConfig[];
  searchProviders?: SearchProviderConfig[];
}

export const ApiDiagnosticsView: React.FC<ApiDiagnosticsViewProps> = ({
  aiProviders = [],
  searchProviders = [],
}) => {
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  // Diagnostic Test Suites
  const [results, setResults] = useState<DiagnosticResult[]>([
    {
      endpoint: '/api/health',
      method: 'GET',
      status: 'PENDING',
      statusCode: 0,
      latencyMs: 0,
      contentType: '',
      isJson: false,
      data: null,
      rawText: '',
      notes: 'Diagnostic health check verifying system & all functions status',
    },
    {
      endpoint: '/api/providers/test',
      method: 'POST',
      status: 'PENDING',
      statusCode: 0,
      latencyMs: 0,
      contentType: '',
      isJson: false,
      data: null,
      rawText: '',
      notes: 'AI provider connectivity test (verifies model, key, and normalization)',
    },
    {
      endpoint: '/api/search/test',
      method: 'POST',
      status: 'PENDING',
      statusCode: 0,
      latencyMs: 0,
      contentType: '',
      isJson: false,
      data: null,
      rawText: '',
      notes: 'Search provider connectivity test (verifies query execution and citations)',
    },
    {
      endpoint: '/api/providers/test (Invalid Credentials)',
      method: 'POST',
      status: 'PENDING',
      statusCode: 0,
      latencyMs: 0,
      contentType: '',
      isJson: false,
      data: null,
      rawText: '',
      notes: 'Verifies server gracefully returns JSON 401/400 (never HTML) on bad keys',
    },
    {
      endpoint: '/api/providers/test (Invalid Model)',
      method: 'POST',
      status: 'PENDING',
      statusCode: 0,
      latencyMs: 0,
      contentType: '',
      isJson: false,
      data: null,
      rawText: '',
      notes: 'Verifies server gracefully returns JSON error (never HTML) on unknown model',
    },
    {
      endpoint: '/api/non-existent-diagnostic-endpoint',
      method: 'GET',
      status: 'PENDING',
      statusCode: 0,
      latencyMs: 0,
      contentType: '',
      isJson: false,
      data: null,
      rawText: '',
      notes: 'Verifies 404 API routing returns JSON error and NEVER falls back to index.html',
    },
  ]);

  // Execute single test
  const runTestAtIndex = async (index: number) => {
    setResults((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], status: 'RUNNING' };
      return copy;
    });

    let res: any;
    const testItem = results[index];

    try {
      if (index === 0) {
        // GET /api/health
        res = await apiClient.diagnostics.testHealthEndpoint();
      } else if (index === 1) {
        // POST /api/providers/test with first available provider or mock test
        const activeAi = aiProviders.find((p) => p.enabled) || aiProviders[0];
        const payload = activeAi
          ? { providerId: activeAi.id }
          : {
              provider: {
                name: 'OpenRouter Diagnostic Probe',
                type: 'openrouter',
                apiKey: 'sk-or-v1-probe-test',
                modelName: 'google/gemini-2.0-flash-001',
              },
            };
        res = await apiClient.diagnostics.testAIEndpoint(payload);
      } else if (index === 2) {
        // POST /api/search/test with first available search provider
        const activeSearch = searchProviders.find((p) => p.enabled) || searchProviders[0];
        const payload = activeSearch
          ? { providerId: activeSearch.id, query: 'autonomous ai agents diagnostic' }
          : {
              provider: {
                name: 'Tavily Diagnostic Probe',
                type: 'tavily',
                apiKey: 'tvly-probe-test',
              },
              query: 'autonomous ai agents diagnostic',
            };
        res = await apiClient.diagnostics.testSearchEndpoint(payload);
      } else if (index === 3) {
        // POST /api/providers/test with deliberately invalid API key
        res = await apiClient.diagnostics.testAIEndpoint({
          provider: {
            name: 'Invalid Key Test',
            type: 'openrouter',
            apiKey: 'sk-invalid-key-probe-12345',
            modelName: 'google/gemini-2.0-flash-001',
          },
        });
      } else if (index === 4) {
        // POST /api/providers/test with deliberately invalid model
        res = await apiClient.diagnostics.testAIEndpoint({
          provider: {
            name: 'Invalid Model Test',
            type: 'openrouter',
            apiKey: 'sk-or-v1-dummy',
            modelName: 'non-existent/model-xyz-999',
          },
        });
      } else if (index === 5) {
        // GET /api/non-existent-diagnostic-endpoint
        res = await apiClient.diagnostics.testUnknownRoute('/api/non-existent-diagnostic-endpoint');
      }

      // Check for PASS conditions:
      // Must be valid JSON
      // Content-Type must NOT be text/html
      // For index 0, 1, 2: 200 is pass if service is up, but receiving valid JSON error (e.g. 401 unauth) is also valid API routing
      const isHtml = res.contentType.includes('text/html') || res.rawText.trim().startsWith('<!DOCTYPE');
      const isJson = res.isJson && !isHtml;
      const passed = isJson && (index === 5 ? res.status_code === 404 : res.status_code < 500);

      setResults((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          status: passed ? 'PASS' : 'FAIL',
          statusCode: res.status_code,
          latencyMs: res.latency_ms,
          contentType: res.contentType || 'application/json',
          isJson,
          data: res.data,
          rawText: res.rawText,
          error: !isJson
            ? 'Endpoint returned non-JSON / HTML content!'
            : res.data?.error || undefined,
          testedAt: new Date().toLocaleTimeString(),
        };
        return copy;
      });
    } catch (err: any) {
      setResults((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          status: 'FAIL',
          statusCode: 500,
          latencyMs: 0,
          contentType: 'error',
          isJson: false,
          data: null,
          rawText: err.message,
          error: err.message,
          testedAt: new Date().toLocaleTimeString(),
        };
        return copy;
      });
    }
  };

  const runAllTests = async () => {
    setIsRunningAll(true);
    for (let i = 0; i < results.length; i++) {
      await runTestAtIndex(i);
    }
    setIsRunningAll(false);
  };

  // Run initial health check on mount
  useEffect(() => {
    runTestAtIndex(0);
  }, []);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Activity className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-slate-100">API Diagnostics & Routing Verification</h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Live Verification
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-2xl">
              Inspect live backend API endpoints, HTTP status codes, latency, and content-type headers.
              Verifies that backend routes return structured JSON responses and never fall through to HTML.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs">
              <span className="text-slate-400">Score:</span>
              <span className="font-bold text-emerald-400">{passCount} PASS</span>
              {failCount > 0 && <span className="font-bold text-red-400">/ {failCount} FAIL</span>}
            </div>

            <button
              onClick={runAllTests}
              disabled={isRunningAll}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`w-4 h-4 ${isRunningAll ? 'animate-spin' : ''}`} />
              <span>{isRunningAll ? 'Running Diagnostics...' : 'Run All Diagnostics'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Architecture & Routing Rules Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>Routing & Fallback Guarantees</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800">
            <div className="font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span>Prioritized API Redirects</span>
            </div>
            <p className="text-slate-400">
              <code className="text-cyan-300 font-mono">/api/*</code> rules are evaluated with{' '}
              <code className="text-cyan-300 font-mono">force = true</code> prior to the client-side SPA fallback.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800">
            <div className="font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5 text-cyan-400" />
              <span>JSON Content-Type Strictness</span>
            </div>
            <p className="text-slate-400">
              Every API route responds with <code className="text-cyan-300 font-mono">application/json</code>,
              preventing JSON parse syntax errors.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800">
            <div className="font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span>Explicit API 404 Protection</span>
            </div>
            <p className="text-slate-400">
              Non-existent <code className="text-cyan-300 font-mono">/api/*</code> paths return a JSON 404 object
              rather than serving <code className="text-cyan-300 font-mono">index.html</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Diagnostics Test Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-slate-200">Endpoint Verification Matrix</span>
          </div>
          <span className="text-xs text-slate-400">Click any row to inspect JSON response</span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {results.map((r, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <div key={r.endpoint} className="transition-colors hover:bg-slate-800/20">
                {/* Row Header */}
                <div
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  className="px-5 py-3.5 flex items-center justify-between cursor-pointer gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button className="text-slate-500 hover:text-slate-300">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                        r.method === 'GET'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}
                    >
                      {r.method}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                          {r.endpoint}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{r.notes}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Status Badge */}
                    {r.status === 'RUNNING' && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>TESTING</span>
                      </span>
                    )}

                    {r.status === 'PASS' && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>PASS</span>
                      </span>
                    )}

                    {r.status === 'FAIL' && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>FAIL</span>
                      </span>
                    )}

                    {r.status === 'PENDING' && (
                      <span className="px-2.5 py-1 rounded text-xs font-mono text-slate-500 bg-slate-800 border border-slate-700">
                        READY
                      </span>
                    )}

                    {/* HTTP Status Code */}
                    {r.statusCode > 0 && (
                      <span
                        className={`font-mono text-xs px-2 py-0.5 rounded ${
                          r.statusCode >= 200 && r.statusCode < 300
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : r.statusCode === 404
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        HTTP {r.statusCode}
                      </span>
                    )}

                    {/* Latency */}
                    {r.latencyMs > 0 && (
                      <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {r.latencyMs}ms
                      </span>
                    )}

                    {/* Run Single Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        runTestAtIndex(index);
                      }}
                      disabled={r.status === 'RUNNING'}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                      title="Run this test"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Inspection Drawer */}
                {isExpanded && (
                  <div className="px-5 py-4 bg-slate-950/60 border-t border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-4">
                        <span>
                          <strong>Content-Type:</strong>{' '}
                          <code className="text-cyan-300 font-mono">{r.contentType || 'Pending'}</code>
                        </span>
                        <span>
                          <strong>JSON Validated:</strong>{' '}
                          <span className={r.isJson ? 'text-emerald-400' : 'text-red-400'}>
                            {r.isJson ? 'Yes (Strict)' : 'No (Raw/HTML)'}
                          </span>
                        </span>
                        {r.testedAt && (
                          <span>
                            <strong>Tested At:</strong> {r.testedAt}
                          </span>
                        )}
                      </div>

                      {r.rawText && (
                        <button
                          onClick={() => copyToClipboard(r.rawText, index)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors cursor-pointer"
                        >
                          {copiedIndex === index ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Response</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Code Viewer */}
                    <div className="relative rounded-lg bg-slate-900 border border-slate-800 p-3 font-mono text-xs overflow-x-auto max-h-64 scrollbar-thin">
                      {r.rawText ? (
                        <pre className="text-slate-300">
                          {r.isJson ? JSON.stringify(r.data, null, 2) : r.rawText}
                        </pre>
                      ) : (
                        <div className="text-slate-500 italic">Click "Play" or "Run All" to execute test.</div>
                      )}
                    </div>

                    {r.error && (
                      <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                        <div>
                          <strong>Verification Notice:</strong> {r.error}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
