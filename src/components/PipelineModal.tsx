import React from 'react';
import { Sparkles, CheckCircle2, Radio, X, ArrowRight, ExternalLink } from 'lucide-react';
import { PipelineProgress } from '../agents/Orchestrator';
import { ArticleItem } from '../types/agent';

interface PipelineModalProps {
  isOpen: boolean;
  progress: PipelineProgress | null;
  completedArticle: ArticleItem | null;
  onClose: () => void;
  onViewArticle: (article: ArticleItem) => void;
}

export const PipelineModal: React.FC<PipelineModalProps> = ({
  isOpen,
  progress,
  completedArticle,
  onClose,
  onViewArticle
}) => {
  if (!isOpen) return null;

  const isRunning = !completedArticle;

  const STAGES = [
    { title: 'Discovering High-Impact Topics', agent: 'TopicScoutAgent' },
    { title: 'Gathering Verified Research Citations', agent: 'ResearchAgent' },
    { title: 'Drafting Comprehensive Article', agent: 'WriterAgent' },
    { title: 'Auditing Factual Claims & SEO', agent: 'QualityFactCheckerAgent' },
    { title: 'Publishing to Enabled Blogger Accounts', agent: 'BloggerPublisherAgent' },
    { title: 'Distributing Across Social Channels', agent: 'SocialDistributionAgent' },
  ];

  return (
    <div id="pipeline-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
      <div id="pipeline-modal" className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Autonomous Swarm Execution</h3>
              <p className="text-xs text-slate-400">Multi-agent content &amp; syndication workflow</p>
            </div>
          </div>
          {!isRunning && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-slate-300">{progress?.currentStage || 'Initializing...'}</span>
            <span className="text-blue-400">{progress?.percent || 0}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${progress?.percent || 0}%` }}
            />
          </div>
        </div>

        {/* Stages Checklist */}
        <div className="space-y-2 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
          {STAGES.map((s, idx) => {
            const currentIdx = STAGES.findIndex(item => item.title === progress?.currentStage);
            const isCompleted = completedArticle || (currentIdx > idx);
            const isCurrent = progress?.currentStage === s.title;

            return (
              <div
                key={s.title}
                className="flex items-center justify-between text-xs py-1"
              >
                <div className="flex items-center gap-2.5">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : isCurrent ? (
                    <Radio className="w-4 h-4 text-blue-400 animate-pulse shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                  )}
                  <span className={isCompleted ? 'text-slate-200' : isCurrent ? 'text-blue-400 font-semibold' : 'text-slate-500'}>
                    {s.title}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">{s.agent}</span>
              </div>
            );
          })}
        </div>

        {/* Completion Info */}
        {completedArticle && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Article Generated &amp; Distributed</span>
            </div>
            <p className="text-xs text-white font-medium line-clamp-1">
              "{completedArticle.title}"
            </p>
            <div className="text-[11px] text-slate-400">
              {completedArticle.wordCount} words | SEO: {completedArticle.seoScore}% | Fact Audit: {completedArticle.factCheckScore}%
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 flex justify-end gap-2">
          {completedArticle ? (
            <button
              onClick={() => {
                onViewArticle(completedArticle);
                onClose();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>View in Article Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <p className="text-xs text-slate-400 animate-pulse">Running autonomous pipeline...</p>
          )}
        </div>
      </div>
    </div>
  );
};
