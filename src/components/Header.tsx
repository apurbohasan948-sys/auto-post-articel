import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  OctagonX,
  RefreshCw,
  Cpu,
  Radio,
  Clock,
  ShieldCheck,
  CloudUpload,
  Layers,
} from 'lucide-react';
import { AgentStatus, AgentMode, ProviderHealth } from '../types/agent.ts';

interface HeaderProps {
  status: AgentStatus;
  mode: AgentMode;
  health?: ProviderHealth;
  isTriggering: boolean;
  onRunNow: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onOpenNetlifyGuide: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  mode,
  health,
  isTriggering,
  onRunNow,
  onPause,
  onResume,
  onStop,
  onOpenNetlifyGuide,
}) => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'UTC',
        }) + ' UTC'
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = () => {
    switch (status) {
      case 'RUNNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            PIPELINE ACTIVE
          </span>
        );
      case 'PAUSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            AGENT PAUSED
          </span>
        );
      case 'STOPPED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            EMERGENCY STOP
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            STANDBY / SCHEDULED
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Brand & Mission Control Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-cyan-500 p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Cpu className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white font-display tracking-wide">
                AXIOM <span className="text-xs font-mono font-medium text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40">v2.6 NETLIFY</span>
              </h1>
              {getStatusBadge()}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>Autonomous AI Editorial Suite</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-slate-300 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" /> {time}
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls & Health Bar */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
          {/* Mode Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-500">Mode:</span>
            <span className="font-semibold text-white">{mode}</span>
          </div>

          {/* Quick Health Signals */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <span className="flex items-center gap-1 text-slate-400">
              <span className={`w-2 h-2 rounded-full ${health?.openrouter === 'ONLINE' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              AI
            </span>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className={`w-2 h-2 rounded-full ${health?.tavily === 'ONLINE' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              Tavily
            </span>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className={`w-2 h-2 rounded-full ${health?.blogger === 'CONNECTED' ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
              Blogger
            </span>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenNetlifyGuide}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
              title="Netlify Deployment Guide"
            >
              <CloudUpload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Netlify Setup</span>
            </button>

            {status === 'RUNNING' ? (
              <button
                onClick={onPause}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-colors flex items-center gap-1.5"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </button>
            ) : status === 'PAUSED' ? (
              <button
                onClick={onResume}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/40 transition-colors flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Resume</span>
              </button>
            ) : null}

            <button
              onClick={onStop}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-colors flex items-center gap-1.5"
              title="Emergency halt running executions"
            >
              <OctagonX className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Emergency</span> Stop
            </button>

            <button
              onClick={onRunNow}
              disabled={isTriggering || status === 'RUNNING'}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all shadow-lg flex items-center gap-1.5 ${
                isTriggering || status === 'RUNNING'
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/20 cursor-pointer'
              }`}
            >
              <Play className={`w-3.5 h-3.5 ${isTriggering ? 'animate-spin' : ''}`} />
              <span>{isTriggering ? 'Executing...' : 'Run Cycle Now'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
