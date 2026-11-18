import { NextRequest, NextResponse } from 'next/server';
import { generateAtsResumePdf } from '@/lib/pdfGenerator';
import { defaultProfile } from '@/data/defaultProfile';
import { MasterProfile, TailoredResumeData } from '@/types/profile';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const profile: MasterProfile = body.profile || defaultProfile;
    const tailoredData: TailoredResumeData | undefined = body.tailoredData || undefined;

    const pdfBytes = await generateAtsResumePdf(profile, tailoredData);

    const safeFilename = `${profile.personalInfo.fullName.replace(/\s+/g, '_')}_Resume_ATS.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate PDF';
    console.error('PDF generation error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const pdfBytes = await generateAtsResumePdf(defaultProfile);
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Master_ATS_Resume.pdf"',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to render PDF';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
