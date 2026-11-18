import { NextRequest, NextResponse } from 'next/server';
import { tailorResumeWithGemini } from '@/lib/geminiTailor';
import { defaultProfile } from '@/data/defaultProfile';
import { MasterProfile } from '@/types/profile';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const jobDescription = body.jobDescription || '';
    const profile: MasterProfile = body.profile || defaultProfile;

    if (!jobDescription || jobDescription.trim().length < 15) {
      return NextResponse.json(
        { error: 'Please provide a valid Job Description or Job Posting text.' },
        { status: 400 }
      );
    }

    const tailoredData = await tailorResumeWithGemini(jobDescription, profile);
    return NextResponse.json({ success: true, tailoredData });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Tailoring failed';
    console.error('Tailoring route error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
