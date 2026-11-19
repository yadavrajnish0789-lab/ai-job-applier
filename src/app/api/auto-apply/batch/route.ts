import { NextRequest, NextResponse } from 'next/server';
import { processBatchApplications } from '@/lib/batchRunner';
import { defaultProfile } from '@/data/defaultProfile';
import { JobListing } from '@/types/job';
import { MasterProfile } from '@/types/profile';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const jobs: JobListing[] = Array.isArray(body.jobs) ? body.jobs : [];
    const profile: MasterProfile = body.profile || defaultProfile;
    const autoSubmit: boolean = !!body.autoSubmit;
    const enableTailoring: boolean = body.enableTailoring !== false;

    if (jobs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Please select at least 1 job to auto-apply.' },
        { status: 400 }
      );
    }

    // Limit batch to max 10 jobs per call to respect serverless function duration
    const targetJobs = jobs.slice(0, 10);
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const origin = `${protocol}://${host}`;

    const { progress, results } = await processBatchApplications({
      jobs: targetJobs,
      profile,
      autoSubmit,
      enableTailoring,
      origin,
    });

    return NextResponse.json({
      success: true,
      progress,
      results,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Batch execution failed';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
