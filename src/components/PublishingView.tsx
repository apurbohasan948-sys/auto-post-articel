import React, { useState } from 'react';
import {
  Share2,
  Globe,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Send,
  Save,
  Key,
} from 'lucide-react';
import { BloggerConfig } from '../types/agent.ts';

interface PublishingViewProps {
  bloggerConfig: BloggerConfig;
  onUpdateBlogger: (config: BloggerConfig) => void;
}

export const PublishingView: React.FC<PublishingViewProps> = ({
  bloggerConfig,
  onUpdateBlogger,
}) => {
  const [config, setConfig] = useState<BloggerConfig>(bloggerConfig);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateBlogger(config);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const socialChannels = [
    {
      name: 'Facebook Page',
      envVar: 'FACEBOOK_PAGE_ACCESS_TOKEN & FACEBOOK_PAGE_ID',
      status: 'READY (CONFIGURED VIA ENV)',
      icon: '📘',
      desc: 'Publishes conversational editorial announcements and direct article links to your official Facebook Page.',
    },
    {
      name: 'Telegram Channel',
      envVar: 'TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID',
      status: 'READY (CONFIGURED VIA ENV)',
      icon: '✈️',
      desc: 'Dispatches instant formatted markdown summaries and article read links to subscribers in Telegram.',
    },
    {
      name: 'LinkedIn Thought Leadership',
      envVar: 'LINKEDIN_ACCESS_TOKEN & LINKEDIN_ORG_ID',
      status: 'READY (CONFIGURED VIA ENV)',
      icon: '💼',
      desc: 'Shares professional research recaps and industry takeaways on your LinkedIn organization profile.',
    },
    {
      name: 'X (Twitter) Feed & Thread',
      envVar: 'X_ACCESS_TOKEN & X_ACCESS_SECRET',
      status: 'READY (CONFIGURED VIA ENV)',
      icon: '🐦',
      desc: 'Posts punchy insights and link teasers under 280 characters to trigger developer discussions.',
    },
    {
      name: 'Threads Feed',
      envVar: 'THREADS_ACCESS_TOKEN',
      status: 'READY (CONFIGURED VIA ENV)',
      icon: '🧵',
      desc: 'Broadcasts casual conversational highlights into Meta Threads ecosystem.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="cyber-panel p-5 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white font-display">
              Blogger API & Multi-Network Social Distribution
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure your Google Blogger destination blog and monitor outbound social amplification channels.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span
            className={`px-3 py-1 rounded-lg border font-bold ${
              config.isConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {config.isConnected ? 'BLOGGER CONNECTED' : 'AWAITING OAUTH / BLOG ID'}
          </span>
        </div>
      </div>

      {/* 1. Blogger Configuration Panel */}
      <div className="cyber-panel p-5 sm:p-6 rounded-xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Blogger Target Configuration
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Google Blogger REST API v3
          </span>
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center justify-between">
              <span>Blogger Blog ID</span>
              <span className="text-slate-500 font-mono font-normal">Found in Blogger URL</span>
            </label>
            <input
              type="text"
              value={config.blogId}
              onChange={(e) => setConfig({ ...config, blogId: e.target.value })}
              placeholder="e.g. 8492049281048291048"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center justify-between">
              <span>Public Blog URL</span>
              <span className="text-slate-500 font-mono font-normal">Domain or blogspot</span>
            </label>
            <input
              type="text"
              value={config.blogUrl}
              onChange={(e) => setConfig({ ...config, blogUrl: e.target.value })}
              placeholder="https://yourblog.blogspot.com"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="text-slate-300 font-semibold">
              Default Article Labels / Tags (comma separated)
            </label>
            <input
              type="text"
              value={config.defaultLabels.join(', ')}
              onChange={(e) =>
                setConfig({
                  ...config,
                  defaultLabels: e.target.value.split(',').map((l) => l.trim()).filter(Boolean),
                })
              }
              placeholder="Technology, AI Systems, Cloud Architecture"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={config.isConnected}
                  onChange={(e) => setConfig({ ...config, isConnected: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-cyan-500"
                />
                <span>Mark Blogger integration as Active / Connected</span>
              </label>
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaved ? 'Settings Saved!' : 'Save Blogger Configuration'}</span>
            </button>
          </div>
        </form>

        <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-1">
          <span className="font-bold text-slate-300 block font-mono">Blogger OAuth Token Note:</span>
          <p>
            When deployed to Netlify, set <code className="text-cyan-400 font-mono">BLOGGER_CLIENT_ID</code>,{' '}
            <code className="text-cyan-400 font-mono">BLOGGER_CLIENT_SECRET</code>, and{' '}
            <code className="text-cyan-400 font-mono">BLOGGER_REFRESH_TOKEN</code> in your Netlify Environment Variables.
            The agent will refresh the OAuth access token automatically.
          </p>
        </div>
      </div>

      {/* 2. Social Media Distribution Matrix */}
      <div className="cyber-panel p-5 sm:p-6 rounded-xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Social Amplification Channels Matrix
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Direct API Adapters
          </span>
        </div>

        <div className="space-y-3">
          {socialChannels.map((ch, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-base">{ch.icon}</span>
                  <span className="text-xs font-bold text-white font-display">{ch.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-emerald-400 border border-slate-800">
                    {ch.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{ch.desc}</p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] font-mono text-slate-500 block">
                  Target Netlify Env:
                </span>
                <code className="text-[10px] font-mono text-cyan-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {ch.envVar}
                </code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
