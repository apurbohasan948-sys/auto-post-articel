import React, { useState, useEffect } from 'react';
import {
  Globe,
  Facebook,
  Instagram,
  Youtube,
  Video,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { integrationStore } from '../../services/integrationStore.ts';
import { BloggerIntegration, SocialIntegration } from '../../types/integrations.ts';

interface IntegrationStatusCardProps {
  onNavigateToIntegrations?: (subtab?: 'blogger' | 'social') => void;
}

type DisplayState = 'Connected' | 'Failed' | 'Disabled' | 'Not Configured';

interface ChannelStatus {
  id: string;
  name: string;
  icon: React.ReactNode;
  state: DisplayState;
  latencyMs?: number;
  error?: string;
  lastTestedAt?: string;
  subtab: 'blogger' | 'social';
  activeCount: number;
}

export const IntegrationStatusCard: React.FC<IntegrationStatusCardProps> = ({
  onNavigateToIntegrations,
}) => {
  const [bloggers, setBloggers] = useState<BloggerIntegration[]>(() =>
    integrationStore.loadBlogger()
  );
  const [socials, setSocials] = useState<SocialIntegration[]>(() =>
    integrationStore.loadSocial()
  );

  useEffect(() => {
    setBloggers(integrationStore.loadBlogger());
    setSocials(integrationStore.loadSocial());

    const unsubB = integrationStore.subscribeBlogger((b) => setBloggers(b));
    const unsubS = integrationStore.subscribeSocial((s) => setSocials(s));

    return () => {
      unsubB();
      unsubS();
    };
  }, []);

  // Compute status for Blogger
  const getBloggerStatus = (): {
    state: DisplayState;
    latencyMs?: number;
    error?: string;
    lastTestedAt?: string;
    activeCount: number;
  } => {
    if (!bloggers || bloggers.length === 0) {
      return { state: 'Not Configured', activeCount: 0 };
    }
    const enabled = bloggers.filter((b) => b.enabled);
    if (enabled.length === 0) {
      return { state: 'Disabled', activeCount: 0 };
    }

    // Look for verified test
    const connected = enabled.find((b) => b.lastTestStatus === 'CONNECTED');
    if (connected) {
      return {
        state: 'Connected',
        latencyMs: connected.lastLatencyMs,
        lastTestedAt: connected.lastTestedAt,
        activeCount: enabled.length,
      };
    }

    const failed = enabled.find((b) => b.lastTestStatus === 'FAILED');
    if (failed) {
      return {
        state: 'Failed',
        latencyMs: failed.lastLatencyMs,
        error: failed.lastError,
        lastTestedAt: failed.lastTestedAt,
        activeCount: enabled.length,
      };
    }

    return { state: 'Not Configured', activeCount: enabled.length };
  };

  // Compute status for each social platform
  const getSocialStatus = (
    platform: 'facebook' | 'instagram' | 'youtube' | 'tiktok'
  ): {
    state: DisplayState;
    latencyMs?: number;
    error?: string;
    lastTestedAt?: string;
    activeCount: number;
  } => {
    const items = socials.filter((s) => s.platform === platform);
    if (!items || items.length === 0) {
      return { state: 'Not Configured', activeCount: 0 };
    }
    const enabled = items.filter((s) => s.enabled);
    if (enabled.length === 0) {
      return { state: 'Disabled', activeCount: 0 };
    }

    const connected = enabled.find((s) => s.lastTestStatus === 'CONNECTED');
    if (connected) {
      return {
        state: 'Connected',
        latencyMs: connected.lastLatencyMs,
        lastTestedAt: connected.lastTestedAt,
        activeCount: enabled.length,
      };
    }

    const failed = enabled.find((s) => s.lastTestStatus === 'FAILED');
    if (failed) {
      return {
        state: 'Failed',
        latencyMs: failed.lastLatencyMs,
        error: failed.lastError,
        lastTestedAt: failed.lastTestedAt,
        activeCount: enabled.length,
      };
    }

    return { state: 'Not Configured', activeCount: enabled.length };
  };

  const bStatus = getBloggerStatus();
  const fbStatus = getSocialStatus('facebook');
  const igStatus = getSocialStatus('instagram');
  const ytStatus = getSocialStatus('youtube');
  const ttStatus = getSocialStatus('tiktok');

  const channels: ChannelStatus[] = [
    {
      id: 'blogger',
      name: 'Blogger',
      icon: <Globe className="w-4 h-4 text-orange-400" />,
      state: bStatus.state,
      latencyMs: bStatus.latencyMs,
      error: bStatus.error,
      lastTestedAt: bStatus.lastTestedAt,
      subtab: 'blogger',
      activeCount: bStatus.activeCount,
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: <Facebook className="w-4 h-4 text-blue-400" />,
      state: fbStatus.state,
      latencyMs: fbStatus.latencyMs,
      error: fbStatus.error,
      lastTestedAt: fbStatus.lastTestedAt,
      subtab: 'social',
      activeCount: fbStatus.activeCount,
    },
    {
      id: 'instagram',
      name: 'Instagram',
      icon: <Instagram className="w-4 h-4 text-pink-400" />,
      state: igStatus.state,
      latencyMs: igStatus.latencyMs,
      error: igStatus.error,
      lastTestedAt: igStatus.lastTestedAt,
      subtab: 'social',
      activeCount: igStatus.activeCount,
    },
    {
      id: 'youtube',
      name: 'YouTube',
      icon: <Youtube className="w-4 h-4 text-red-400" />,
      state: ytStatus.state,
      latencyMs: ytStatus.latencyMs,
      error: ytStatus.error,
      lastTestedAt: ytStatus.lastTestedAt,
      subtab: 'social',
      activeCount: ytStatus.activeCount,
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      icon: <Video className="w-4 h-4 text-cyan-400" />,
      state: ttStatus.state,
      latencyMs: ttStatus.latencyMs,
      error: ttStatus.error,
      lastTestedAt: ttStatus.lastTestedAt,
      subtab: 'social',
      activeCount: ttStatus.activeCount,
    },
  ];

  const getBadgeStyle = (state: DisplayState) => {
    switch (state) {
      case 'Connected':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'Failed':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'Disabled':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Not Configured':
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="cyber-panel p-5 rounded-xl border border-slate-800 space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Integrations & Outbound Channels Status
            </h3>
            <p className="text-[11px] text-slate-400">
              Real connection status from live API tests across publishing endpoints.
            </p>
          </div>
        </div>

        {onNavigateToIntegrations && (
          <button
            type="button"
            onClick={() => onNavigateToIntegrations('blogger')}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
          >
            <span>Manage Integrations</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {channels.map((ch) => (
          <div
            key={ch.id}
            onClick={() => onNavigateToIntegrations?.(ch.subtab)}
            className="p-3 bg-slate-950/60 border border-slate-850 hover:border-slate-700 rounded-xl transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs">
                {ch.icon}
                <span>{ch.name}</span>
              </div>
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${getBadgeStyle(
                  ch.state
                )}`}
              >
                {ch.state}
              </span>
            </div>

            <div className="text-[10px] text-slate-400 space-y-0.5 font-mono">
              {ch.state === 'Connected' && (
                <div className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>Verified ({ch.latencyMs || 0}ms)</span>
                </div>
              )}
              {ch.state === 'Failed' && (
                <div className="flex items-center gap-1 text-rose-400 truncate" title={ch.error}>
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span className="truncate">{ch.error || 'Connection Failed'}</span>
                </div>
              )}
              {ch.state === 'Disabled' && (
                <span className="text-amber-400">Account Disabled</span>
              )}
              {ch.state === 'Not Configured' && (
                <span className="text-slate-500">Not Configured</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
