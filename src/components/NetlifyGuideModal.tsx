import React, { useState } from 'react';
import {
  X,
  CloudUpload,
  Terminal,
  CheckCircle2,
  Copy,
  Key,
  ShieldCheck,
  ExternalLink,
  Code,
  Layers,
} from 'lucide-react';

interface NetlifyGuideModalProps {
  onClose: () => void;
}

export const NetlifyGuideModal: React.FC<NetlifyGuideModalProps> = ({ onClose }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const envVars = [
    { name: 'OPENROUTER_API_KEY', req: true, desc: 'API key for OpenRouter AI provider chain' },
    { name: 'GEMINI_API_KEY', req: true, desc: 'API key for Google Gemini provider fallback' },
    { name: 'TAVILY_API_KEY', req: true, desc: 'Tavily web search API key for factual grounding' },
    { name: 'BLOGGER_BLOG_ID', req: true, desc: 'Numeric Blogger Blog identifier' },
    { name: 'BLOGGER_CLIENT_ID', req: false, desc: 'Google Cloud OAuth 2.0 Client ID' },
    { name: 'BLOGGER_CLIENT_SECRET', req: false, desc: 'Google Cloud OAuth 2.0 Client Secret' },
    { name: 'BLOGGER_REFRESH_TOKEN', req: false, desc: 'Google OAuth long-lived refresh token' },
    { name: 'FACEBOOK_PAGE_ACCESS_TOKEN', req: false, desc: 'Meta Graph API Page token' },
    { name: 'TELEGRAM_BOT_TOKEN', req: false, desc: 'Telegram Bot token from @BotFather' },
    { name: 'TELEGRAM_CHAT_ID', req: false, desc: 'Target channel or group chat ID (@my_channel)' },
    { name: 'LINKEDIN_ACCESS_TOKEN', req: false, desc: 'LinkedIn OAuth access token' },
    { name: 'X_ACCESS_TOKEN', req: false, desc: 'X (Twitter) user access token' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Netlify Production Deployment Blueprint
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Preconfigured with netlify.toml, Scheduled Functions, & Serverless API
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs">
          {/* Section 1: Architecture Summary */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <h3 className="font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              How the Netlify Architecture Works
            </h3>
            <p className="text-slate-300 leading-relaxed">
              This application is architected natively for Netlify. The static frontend is built with Vite into <code className="text-cyan-400 font-mono">dist/</code>.
              Autonomous cron scheduling runs automatically via <code className="text-cyan-400 font-mono">netlify/functions/scheduler.ts</code> configured in <code className="text-cyan-400 font-mono">netlify.toml</code>.
              API endpoints route through <code className="text-cyan-400 font-mono">netlify/functions/api.ts</code>.
            </p>
          </div>

          {/* Section 2: Step-by-Step Deployment Guide */}
          <div className="space-y-3">
            <h3 className="font-bold text-white uppercase tracking-wider font-mono">
              3-Step Deployment Guide
            </h3>

            <div className="space-y-2.5">
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-bold text-cyan-400">Step 1: Push Repository to GitHub</div>
                <p className="text-slate-400">
                  Export or push your project to a GitHub repository. Netlify connects directly to GitHub.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-bold text-cyan-400">Step 2: Import in Netlify Dashboard</div>
                <p className="text-slate-400">
                  Log in to <span className="text-white">app.netlify.com</span> &gt; Add new site &gt; Import from Git.
                  The <code className="text-cyan-400 font-mono">netlify.toml</code> file will auto-configure the build command (<code className="text-cyan-400 font-mono">npm run build</code>) and publish directory (<code className="text-cyan-400 font-mono">dist</code>).
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-bold text-cyan-400">Step 3: Add Netlify Environment Variables</div>
                <p className="text-slate-400">
                  In Netlify Site configuration &gt; Environment variables, add the secret keys below.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Environment Variables Checklist */}
          <div className="space-y-3">
            <h3 className="font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-400" />
              Environment Variables Checklist
            </h3>

            <div className="space-y-2 font-mono">
              {envVars.map((v, i) => (
                <div
                  key={v.name}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-[11px]"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">{v.name}</span>
                      {v.req ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-500/20 text-rose-300 font-bold">REQUIRED</span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-400">OPTIONAL</span>
                      )}
                    </div>
                    <p className="text-slate-500 font-sans text-[11px]">{v.desc}</p>
                  </div>

                  <button
                    onClick={() => copyToClipboard(v.name, i)}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Copy variable name"
                  >
                    {copiedIndex === i ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Testing the Scheduled Function via cURL */}
          <div className="space-y-2">
            <h3 className="font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              Test Cron Trigger Command
            </h3>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-cyan-300 relative">
              <code>curl -X POST https://your-app.netlify.app/.netlify/functions/scheduler</code>
              <button
                onClick={() =>
                  copyToClipboard('curl -X POST https://your-app.netlify.app/.netlify/functions/scheduler', 99)
                }
                className="absolute right-2.5 top-2.5 p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                {copiedIndex === 99 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
