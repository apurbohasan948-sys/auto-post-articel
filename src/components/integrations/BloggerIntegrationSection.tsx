import React, { useState, useEffect } from 'react';
import {
  Globe,
  Plus,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Edit2,
  ExternalLink,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { BloggerIntegration } from '../../types/integrations.ts';
import { integrationStore } from '../../services/integrationStore.ts';
import { bloggerAdapter } from '../../services/adapters/BloggerAdapter.ts';
import { BloggerModal } from './BloggerModal.tsx';

export const BloggerIntegrationSection: React.FC = () => {
  const [integrations, setIntegrations] = useState<BloggerIntegration[]>(() =>
    integrationStore.loadBlogger()
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BloggerIntegration | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // Initial load
    setIntegrations(integrationStore.loadBlogger());

    // Subscribe to store updates (and multi-tab sync)
    const unsubscribe = integrationStore.subscribeBlogger((updated) => {
      setIntegrations(updated);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: BloggerIntegration) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete Blogger configuration "${name}"?`)) {
      integrationStore.removeBlogger(id);
      showToast(`Blogger configuration "${name}" removed.`);
    }
  };

  const handleToggleEnabled = (id: string) => {
    integrationStore.toggleBloggerEnabled(id);
  };

  const handleTestInline = async (item: BloggerIntegration) => {
    setTestingId(item.id);
    const result = await bloggerAdapter.testConnection(item);
    setTestingId(null);
    integrationStore.recordBloggerTestResult(item.id, result);

    if (result.success) {
      showToast(`Connection verified (${result.latencyMs}ms): Connected to blog`);
    } else {
      showToast(`Connection failed (${result.latencyMs}ms): ${result.error || 'Unknown error'}`);
    }
  };

  const handleSave = (saved: BloggerIntegration) => {
    if (editingItem) {
      integrationStore.updateBlogger(saved.id, saved);
      showToast(`Blogger configuration "${saved.name}" updated successfully.`);
    } else {
      integrationStore.addBlogger(saved);
      showToast(`Blogger configuration "${saved.name}" added successfully.`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-300 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="cyber-panel p-5 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
              <Globe className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-display">
                Blogger Integrations
              </h3>
              <p className="text-xs text-slate-400">
                Manage destination Google Blogger blogs for autonomous article publishing.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white font-semibold rounded-xl flex items-center gap-2 text-xs shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Blogger Account</span>
        </button>
      </div>

      {/* Integrations List */}
      {integrations.length === 0 ? (
        <div className="p-8 border border-dashed border-slate-800 rounded-2xl text-center bg-slate-900/40">
          <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Globe className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-white mb-1">No Blogger Accounts Configured</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            Connect your Google Blogger account to allow the autonomous publisher to deploy generated, SEO-optimized articles.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Configure First Blog</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {integrations.map((item) => {
            const isTesting = testingId === item.id;
            const isConnected = item.lastTestStatus === 'CONNECTED';
            const isFailed = item.lastTestStatus === 'FAILED';

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all ${
                  item.enabled
                    ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-950/60 border-slate-850 opacity-70'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Info */}
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-white text-sm">{item.name}</span>
                      
                      {/* Enabled Status Badge */}
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          item.enabled
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {item.enabled ? 'Enabled' : 'Disabled'}
                      </span>

                      {/* Connection Test Badge */}
                      {isConnected && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Connected ({item.lastLatencyMs || 0}ms)</span>
                        </span>
                      )}
                      {isFailed && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Failed ({item.lastLatencyMs || 0}ms)</span>
                        </span>
                      )}
                      {!isConnected && !isFailed && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          Not Tested
                        </span>
                      )}

                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        Mode: {item.defaultStatus || 'DRAFT'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono flex-wrap">
                      <span>Blog ID: <span className="text-slate-200">{item.blogId}</span></span>
                      {item.defaultLabel && (
                        <span className="flex items-center gap-1 text-slate-300">
                          <Tag className="w-3 h-3 text-cyan-400" />
                          <span>{item.defaultLabel}</span>
                        </span>
                      )}
                      {item.blogUrl && (
                        <a
                          href={item.blogUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Visit Blog</span>
                        </a>
                      )}
                    </div>

                    {isFailed && item.lastError && (
                      <p className="text-[11px] text-rose-400 font-mono bg-rose-500/5 p-1.5 rounded-lg border border-rose-500/20 max-w-xl">
                        Diagnostic: {item.lastError}
                      </p>
                    )}

                    {item.lastTestedAt && (
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Last verified: {new Date(item.lastTestedAt).toLocaleString()}</span>
                      </p>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTestInline(item)}
                      disabled={isTesting}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      title="Test live API connection to Google Blogger"
                    >
                      <Activity className={`w-3.5 h-3.5 text-cyan-400 ${isTesting ? 'animate-spin' : ''}`} />
                      <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleEnabled(item.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        item.enabled
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                      }`}
                    >
                      {item.enabled ? 'Disable' : 'Enable'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                      title="Edit Configuration"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, item.name)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg border border-rose-500/30 transition-colors cursor-pointer"
                      title="Delete Integration"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <BloggerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        editingBlogger={editingItem}
      />
    </div>
  );
};
