import { NextRequest, NextResponse } from 'next/server';
import { defaultProfile } from '@/data/defaultProfile';
import { MasterProfile } from '@/types/profile';
import { JobListing } from '@/types/job';
import { prepareEmailApplication, sendEmailViaSmtp } from '@/lib/emailSender';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const job: JobListing = body.job;
    const profile: MasterProfile = body.profile || defaultProfile;
    const autoSend: boolean = !!body.autoSend;

    if (!job || !job.title || !job.company) {
      return NextResponse.json(
        { error: 'Missing valid job information' },
        { status: 400 }
      );
    }

    // Prepare cold pitch + tailored ATS PDF
    const draft = await prepareEmailApplication(job, profile);

    // If autoSend is true and credentials exist, attempt SMTP
    if (autoSend && process.env.GMAIL_APP_PASSWORD) {
      const smtpRes = await sendEmailViaSmtp(draft, profile);
      if (smtpRes.success) {
        return NextResponse.json({
          success: true,
          mode: 'smtp_sent',
          messageId: smtpRes.messageId,
          draft,
        });
      }
    }

    // Default: return prepared draft + 1-click Gmail Compose link + PDF
    return NextResponse.json({
      success: true,
      mode: 'draft_ready',
      draft,
      note: 'Draft prepared with tailored ATS PDF. Click Gmail link to send directly from your personal email.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Email preparation failed';
    console.error('Email apply route error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
