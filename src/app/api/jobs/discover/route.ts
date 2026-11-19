import { NextRequest, NextResponse } from 'next/server';
import { discoverJobs } from '@/lib/jobScraper';
import { defaultProfile } from '@/data/defaultProfile';
import { JobCategory } from '@/types/job';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = (searchParams.get('category') || 'all') as JobCategory;
    const query = searchParams.get('query') || '';

    const jobs = await discoverJobs({ category, query, profile: defaultProfile });

    return NextResponse.json({
      success: true,
      count: jobs.length,
      category,
      query,
      jobs,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to discover jobs';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const category = (body.category || 'all') as JobCategory;
    const query = body.query || '';
    const profile = body.profile || defaultProfile;

    const jobs = await discoverJobs({ category, query, profile });

    return NextResponse.json({
      success: true,
      count: jobs.length,
      category,
      query,
      jobs,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to discover jobs';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
