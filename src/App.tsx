import React, { useState } from 'react';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { TopicsView } from './components/TopicsView';
import { ResearchView } from './components/ResearchView';
import { ArticlesView } from './components/ArticlesView';
import { PublishingView } from './components/PublishingView';
import { AnalyticsMemoryView } from './components/AnalyticsMemoryView';
import { LogsView } from './components/LogsView';
import { SettingsView } from './components/SettingsView';
import { PipelineModal } from './components/PipelineModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ArticleItem, NavigationTab, TopicItem } from './types/agent';
import { PipelineOrchestrator, PipelineProgress } from './agents/Orchestrator';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [pipelineProgress, setPipelineProgress] = useState<PipelineProgress | null>(null);
  const [completedArticle, setCompletedArticle] = useState<ArticleItem | null>(null);
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);

  const handleRunPipeline = async (nicheOrTitle?: string) => {
    if (isRunningPipeline) return;

    setIsRunningPipeline(true);
    setCompletedArticle(null);
    setPipelineProgress({
      currentStage: 'Initializing Autonomous Agent Swarm...',
      percent: 5,
      activeAgent: 'Orchestrator'
    });
    setIsPipelineModalOpen(true);

    try {
      const art = await PipelineOrchestrator.runFullPipeline(
        nicheOrTitle || 'Autonomous AI Publishing & Agent Workflows',
        (progress) => {
          setPipelineProgress(progress);
        }
      );
      setCompletedArticle(art);
    } catch (err: any) {
      console.error('Pipeline execution error:', err);
    } finally {
      setIsRunningPipeline(false);
    }
  };

  const handleSelectTopicForPipeline = (topic: TopicItem) => {
    handleRunPipeline(topic.title);
  };

  const handleViewArticle = (article: ArticleItem) => {
    setActiveTab('articles');
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500/30 selection:text-blue-200">
        {/* Top Header */}
        <Header 
          onRunPipeline={() => handleRunPipeline()}
          isRunningPipeline={isRunningPipeline}
        />

        {/* Navigation Tabs */}
        <Navigation 
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          {activeTab === 'dashboard' && (
            <DashboardView
              onNavigate={setActiveTab}
              onRunPipeline={() => handleRunPipeline()}
              isRunningPipeline={isRunningPipeline}
            />
          )}

          {activeTab === 'topics' && (
            <TopicsView
              onSelectTopicForPipeline={handleSelectTopicForPipeline}
            />
          )}

          {activeTab === 'research' && (
            <ResearchView />
          )}

          {activeTab === 'articles' && (
            <ArticlesView />
          )}

          {activeTab === 'publishing' && (
            <PublishingView 
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsMemoryView />
          )}

          {activeTab === 'logs' && (
            <LogsView />
          )}

          {activeTab === 'settings' && (
            <SettingsView />
          )}
        </main>

        {/* Swarm Pipeline Execution Modal */}
        <PipelineModal
          isOpen={isPipelineModalOpen}
          progress={pipelineProgress}
          completedArticle={completedArticle}
          onClose={() => setIsPipelineModalOpen(false)}
          onViewArticle={handleViewArticle}
        />
      </div>
    </ErrorBoundary>
  );
}
