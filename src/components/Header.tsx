import React, { useEffect, useState } from 'react';
import { 
  Sparkles, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Cpu, 
  Radio
} from 'lucide-react';
import { providerStore } from '../services/providerStore';
import { AIProviderConfig } from '../types/agent';

interface HeaderProps {
  onRunPipeline: () => void;
  isRunningPipeline: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onRunPipeline, isRunningPipeline }) => {
  const [activeProvider, setActiveProvider] = useState<AIProviderConfig | undefined>(
    providerStore.getActiveProvider()
  );

  useEffect(() => {
    const unsub = providerStore.subscribe(() => {
      setActiveProvider(providerStore.getActiveProvider());
    });
    return unsub;
  }, []);

  return (
    <header id="app-header" className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">Tara AI</span>
              <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 tracking-wider">
                Autonomous
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium hidden sm:block">
              Auto-Post Content &amp; Multi-Platform Engine
            </p>
          </div>
        </div>

        {/* Live Status and Actions */}
        <div className="flex items-center gap-4">
          {/* Active AI Provider Badge */}
          <div 
            id="active-provider-badge" 
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs"
            title={`Active Provider: ${activeProvider?.name || 'Default'}`}
          >
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-300 font-medium">
              {activeProvider?.name || 'AI Engine'}
            </span>
            <span className={`w-2 h-2 rounded-full ${activeProvider?.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          </div>

          {/* Quick Run Pipeline Action */}
          <button
            id="header-run-pipeline-btn"
            onClick={onRunPipeline}
            disabled={isRunningPipeline}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-md cursor-pointer ${
              isRunningPipeline
                ? 'bg-indigo-600/50 text-indigo-200 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20 active:scale-95'
            }`}
          >
            {isRunningPipeline ? (
              <>
                <Radio className="w-4 h-4 animate-spin text-white" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current text-white" />
                <span>Run Agent Swarm</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
