import React, { useState } from 'react';
import { X, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, Save } from 'lucide-react';
import { AIProviderConfig } from '../../types/agent.ts';
import { providerStore, isMasked, MASKED_SECRET } from '../../services/providerStore.ts';
import { apiClient } from '../../services/apiClient.ts';

interface ProviderModalProps {
  provider?: AIProviderConfig | null;
  isOpen?: boolean;
  onClose: () => void;
  onSave?: (provider: AIProviderConfig) => Promise<void> | void;
  onSaved?: () => void;
  nextPriority?: number;
}

export const ProviderModal: React.FC<ProviderModalProps> = ({
  provider,
  isOpen = true,
  onClose,
  onSave,
  onSaved,
  nextPriority = 10,
}) => {
  if (isOpen === false) return null;

  const isEditing = Boolean(provider);

  const [type, setType] = useState<AIProviderConfig['type']>(provider?.type || 'gemini');
  const [name, setName] = useState(provider?.name || 'Google Gemini');
  const [model, setModel] = useState(provider?.model || provider?.modelName || 'gemini-2.5-flash');
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl || '');
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);
  const [apiKey, setApiKey] = useState(provider?.apiKey ? MASKED_SECRET : '');
  const [showKey, setShowKey] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    diagnostics?: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setErrorMsg(null);

    const cleanKey = isMasked(apiKey) ? (provider?.apiKey || '') : apiKey;

    const probeItem: AIProviderConfig = {
      id: provider?.id || 'temp',
      type,
      name,
      model,
      modelName: model,
      baseUrl: baseUrl || '',
      apiKey: cleanKey,
      enabled,
      priority: provider?.priority || nextPriority || 10,
      timeoutMs: 30000,
    };

    try {
      const res = await apiClient.testAIProvider({
        providerId: probeItem.id,
        provider: probeItem,
      });
      if (res.success) {
        setTestResult({
          success: true,
          message: `Connected (${res.latencyMs || 0}ms)`,
          diagnostics: res.model ? `Model: ${res.model}` : undefined,
        });
      } else {
        const errText = res.message || (typeof (res as any).error === 'string' ? (res as any).error : 'Connection failed');
        setTestResult({
          success: false,
          message: errText,
          diagnostics: res.errorType || (res.diagnostics ? (typeof res.diagnostics === 'string' ? res.diagnostics : JSON.stringify(res.diagnostics)) : undefined),
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Test failed with an unexpected error',
        diagnostics: err?.message,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Please specify a provider display name.');
      return;
    }

    try {
      const cleanKey = isMasked(apiKey) ? (provider?.apiKey || '') : apiKey.trim();
      const updatedProvider: AIProviderConfig = {
        id: isEditing && provider ? provider.id : `provider_${Date.now()}`,
        type,
        name: name.trim(),
        model: model.trim(),
        modelName: model.trim(),
        baseUrl: baseUrl.trim() || '',
        apiKey: cleanKey,
        enabled,
        priority: provider?.priority || nextPriority || 10,
        timeoutMs: provider?.timeoutMs || 30000,
      };

      if (onSave) {
        await onSave(updatedProvider);
      } else {
        if (isEditing && provider) {
          providerStore.updateProvider(provider.id, {
            name: name.trim(),
            model: model.trim(),
            baseUrl: baseUrl.trim() || undefined,
            apiKey,
            enabled,
          });
        } else {
          providerStore.addProvider({
            type,
            name: name.trim(),
            model: model.trim(),
            baseUrl: baseUrl.trim() || undefined,
            apiKey: isMasked(apiKey) ? '' : apiKey.trim(),
            enabled,
            priority: nextPriority || 10,
          });
        }
        if (onSaved) onSaved();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save provider configuration.');
    }
  };

  return (
    <div id="provider-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div id="provider-modal" className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {isEditing ? `Edit ${name}` : 'Configure AI Provider'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Provider Type
              </label>
              <select
                id="provider-type-select"
                value={type}
                disabled={isEditing}
                onChange={(e) => {
                  const t = e.target.value as AIProviderConfig['type'];
                  setType(t);
                  if (t === 'gemini') {
                    setName('Google Gemini');
                    setModel('gemini-2.5-flash');
                    setBaseUrl('https://generativelanguage.googleapis.com');
                  } else if (t === 'openrouter') {
                    setName('OpenRouter');
                    setModel('google/gemini-2.0-flash-001');
                    setBaseUrl('https://openrouter.ai/api/v1');
                  } else if (t === 'openai-compatible') {
                    setName('OpenAI Compatible');
                    setModel('gpt-4o-mini');
                    setBaseUrl('https://api.openai.com/v1');
                  } else {
                    setName('Custom Endpoint');
                    setModel('default');
                  }
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="gemini">Google Gemini</option>
                <option value="openrouter">OpenRouter Gateway</option>
                <option value="openai-compatible">OpenAI Compatible</option>
                <option value="custom">Custom Endpoint</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Status
              </label>
              <button
                type="button"
                id="provider-enabled-toggle"
                onClick={() => setEnabled(!enabled)}
                className={`w-full py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
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
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Display Name *
            </label>
            <input
              id="provider-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Model Identifier *
            </label>
            <input
              id="provider-model-input"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          {type === 'custom' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Custom Base URL
              </label>
              <input
                id="provider-baseurl-input"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              API Key *
            </label>
            <div className="relative">
              <input
                id="provider-key-input"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="API Key or Token"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
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
              Keys are protected with masked encryption in localStorage.
            </p>
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
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                )}
                <span>{testResult.message}</span>
              </div>
              {testResult.diagnostics && (
                <p className="mt-1 text-[11px] opacity-80 font-mono">
                  {testResult.diagnostics}
                </p>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              id="provider-test-btn"
              onClick={handleTest}
              disabled={testing || !apiKey}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="provider-save-btn"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
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
