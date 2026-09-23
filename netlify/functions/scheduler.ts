/**
 * Netlify Scheduled Function: Autonomous Content Scheduler
 * Invoked on cron (e.g. hourly or every 4 hours) configured in netlify.toml.
 * Runs autonomous cycle respecting limits, active days, and quiet hours.
 */

import { Orchestrator } from '../../src/agents/Orchestrator.ts';
import { StorageService } from '../../src/services/storage.ts';

export const handler = async (event: any) => {
  console.log('[Netlify Scheduled Function] Triggering autonomous content cycle...');

  const storage = StorageService.getInstance();
  const settings = storage.getSettings();

  // Validate active day
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayName = days[new Date().getUTCDay()];
  if (settings.activeDays && !settings.activeDays.includes(todayName)) {
    console.log(`[Scheduler] Today (${todayName}) is not configured as an active publishing day. Skipping.`);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Day ${todayName} inactive, skipped.` }),
    };
  }

  // Validate daily article ceiling
  if (settings.todayStats.articlesPublished >= settings.maxArticlesPerDay) {
    console.log(`[Scheduler] Daily publishing limit reached (${settings.todayStats.articlesPublished}/${settings.maxArticlesPerDay}). Skipping.`);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Daily publishing quota fulfilled.' }),
    };
  }

  try {
    const orchestrator = Orchestrator.getInstance();
    const job = await orchestrator.runCycle();
    console.log(`[Scheduler] Cycle completed successfully. Job #${job.jobNumber}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, jobId: job.id, jobNumber: job.jobNumber }),
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Scheduler] Scheduled execution error:', errorMsg);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: errorMsg }),
    };
  }
};
