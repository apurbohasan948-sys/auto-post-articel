import React, { useState } from 'react';
import {
  Compass,
  Search,
  Scale,
  FileCode,
  PenTool,
  Sparkles,
  ShieldAlert,
  Image as ImageIcon,
  Send,
  Share2,
  LineChart,
  BrainCircuit,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Info,
} from 'lucide-react';
import { AgentJob, PipelineStep } from '../types/agent.ts';

interface PipelineVisualizerProps {
  currentJob?: AgentJob | null;
  onSelectStep?: (step: PipelineStep) => void;
}

interface StepMeta {
  step: PipelineStep;
  agentName: string;
  label: string;
  icon: any;
  description: string;
}

const PIPELINE_NODES: StepMeta[] = [
  {
    step: 'TOPIC_DISCOVERY',
    agentName: 'Topic Scout Agent',
    label: '1. Topic Discovery',
    icon: Compass,
    description: 'Scouts vetted candidate topics aligned with niche, audience, and memory gaps.',
  },
  {
    step: 'WEB_RESEARCH',
    agentName: 'Research Agent',
    label: '2. Web Research',
    icon: Search,
    description: 'Tavily web search, source collection, facts extraction, and conflict detection.',
  },
  {
    step: 'TOPIC_DECISION',
    agentName: 'Decision Agent',
    label: '3. Topic Decision',
    icon: Scale,
    description: 'Critical gatekeeper checks evidence sufficiency, originality, and safety policies.',
  },
  {
    step: 'CONTENT_PLANNING',
    agentName: 'Content Planner Agent',
    label: '4. Content Planning',
    icon: FileCode,
    description: 'Constructs H2/H3 outline, meta description, internal links, and FAQ blueprint.',
  },
  {
    step: 'ARTICLE_GENERATION',
    agentName: 'Writer Agent',
    label: '5. Article Writer',
    icon: PenTool,
    description: 'Drafts technical prose in English/Bengali and generates Blogger-compatible HTML.',
  },
  {
    step: 'SEO_OPTIMIZATION',
    agentName: 'SEO Agent',
    label: '6. SEO Specialist',
    icon: Sparkles,
    description: 'Optimizes search metadata, image alt tags, JSON-LD Schema, and keyword density.',
  },
  {
    step: 'FACT_QUALITY_CHECK',
    agentName: 'Quality Fact Checker',
    label: '7. Fact & Quality Check',
    icon: ShieldAlert,
    description: 'Audits claims against sources. Issues PASS, FAIL, or REWRITE with max-attempt loop.',
  },
  {
    step: 'IMAGE_HANDLING',
    agentName: 'Image Handling Agent',
    label: '8. Image Handling',
    icon: ImageIcon,
    description: 'Coordinates copyright-cleared visuals, prompts, and responsive alt text.',
  },
  {
    step: 'BLOGGER_PUBLISH',
    agentName: 'Blogger Publisher',
    label: '9. Blogger Publisher',
    icon: Send,
    description: 'Idempotency verification, labels, OAuth authentication, and post publishing.',
  },
  {
    step: 'SOCIAL_DISTRIBUTION',
    agentName: 'Social Distribution',
    label: '10. Social Distribution',
    icon: Share2,
    description: 'Adapts platform-specific copy for Facebook, Telegram, LinkedIn, X, and Threads.',
  },
  {
    step: 'RESULT_TRACKING',
    agentName: 'Analytics Monitor',
    label: '11. Telemetry Tracking',
    icon: LineChart,
    description: 'Logs delivery statuses, platform IDs, API latency, and publishing health.',
  },
  {
    step: 'MEMORY_LEARNING',
    agentName: 'Memory & Learning Agent',
    label: '12. Agent Memory',
    icon: BrainCircuit,
    description: 'Indexes topic footprint, logs high-performing patterns, and updates gap keywords.',
  },
];

export const PipelineVisualizer: React.FC<PipelineVisualizerProps> = ({ currentJob }) => {
  const [selectedNode, setSelectedNode] = useState<StepMeta>(PIPELINE_NODES[0]);

  const getStepStatus = (stepName: PipelineStep) => {
    if (!currentJob || !Array.isArray(currentJob.steps)) return 'PENDING';
    const found = currentJob.steps.find((s) => s.step === stepName);
    return found ? found.status : 'PENDING';
  };

  const getStepRecord = (stepName: PipelineStep) => {
    if (!currentJob || !Array.isArray(currentJob.steps)) return null;
    return currentJob.steps.find((s) => s.step === stepName) || null;
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Active Job Info */}
      <div className="cyber-panel rounded-xl p-4 sm:p-5 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
              <h2 className="text-base font-bold text-white font-display">
                Autonomous 12-Stage Pipeline Architecture
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Strict deterministic state-machine workflow executing in discrete JSON contracts
            </p>
          </div>

          <div className="flex items-center gap-3">
            {currentJob ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs">
                <span className="text-slate-400 font-mono">JOB #{currentJob.jobNumber}</span>
                <span className="text-slate-700">•</span>
                <span
                  className={`font-semibold ${
                    currentJob.status === 'RUNNING'
                      ? 'text-cyan-400 animate-pulse'
                      : currentJob.status === 'COMPLETED'
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {currentJob.status}
                </span>
              </div>
            ) : (
              <div className="text-xs text-slate-500 font-mono">No active cycle in memory</div>
            )}
          </div>
        </div>

        {/* The 12-Stage Visual Node Track */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {PIPELINE_NODES.map((node, index) => {
            const Icon = node.icon;
            const status = getStepStatus(node.step);
            const record = getStepRecord(node.step);
            const isSelected = selectedNode.step === node.step;

            let badgeColor = 'bg-slate-900/80 text-slate-400 border-slate-800';
            let iconColor = 'text-slate-500';
            let glow = '';

            if (status === 'COMPLETED') {
              badgeColor = 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40';
              iconColor = 'text-emerald-400';
            } else if (status === 'RUNNING') {
              badgeColor = 'bg-cyan-950/60 text-cyan-300 border-cyan-400 animate-pulse';
              iconColor = 'text-cyan-400';
              glow = 'shadow-md shadow-cyan-500/20';
            } else if (status === 'FAILED') {
              badgeColor = 'bg-rose-950/40 text-rose-300 border-rose-500/40';
              iconColor = 'text-rose-400';
            } else if (status === 'SKIPPED') {
              badgeColor = 'bg-slate-900 text-slate-500 border-slate-800';
              iconColor = 'text-slate-600';
            }

            return (
              <button
                key={node.step}
                onClick={() => setSelectedNode(node)}
                className={`text-left p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${badgeColor} ${glow} ${
                  isSelected ? 'ring-2 ring-cyan-400/80 shadow-lg' : 'hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-950 flex items-center justify-center border border-slate-800">
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                  </div>
                  <span className="text-[10px] font-mono font-semibold opacity-70">
                    {index + 1}/12
                  </span>
                </div>

                <div className="font-semibold text-xs text-slate-100 truncate">{node.agentName}</div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">{node.label.split('. ')[1]}</div>

                <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono border-t border-slate-800/60 pt-1.5">
                  <span className="uppercase font-bold tracking-wider">{status}</span>
                  {record?.durationMs ? (
                    <span className="text-slate-400 font-normal">{(record.durationMs / 1000).toFixed(1)}s</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Node Detailed Inspector */}
      <div className="cyber-panel rounded-xl p-4 sm:p-5 border border-slate-800 flex flex-col md:flex-row gap-5 items-start">
        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
          <selectedNode.icon className="w-6 h-6 text-cyan-400" />
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">
                Logical Agent Specification
              </span>
              <h3 className="text-base font-bold text-white font-display">
                {selectedNode.agentName} ({selectedNode.label})
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono">
                Status: {getStepStatus(selectedNode.step)}
              </span>
              {getStepRecord(selectedNode.step)?.durationMs && (
                <span className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {getStepRecord(selectedNode.step)!.durationMs}ms
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">{selectedNode.description}</p>

          {/* Step Execution Telemetry if available */}
          {getStepRecord(selectedNode.step)?.summary && (
            <div className="mt-3 p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs">
              <span className="text-slate-500 font-mono uppercase text-[10px] block mb-1">
                Last Output Telemetry:
              </span>
              <p className="text-emerald-300 font-mono leading-relaxed">
                {getStepRecord(selectedNode.step)!.summary}
              </p>
            </div>
          )}

          {getStepRecord(selectedNode.step)?.error && (
            <div className="mt-3 p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-xs">
              <span className="text-rose-400 font-mono uppercase text-[10px] block mb-1">
                Execution Error:
              </span>
              <p className="text-rose-200 font-mono">{getStepRecord(selectedNode.step)!.error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
