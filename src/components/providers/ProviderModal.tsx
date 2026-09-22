import React, { useState } from 'react';
import {
  X,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Sparkles,
  Eye,
  EyeOff,
  Zap,
  HelpCircle,
} from 'lucide-react';
import { AIProviderConfig, AITestResult } from '../../types/agent.ts';
import { apiClient } from '../../services/apiClient.ts';

interface ProviderModalProps {
  provider: AIProviderConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (provider: AIProviderConfig) => void;
  nextPriority: number;
}

const TEMPLATES: Array<{
  name: string;
  type: AIProviderConfig['type'];
  defaultModel: string;
  baseUrl: string;
  description: string;
}> = [
  {
    name: 'OpenRouter (Multi-Model)',
    type: 'openrouter',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    baseUrl: 'https://openrouter.ai/api/v1',
    description: 'Unified gateway to Claude 3.5, GPT-4o, Llama 3, DeepSeek, and 200+ models.',
  },
  {
    name: 'Google Gemini',
    type: 'gemini',
    defaultModel: 'gemini-1.5-pro',
    baseUrl: '',
    description: 'Google DeepMind multimodal Gemini 1.5 Pro with large context window.',
  },
  {
    name: 'OpenAI Direct',
    type: 'custom_openai',
    defaultModel: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    description: 'Direct official OpenAI API endpoint.',
  },
  {
    name: 'Groq Cloud (Ultra-Fast)',
    type: 'custom_openai',
    defaultModel: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
    description: 'Sub-second LPU inference for high-speed drafting & agent passes.',
  },
  {
    name: 'DeepSeek Official',
    type: 'custom_openai',
    defaultModel: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com/v1',
    description: 'DeepSeek V3 & R1 reasoning models with OpenAI-compatible API.',
  },
  {
    name: 'Together AI',
    type: 'custom_openai',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    baseUrl: 'https://api.together.xyz/v1',
    description: 'Serverless open-source models with high reliability.',
  },
  {
    name: 'Ollama (Local / Self-Hosted)',
    type: 'custom_openai',
    defaultModel: 'llama3.2',
    baseUrl: 'http://localhost:11434/v1',
    description: 'Run completely offline on local GPU or private cloud instance.',
  },
  {
    name: 'Custom OpenAI-Compatible',
    type: 'custom_openai',
    defaultModel: 'custom-model',
    baseUrl: 'https://your-custom-gateway.com/v1',
    description: 'Any v1/chat/completions compatible LLM gateway or proxy.',
  },
];

export const ProviderModal: React.FC<ProviderModalProps> = ({
  provider,
  isOpen,
  onClose,
  onSave,
  nextPriority,
}) => {
  if (!isOpen) return null;

  const isEditing = Boolean(provider);

  const [formData, setFormData] = useState<AIProviderConfig>(() => {
    if (provider) {
      return { ...provider };
    }
    return {
      id: `ai-${Date.now()}`,
      name: 'New AI Provider',
      type: 'custom_openai',
      modelName: 'gpt-4o-mini',
      defaultModel: 'gpt-4o-mini',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      enabled: true,
      priority: nextPriority,
      timeoutMs: 60000,
      maxTokens: 4000,
      temperature: 0.7,
      headers: {},
      capabilities: {
        jsonMode: true,
        toolCalling: false,
        webGrounding: false,
        vision: false,
      },
      lastTestStatus: 'NEVER_TESTED',
    };
  });

  const [headersJson, setHeadersJson] = useState<string>(() => {
    return formData.headers && Object.keys(formData.headers).length > 0
      ? JSON.stringify(formData.headers, null, 2)
      : '';
  });

  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AITestResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleApplyTemplate = (tpl: (typeof TEMPLATES)[number]) => {
    setFormData((prev) => ({
      ...prev,
      name: tpl.name.split(' (')[0],
      type: tpl.type,
      modelName: tpl.defaultModel,
      defaultModel: tpl.defaultModel,
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
      let parsedHeaders: Record<string, string> | undefined = undefined;
      if (headersJson.trim()) {
        try {
          parsedHeaders = JSON.parse(headersJson);
        } catch {
          throw new Error('Custom headers must be valid JSON');
        }
      }

      const payload: AIProviderConfig = {
        ...formData,
        modelName: formData.modelName || formData.defaultModel || 'gpt-4o',
        baseUrl: formData.baseUrl || '',
        headers: parsedHeaders,
      };

      const res = await apiClient.testAIProvider({ provider: payload });
      setTestResult(res);
      if (!res.success) {
        const errText =
          typeof res.error === 'string'
            ? res.error
            : (res.error as any)?.message || 'Test failed without explicit error details';
        setErrorMsg(errText);
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

    let parsedHeaders: Record<string, string> = {};
    if (headersJson.trim()) {
      try {
        parsedHeaders = JSON.parse(headersJson);
      } catch {
        setErrorMsg('Custom headers must be valid JSON format');
        return;
      }
    }

    onSave({
      ...formData,
      modelName: formData.modelName || formData.defaultModel || 'gpt-4o',
      defaultModel: formData.defaultModel || formData.modelName || 'gpt-4o',
      baseUrl: formData.baseUrl || '',
      headers: parsedHeaders,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                {isEditing ? `Edit AI Provider: ${formData.name}` : 'Add AI Provider'}
              </h2>
              <p className="text-xs text-slate-400">
                Configure credentials, base URL, model identifiers, and capabilities.
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

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Quick Pre-Configured Templates (Only when adding or user wants to switch) */}
          {!isEditing && (
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Quick Templates
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => handleApplyTemplate(t)}
                    className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/40 text-left transition-all cursor-pointer group"
                  >
                    <div className="text-[11px] font-bold text-slate-200 group-hover:text-cyan-300 truncate">
                      {t.name.split(' (')[0]}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 truncate">
                      {t.defaultModel}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Core Identification */}
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
                placeholder="e.g., OpenRouter Primary"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 font-mono">
                API Type / Protocol
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as AIProviderConfig['type'],
                  })
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="openrouter">OpenRouter (Unified)</option>
                <option value="gemini">Google Gemini SDK</option>
                <option value="custom_openai">OpenAI Compatible (v1/chat/completions)</option>
                <option value="custom_rest">Custom REST Endpoint</option>
              </select>
            </div>
          </div>

          {/* Model Name & Base URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 font-mono">
                Model Name / Identifier <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formData.modelName || formData.defaultModel}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    modelName: e.target.value,
                    defaultModel: e.target.value,
                  })
                }
                required
                placeholder="e.g. anthropic/claude-3.5-sonnet, gpt-4o"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 font-mono flex items-center justify-between">
                <span>Base URL</span>
                {formData.type === 'gemini' && (
                  <span className="text-[10px] text-slate-500">(Optional for Gemini SDK)</span>
                )}
              </label>
              <input
                type="text"
                value={formData.baseUrl || ''}
                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          {/* API Key (Encrypted Server-Side) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 font-mono flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-cyan-400" />
                API Key (Stored with AES-256 Server-Side Encryption)
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {formData.hasKey ? 'Key is currently configured' : 'No key stored'}
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
                    : 'Paste API Key (sk-..., AIzaSy..., etc.)'
                }
                className="w-full px-3 py-2 pr-10 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Keys are encrypted at rest using AES-256-GCM. Unchanged masked inputs preserve existing server secrets.
            </p>
          </div>

          {/* Routing & Parameters */}
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
              <label className="text-slate-400 font-mono text-[11px]">Timeout (ms)</label>
              <input
                type="number"
                step="1000"
                min="1000"
                value={formData.timeoutMs}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    timeoutMs: parseInt(e.target.value, 10) || 60000,
                  })
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-mono text-[11px]">Max Tokens</label>
              <input
                type="number"
                step="500"
                min="500"
                max="32000"
                value={formData.maxTokens || 4000}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maxTokens: parseInt(e.target.value, 10) || 4000,
                  })
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-mono text-[11px]">Temperature</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={formData.temperature ?? 0.7}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    temperature: parseFloat(e.target.value) || 0.7,
                  })
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
              />
            </div>
          </div>

          {/* Capabilities */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
              Provider Capabilities
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'jsonMode', label: 'JSON Mode' },
                { id: 'toolCalling', label: 'Tool Calling' },
                { id: 'webGrounding', label: 'Web Grounding' },
                { id: 'vision', label: 'Vision / Image' },
              ].map((cap) => {
                const key = cap.id as keyof typeof formData.capabilities;
                const checked = Boolean(formData.capabilities?.[key]);
                return (
                  <label
                    key={cap.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 cursor-pointer hover:border-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          capabilities: {
                            ...formData.capabilities,
                            [key]: e.target.checked,
                          },
                        })
                      }
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                    />
                    <span>{cap.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Optional Headers JSON */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 font-mono flex items-center justify-between">
              <span>Optional Custom HTTP Headers (JSON)</span>
              <span className="text-[10px] text-slate-500">e.g. {'{"HTTP-Referer": "https://..."}'}</span>
            </label>
            <textarea
              rows={2}
              value={headersJson}
              onChange={(e) => setHeadersJson(e.target.value)}
              placeholder='{"Authorization-Extra": "custom-val"}'
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Enabled Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
            <div>
              <span className="text-xs font-bold text-white">Enable this provider</span>
              <p className="text-[11px] text-slate-400">
                When enabled, the orchestrator includes this provider in the fallback sequence.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
            </label>
          </div>

          {/* Test Status Banner if test executed */}
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
              {testResult.sampleOutput && (
                <div className="text-[11px] p-2 rounded bg-slate-950/80 border border-slate-800 text-slate-300">
                  <span className="font-bold text-slate-400 block mb-0.5">Response:</span>
                  {testResult.sampleOutput}
                </div>
              )}
              {testResult.error && (
                <div className="text-[11px] text-rose-300 font-mono">
                  {typeof testResult.error === 'string'
                    ? testResult.error
                    : (testResult.error as any)?.message || JSON.stringify(testResult.error)}
                </div>
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
            className="px-3.5 py-2 rounded-lg text-xs font-bold font-mono bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Zap className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            <span>{testing ? 'Testing Endpoint...' : 'Live Ping Test'}</span>
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
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors shadow-lg cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Save Changes' : 'Add Provider'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
