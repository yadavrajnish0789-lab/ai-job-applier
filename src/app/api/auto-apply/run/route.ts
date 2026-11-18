import { NextRequest, NextResponse } from 'next/server';
import { executeAutoApplyPipeline } from '@/lib/browserAutomation';
import { defaultProfile } from '@/data/defaultProfile';
import { MasterProfile } from '@/types/profile';

// Ensure Vercel serverless function has sufficient time for cloud browser navigation
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const jobUrl: string = body.jobUrl || '';
    const autoSubmit: boolean = !!body.autoSubmit;
    const enableTailoring: boolean = body.enableTailoring !== false;
    const profile: MasterProfile = body.profile || defaultProfile;

    if (!jobUrl || !jobUrl.startsWith('http')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please enter a valid HTTP/HTTPS job posting URL.',
          logs: [
            {
              timestamp: new Date().toLocaleTimeString(),
              stage: 'ERROR',
              message: 'Invalid Job URL provided. Please include http:// or https://',
            },
          ],
        },
        { status: 400 }
      );
    }

    const result = await executeAutoApplyPipeline({
      jobUrl,
      profile,
      autoSubmit,
      enableTailoring,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown server error in auto-apply runner';
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        logs: [
          {
            timestamp: new Date().toLocaleTimeString(),
            stage: 'ERROR',
            message: errorMsg,
          },
        ],
      },
      { status: 500 }
    );
  }
}
