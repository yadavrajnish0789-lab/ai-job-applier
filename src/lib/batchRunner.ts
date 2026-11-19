import { JobListing, JobQueueItem, BatchRunProgress } from '@/types/job';
import { MasterProfile } from '@/types/profile';
import { executeAutoApplyPipeline } from '@/lib/browserAutomation';

export async function processBatchApplications(params: {
  jobs: JobListing[];
  profile: MasterProfile;
  autoSubmit: boolean;
  enableTailoring: boolean;
  origin?: string;
  onProgress?: (progress: BatchRunProgress) => void;
}): Promise<{
  progress: BatchRunProgress;
  results: JobQueueItem[];
}> {
  const { jobs, profile, autoSubmit, enableTailoring, origin = 'http://localhost:3000' } = params;

  const results: JobQueueItem[] = [];
  const progress: BatchRunProgress = {
    total: jobs.length,
    completed: 0,
    successful: 0,
    failed: 0,
  };

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    progress.currentJobTitle = job.title;
    progress.currentCompany = job.company;
    progress.stage = `Processing ${i + 1}/${jobs.length}: ${job.company}`;

    // Resolve URL
    let targetUrl = job.applyUrl || job.url;
    if (targetUrl.startsWith('/')) {
      targetUrl = `${origin}${targetUrl}`;
    }

    try {
      const runOutcome = await executeAutoApplyPipeline({
        jobUrl: targetUrl,
        profile,
        autoSubmit,
        enableTailoring,
      });

      if (runOutcome.success) {
        progress.successful++;
        results.push({
          job,
          status: runOutcome.autoSubmitted ? 'submitted' : 'review_ready',
          tailoredHeadline: runOutcome.tailoredData?.tailoredHeadline,
          tailoredSummary: runOutcome.tailoredData?.tailoredSummary,
          matchedKeywords: runOutcome.tailoredData?.matchedKeywords,
          matchScore: runOutcome.tailoredData?.matchScore || job.matchScore,
          screenshotBase64: runOutcome.screenshotBase64,
          pdfBase64: runOutcome.pdfBase64,
          fieldsFilledCount: runOutcome.filledFields?.length || 0,
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        progress.failed++;
        results.push({
          job,
          status: 'failed',
          error: runOutcome.error || 'Failed to complete automation',
          matchScore: job.matchScore,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    } catch (err: unknown) {
      progress.failed++;
      const msg = err instanceof Error ? err.message : 'Unknown execution error';
      results.push({
        job,
        status: 'failed',
        error: msg,
        matchScore: job.matchScore,
        timestamp: new Date().toLocaleTimeString(),
      });
    }

    progress.completed++;
  }

  return { progress, results };
}
