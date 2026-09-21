import React, { useState } from 'react';
import {
  Settings,
  Save,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Globe,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import { SystemSettings } from '../types/agent.ts';

interface SettingsViewProps {
  settings: SystemSettings;
  onUpdateSettings: (settings: Partial<SystemSettings>) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [formData, setFormData] = useState<SystemSettings>(settings);
  const [isSaved, setIsSaved] = useState(false);

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const handleToggleDay = (day: string) => {
    const current = formData.activeDays || [];
    if (current.includes(day)) {
      setFormData({ ...formData, activeDays: current.filter((d) => d !== day) });
    } else {
      setFormData({ ...formData, activeDays: [...current, day] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="cyber-panel p-5 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white font-display">
              Autonomous Operations & Policy Settings
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure editorial niche, target audience, publication frequency, quiet hours, and cost guardrails.
          </p>
        </div>

        {isSaved && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-xs font-mono text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Settings Saved Successfully</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Editorial Core */}
        <div className="cyber-panel p-5 sm:p-6 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-800 pb-2">
            1. Editorial & Linguistic Direction
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Content Niche</label>
              <input
                type="text"
                value={formData.contentNiche}
                onChange={(e) => setFormData({ ...formData, contentNiche: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Target Language</label>
              <select
                value={formData.language}
                onChange={(e) =>
                  setFormData({ ...formData, language: e.target.value as 'English' | 'Bengali' | 'Banglish' })
                }
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              >
                <option value="English">English (Global Technical Standard)</option>
                <option value="Bengali">Bengali (বাংলা Standard Prose)</option>
                <option value="Banglish">Banglish (Conversational Tech Hybrid)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Target Audience</label>
              <input
                type="text"
                value={formData.targetAudience}
                onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* 2. Autonomous Mode & Quality Loops */}
        <div className="cyber-panel p-5 sm:p-6 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-800 pb-2">
            2. Autonomous Execution Mode & Quality Loops
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <label className="text-slate-200 font-semibold block">Execution Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, mode: 'AUTO' })}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    formData.mode === 'AUTO'
                      ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-xs">AUTO Mode</div>
                  <div className="text-[11px] opacity-80 font-normal mt-0.5">
                    Publishes & distributes immediately upon Quality Pass.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, mode: 'APPROVAL' })}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    formData.mode === 'APPROVAL'
                      ? 'bg-indigo-950/50 border-indigo-500 text-indigo-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-xs">APPROVAL Mode</div>
                  <div className="text-[11px] opacity-80 font-normal mt-0.5">
                    Requires human review and sign-off before publishing.
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <label className="text-slate-200 font-semibold block">Maximum Quality Rewrite Attempts</label>
              <input
                type="number"
                min={1}
                max={5}
                value={formData.maxRewriteAttempts}
                onChange={(e) =>
                  setFormData({ ...formData, maxRewriteAttempts: parseInt(e.target.value, 10) || 2 })
                }
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono"
              />
              <p className="text-[11px] text-slate-400">
                If the Quality Auditor flags unsupported claims, Writer revises up to this limit before marking FAIL.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Schedule, Active Days & Quiet Hours */}
        <div className="cyber-panel p-5 sm:p-6 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-800 pb-2">
            3. Scheduled Timings & Quiet Hours
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-300 font-semibold block mb-1.5">
                Active Publishing Days
              </label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map((day) => {
                  const active = formData.activeDays?.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleToggleDay(day)}
                      className={`px-3.5 py-1.5 rounded-lg border font-mono font-bold cursor-pointer transition-colors ${
                        active
                          ? 'bg-cyan-950 text-cyan-300 border-cyan-500'
                          : 'bg-slate-950 text-slate-500 border-slate-800'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Quiet Hours Start (UTC Hour, 0-23)</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={formData.quietHoursStart}
                  onChange={(e) =>
                    setFormData({ ...formData, quietHoursStart: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Quiet Hours End (UTC Hour, 0-23)</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={formData.quietHoursEnd}
                  onChange={(e) =>
                    setFormData({ ...formData, quietHoursEnd: parseInt(e.target.value, 10) || 6 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4. Cost Control & Quotas */}
        <div className="cyber-panel p-5 sm:p-6 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-800 pb-2">
            4. Cost Guardrails & Daily Ceilings
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Max Articles Per Day</label>
              <input
                type="number"
                value={formData.maxArticlesPerDay}
                onChange={(e) =>
                  setFormData({ ...formData, maxArticlesPerDay: parseInt(e.target.value, 10) || 3 })
                }
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Max AI API Calls / Day</label>
              <input
                type="number"
                value={formData.maxAICallsPerDay}
                onChange={(e) =>
                  setFormData({ ...formData, maxAICallsPerDay: parseInt(e.target.value, 10) || 60 })
                }
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Max Web Search Calls / Day</label>
              <input
                type="number"
                value={formData.maxWebSearchesPerDay}
                onChange={(e) =>
                  setFormData({ ...formData, maxWebSearchesPerDay: parseInt(e.target.value, 10) || 20 })
                }
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20"
          >
            <Save className="w-4 h-4" />
            <span>{isSaved ? 'Settings Saved' : 'Save System Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
