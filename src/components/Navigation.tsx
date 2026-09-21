import React from 'react';
import {
  LayoutDashboard,
  GitFork,
  Compass,
  FileText,
  Search,
  Share2,
  Cpu,
  Brain,
  Terminal,
  Settings,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'pipeline'
  | 'topics'
  | 'articles'
  | 'research'
  | 'publishing'
  | 'providers'
  | 'analytics'
  | 'logs'
  | 'settings';

interface NavigationProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  counts: {
    topics: number;
    articles: number;
    jobs: number;
    logs: number;
  };
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onChangeTab, counts }) => {
  const tabs = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pipeline' as NavTab, label: '12-Agent Pipeline', icon: GitFork, badge: 'Live' },
    { id: 'topics' as NavTab, label: 'Topic Scout', icon: Compass, count: counts.topics },
    { id: 'articles' as NavTab, label: 'Articles & Review', icon: FileText, count: counts.articles },
    { id: 'research' as NavTab, label: 'Tavily Research', icon: Search },
    { id: 'publishing' as NavTab, label: 'Blogger & Social', icon: Share2 },
    { id: 'providers' as NavTab, label: 'AI & Search APIs', icon: Cpu },
    { id: 'analytics' as NavTab, label: 'Analytics & Memory', icon: Brain },
    { id: 'logs' as NavTab, label: 'System Logs', icon: Terminal, count: counts.logs },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="border-b border-slate-800 bg-slate-900/60 px-4 sm:px-6 overflow-x-auto scrollbar-none">
      <div className="max-w-7xl mx-auto flex items-center gap-1 py-1.5 min-w-max">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700/80'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>

              {tab.badge && (
                <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {tab.badge}
                </span>
              )}

              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
