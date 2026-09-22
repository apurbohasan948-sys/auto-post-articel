import React from 'react';
import { 
  LayoutDashboard, 
  Compass, 
  BookOpen, 
  FileText, 
  Share2, 
  TrendingUp, 
  Terminal, 
  Settings 
} from 'lucide-react';
import { NavigationTab } from '../types/agent';

interface NavigationProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
}

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'topics', label: 'Topics Scout', icon: Compass },
  { id: 'research', label: 'Deep Research', icon: BookOpen },
  { id: 'articles', label: 'Articles', icon: FileText },
  { id: 'publishing', label: 'Publishing', icon: Share2 },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'logs', label: 'Agent Logs', icon: Terminal },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav id="app-navigation" className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-16 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2.5 scrollbar-none">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
