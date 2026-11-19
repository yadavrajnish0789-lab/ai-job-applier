import nodemailer from 'nodemailer';
import { MasterProfile } from '@/types/profile';
import { JobListing } from '@/types/job';
import { generateAtsResumePdf } from '@/lib/pdfGenerator';
import { tailorResumeWithGemini } from '@/lib/geminiTailor';
import { GoogleGenAI } from '@google/genai';

export interface ColdEmailDraft {
  recipient: string;
  subject: string;
  body: string;
  gmailComposeUrl: string;
  pdfBase64?: string;
  pdfFileName: string;
}

/**
 * Generate a professional, high-converting cold application email pitch tailored to the foreign recruiter
 */
export async function generateColdEmailPitch(
  job: JobListing,
  profile: MasterProfile
): Promise<{ subject: string; body: string }> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
You are an expert executive tech recruiter and cold email specialist.
Write a concise, persuasive, high-impact cold application email from candidate Rajnish Yadav applying for the role of "${job.title}" at "${job.company}".

Candidate Details:
- Name: ${profile.personalInfo.fullName}
- Title: ${profile.personalInfo.currentTitle}
- Email: ${profile.personalInfo.email}
- Phone: ${profile.personalInfo.phone}
- Experience: 2+ Years as Full-Stack Engineer & Technical SEO Specialist
- Key Tech Stack: React, Next.js, TypeScript, PHP, Laravel, MySQL, REST APIs, Tailwind CSS, Core Web Vitals
- Major Projects: OwnLMS (Full-stack Learning Platform), PublicDomainMovie.org (Optimized movie platform with 95+ Core Web Vitals), Custom SEO audits.
- International Remote Readiness: Fully equipped for US/EU/UK remote roles with flexible timezone overlap and excellent written communication.

Job Details:
- Role: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Description/Requirements: ${job.description.slice(0, 1000)}

Requirements for the Email:
1. Subject line must be clean and high open-rate (e.g., "Application: ${job.title} - Rajnish Yadav (Full-Stack & Next.js)")
2. Opening: Direct and compelling, mentioning why Rajnish's stack directly solves their engineering needs.
3. 3 bullet points highlighting quantifiable achievements relevant to their JD (Next.js performance, database scaling, SEO/traffic).
4. Timezone & Remote Availability: Affirm ability to work in their required hours/timezone seamlessly.
5. Call to Action: Polite invitation for a brief 15-minute conversation. Mention that a tailored ATS PDF resume is attached.
6. Format output strictly as JSON with keys: "subject" and "body".
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '';
      const parsed = JSON.parse(text);
      if (parsed.subject && parsed.body) {
        return {
          subject: parsed.subject,
          body: parsed.body,
        };
      }
    } catch (err) {
      console.warn('Gemini cold email generation fallback:', err);
    }
  }

  // Fallback high-conversion professional template
  const subject = `Application for ${job.title} - ${profile.personalInfo.fullName} (Full-Stack Engineer & SEO Specialist)`;
  const body = `Dear Hiring Team at ${job.company},

I am writing to express my strong interest in the ${job.title} position. With over 2 years of hands-on software engineering experience specializing in React, Next.js, TypeScript, and robust PHP/Laravel backends, I build performant, scalable digital platforms that deliver measurable business impact.

A few quick highlights of what I bring to ${job.company}:
• Production Full-Stack Architecture: Built high-throughput platforms like OwnLMS using Next.js, React, and modular RESTful backends with optimized MySQL query pipelines.
• Performance & Core Web Vitals: Engineered high-traffic portals (including PublicDomainMovie.org), consistently achieving 95+ PageSpeed scores and optimizing frontend asset delivery.
• Remote & Global Collaboration: Fully equipped for high-ownership remote collaboration with flexible timezone overlap (US/EU/APAC) and disciplined agile delivery.

I have attached my tailored ATS resume for your review. Would you be open to a brief 15-minute introductory call this week to discuss how my skill set aligns with your engineering goals?

Best regards,

${profile.personalInfo.fullName}
Full-Stack Software Engineer & Technical SEO Specialist
Email: ${profile.personalInfo.email} | Phone: ${profile.personalInfo.phone}
Portfolio: https://publicdomainmovie.org | GitHub: ${profile.personalInfo.github}
LinkedIn: ${profile.personalInfo.linkedIn}`;

  return { subject, body };
}

/**
 * Build 1-click Gmail Web Compose URL
 */
export function buildGmailComposeUrl(to: string, subject: string, body: string): string {
  const base = 'https://mail.google.com/mail/?view=cm&fs=1';
  return `${base}&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Prepare full application email package with in-memory tailored ATS PDF
 */
export async function prepareEmailApplication(
  job: JobListing,
  profile: MasterProfile
): Promise<ColdEmailDraft> {
  const recipient = job.applyEmail || `careers@${job.company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
  const { subject, body } = await generateColdEmailPitch(job, profile);

  // Generate tailored ATS resume in-memory
  let tailoredData = undefined;
  try {
    tailoredData = await tailorResumeWithGemini(job.description, profile);
  } catch (e) {
    console.warn('Tailoring fallback for email:', e);
  }

  const pdfBytes = await generateAtsResumePdf(profile, tailoredData);
  const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
  const safeCompany = job.company.replace(/[^a-zA-Z0-9]/g, '_');
  const pdfFileName = `Rajnish_Yadav_Resume_${safeCompany}.pdf`;

  const gmailComposeUrl = buildGmailComposeUrl(recipient, subject, body);

  return {
    recipient,
    subject,
    body,
    gmailComposeUrl,
    pdfBase64,
    pdfFileName,
  };
}

/**
 * Send email via SMTP (if configured with Gmail App Password or custom SMTP)
 */
export async function sendEmailViaSmtp(draft: ColdEmailDraft, profile: MasterProfile): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const user = process.env.GMAIL_USER || profile.personalInfo.email;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!pass) {
    return {
      success: false,
      error: 'GMAIL_APP_PASSWORD environment variable not set. Use 1-Click Gmail Web Compose link instead.',
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });

    const attachments = draft.pdfBase64
      ? [
          {
            filename: draft.pdfFileName,
            content: Buffer.from(draft.pdfBase64, 'base64'),
            contentType: 'application/pdf',
          },
        ]
      : [];

    const info = await transporter.sendMail({
      from: `"${profile.personalInfo.fullName}" <${user}>`,
      to: draft.recipient,
      subject: draft.subject,
      text: draft.body,
      attachments,
    });

    return { success: true, messageId: info.messageId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'SMTP send failed';
    return { success: false, error: message };
  }
}
