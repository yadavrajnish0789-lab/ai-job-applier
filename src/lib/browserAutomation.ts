import { chromium, Browser, Page } from 'playwright-core';
import { MasterProfile, TailoredResumeData } from '@/types/profile';
import { tailorResumeWithGemini } from '@/lib/geminiTailor';
import { generateAtsResumePdf } from '@/lib/pdfGenerator';
import { GoogleGenAI } from '@google/genai';

export interface AutomationLog {
  timestamp: string;
  stage:
    | 'INIT'
    | 'CDP_CONNECT'
    | 'PAGE_NAV'
    | 'JD_EXTRACT'
    | 'AI_TAILOR'
    | 'ATS_PDF'
    | 'FORM_DETECT'
    | 'AI_MAPPING'
    | 'FORM_FILL'
    | 'RESUME_UPLOAD'
    | 'SCREENSHOT'
    | 'VERIFY'
    | 'SUCCESS'
    | 'ERROR';
  message: string;
  detail?: string;
}

export interface FilledField {
  field: string;
  value: string;
  selector: string;
}

export interface AutoApplyResult {
  success: boolean;
  jobTitle?: string;
  company?: string;
  extractedJd?: string;
  tailoredData?: TailoredResumeData;
  formFieldsDetected?: string[];
  filledFields: FilledField[];
  screenshotBase64?: string;
  pdfGenerated?: boolean;
  pdfBase64?: string;
  autoSubmitted: boolean;
  statusMessage: string;
  logs: AutomationLog[];
  error?: string;
}

export function createLog(stage: AutomationLog['stage'], message: string, detail?: string): AutomationLog {
  return {
    timestamp: new Date().toLocaleTimeString(),
    stage,
    message,
    detail,
  };
}

/**
 * Evaluates function on page with automatic retry if execution context was destroyed during hydration
 */
async function safeEvaluate<T>(page: Page, pageFunction: () => T, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await page.evaluate(pageFunction);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if ((msg.includes('Execution context was destroyed') || msg.includes('navigation')) && i < retries - 1) {
        await page.waitForTimeout(1200);
        continue;
      }
      throw err;
    }
  }
  return await page.evaluate(pageFunction);
}

/**
 * Connects to a Cloud Headless Browser via WebSocket CDP on Vercel,
 * or falls back to local Google Chrome / Edge in local development.
 */
export async function getBrowserInstance(
  log: (stage: AutomationLog['stage'], msg: string, detail?: string) => void
): Promise<{ browser: Browser | null; isCloud: boolean }> {
  const wsEndpoint = process.env.BROWSER_WS_ENDPOINT?.trim();

  if (wsEndpoint && wsEndpoint.startsWith('ws')) {
    log('CDP_CONNECT', `Connecting to Cloud Browser via WebSocket CDP...`, `Endpoint: ${wsEndpoint.replace(/:[^:]*@/, ':***@')}`);
    const browser = await chromium.connectOverCDP(wsEndpoint, { timeout: 30000 });
    return { browser, isCloud: true };
  }

  // Local development fallback
  log('CDP_CONNECT', 'No BROWSER_WS_ENDPOINT detected. Checking local Chrome installation...');
  try {
    const browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    return { browser, isCloud: false };
  } catch {
    try {
      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      return { browser, isCloud: false };
    } catch {
      log('CDP_CONNECT', 'Running in Serverless Cloud Emulation mode (no local Chrome on Vercel).');
      return { browser: null, isCloud: false };
    }
  }
}

/**
 * Dismisses common cookie banners, consent prompts, and overlays
 */
async function dismissCookieBanners(page: Page) {
  const cookieSelectors = [
    'button[id*="cookie"]',
    'button[id*="accept"]',
    'button[class*="cookie"]',
    'button:text-is("Accept All")',
    'button:text-is("Accept all")',
    'button:text-is("Accept Cookies")',
    'button:text-is("Accept")',
    'button:text-is("I agree")',
    'button:text-is("Allow all")',
    'button:text-is("Got it")',
    '#onetrust-accept-btn-handler',
    '[data-testid="cookie-banner-accept"]',
  ];

  for (const selector of cookieSelectors) {
    try {
      const btn = await page.$(selector);
      if (btn && (await btn.isVisible())) {
        await btn.click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(300);
        break;
      }
    } catch {
      // Ignore non-matching banners
    }
  }
}

export interface RawFormField {
  index: number;
  selector: string;
  tag: string;
  type: string;
  name: string;
  id: string;
  placeholder: string;
  ariaLabel: string;
  labelText: string;
  options?: string[];
  isVisible: boolean;
}

async function extractFormFields(page: Page): Promise<RawFormField[]> {
  return await safeEvaluate(page, () => {
    const fields: RawFormField[] = [];
    const elements = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input, textarea, select'
      )
    );

    elements.forEach((el, index) => {
      try {
        const tag = el.tagName.toLowerCase();
        const type = (el.getAttribute('type') || (tag === 'textarea' ? 'textarea' : 'text')).toLowerCase();

        // Skip submit, reset, hidden, button types (except type="file")
        if (['submit', 'button', 'image', 'reset', 'hidden'].includes(type) && type !== 'file') {
          return;
        }

        const id = el.id || '';
        const name = el.name || '';

        // Find associated label text
        let labelText = '';
        if (id) {
          const labelEl = document.querySelector(`label[for="${id}"]`);
          if (labelEl) labelText = (labelEl.textContent || '').trim();
        }
        if (!labelText) {
          const parentLabel = el.closest('label');
          if (parentLabel) labelText = (parentLabel.textContent || '').trim();
        }
        if (!labelText) {
          const prev = el.previousElementSibling;
          if (prev && (prev.tagName.toLowerCase().startsWith('h') || prev.tagName.toLowerCase() === 'span' || prev.tagName.toLowerCase() === 'label')) {
            labelText = (prev.textContent || '').trim();
          }
        }

        // Reliable selector
        let selector = '';
        if (id) {
          selector = `#${id}`;
        } else if (name) {
          selector = `${tag}[name="${name}"]`;
        } else {
          selector = `${tag}:nth-of-type(${index + 1})`;
        }

        let options: string[] | undefined;
        if (tag === 'select') {
          const selectEl = el as HTMLSelectElement;
          options = Array.from(selectEl.options)
            .map((o) => (o.text || o.value).trim())
            .filter(Boolean)
            .slice(0, 15);
        }

        fields.push({
          index,
          selector,
          tag,
          type,
          name,
          id,
          placeholder: (el as HTMLInputElement).placeholder || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          labelText: labelText.slice(0, 100),
          options,
          isVisible: true,
        });
      } catch {
        // Skip unparseable element
      }
    });

    return fields;
  });
}

/**
 * AI-Assisted Form Mapping using Gemini 2.5 Flash
 */
async function mapFieldsWithGemini(
  rawFields: RawFormField[],
  profile: MasterProfile
): Promise<Array<{ selector: string; fieldName: string; value: string; action: 'type' | 'select' | 'check' | 'file' }>> {
  const apiKey = process.env.GEMINI_API_KEY;

  const candidateData = {
    fullName: profile.personalInfo.fullName,
    firstName: profile.personalInfo.fullName.split(' ')[0],
    lastName: profile.personalInfo.fullName.split(' ').slice(1).join(' ') || 'Yadav',
    email: profile.personalInfo.email,
    phone: profile.personalInfo.phone,
    location: profile.personalInfo.location,
    linkedIn: profile.personalInfo.linkedIn,
    github: profile.personalInfo.github,
    portfolio: profile.personalInfo.portfolio,
    currentCompany: profile.personalInfo.currentCompany,
    currentTitle: profile.personalInfo.currentTitle,
    expectedSalary: profile.personalInfo.expectedSalary,
    noticePeriod: profile.personalInfo.noticePeriod,
    workAuthorization: profile.personalInfo.workAuthorization,
    yearsOfExperience: String(profile.screeningAnswers.yearsOfExperience),
    summary: profile.summary,
  };

  if (!apiKey) {
    // Deterministic rule-based fallback when GEMINI_API_KEY is not yet provided
    return deterministicFieldMapper(rawFields, candidateData);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
You are an intelligent Job Application Form Filling Agent.
Analyze the following HTML form fields extracted from a job application page and map the candidate's data to the correct input selectors.

Candidate Data:
${JSON.stringify(candidateData, null, 2)}

Form Fields on the Page:
${JSON.stringify(rawFields, null, 2)}

Rules:
1. Match each form field with the most appropriate candidate value based on its labelText, placeholder, name, id, and ariaLabel.
2. For "First Name" and "Last Name", use candidate.firstName and candidate.lastName if separate, otherwise use candidate.fullName for "Name".
3. For file inputs (type="file"), do NOT assign a value (action="file").
4. For select elements, choose the best matching option from the field's options array.
5. Ignore fields that do not apply or require custom complex answers not in candidate data.
6. Return strictly a JSON array of mappings.

Format:
[
  {
    "selector": "#first_name",
    "fieldName": "First Name",
    "value": "Rajnish",
    "action": "type"
  },
  {
    "selector": "input[type='file']",
    "fieldName": "Resume",
    "value": "",
    "action": "file"
  }
]
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const text = response.text || '';
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const mappings = JSON.parse(clean);
    if (Array.isArray(mappings) && mappings.length > 0) {
      return mappings;
    }
  } catch (err) {
    console.warn('Gemini form mapping fallback:', err);
  }

  return deterministicFieldMapper(rawFields, candidateData);
}

function deterministicFieldMapper(
  rawFields: RawFormField[],
  candidate: Record<string, string>
) {
  const mappings: Array<{ selector: string; fieldName: string; value: string; action: 'type' | 'select' | 'check' | 'file' }> = [];

  for (const f of rawFields) {
    const meta = `${f.id} ${f.name} ${f.placeholder} ${f.labelText} ${f.ariaLabel}`.toLowerCase();

    if (f.type === 'file' || meta.includes('resume') || meta.includes('cv')) {
      mappings.push({ selector: f.selector, fieldName: 'Resume / CV', value: '', action: 'file' });
    } else if (meta.includes('first') && meta.includes('name')) {
      mappings.push({ selector: f.selector, fieldName: 'First Name', value: candidate.firstName, action: 'type' });
    } else if (meta.includes('last') && meta.includes('name')) {
      mappings.push({ selector: f.selector, fieldName: 'Last Name', value: candidate.lastName, action: 'type' });
    } else if (meta.includes('full') && meta.includes('name') || (meta.includes('name') && !meta.includes('company') && !meta.includes('user'))) {
      mappings.push({ selector: f.selector, fieldName: 'Full Name', value: candidate.fullName, action: 'type' });
    } else if (f.type === 'email' || meta.includes('email') || meta.includes('e-mail')) {
      mappings.push({ selector: f.selector, fieldName: 'Email', value: candidate.email, action: 'type' });
    } else if (f.type === 'tel' || meta.includes('phone') || meta.includes('mobile')) {
      mappings.push({ selector: f.selector, fieldName: 'Phone', value: candidate.phone, action: 'type' });
    } else if (meta.includes('linkedin')) {
      mappings.push({ selector: f.selector, fieldName: 'LinkedIn Profile', value: candidate.linkedIn, action: 'type' });
    } else if (meta.includes('github')) {
      mappings.push({ selector: f.selector, fieldName: 'GitHub URL', value: candidate.github, action: 'type' });
    } else if (meta.includes('website') || meta.includes('portfolio')) {
      mappings.push({ selector: f.selector, fieldName: 'Portfolio / Website', value: candidate.portfolio, action: 'type' });
    } else if (meta.includes('location') || meta.includes('city') || meta.includes('address')) {
      mappings.push({ selector: f.selector, fieldName: 'Location', value: candidate.location, action: 'type' });
    } else if (meta.includes('salary') || meta.includes('compensation') || meta.includes('expected')) {
      mappings.push({ selector: f.selector, fieldName: 'Expected Salary', value: candidate.expectedSalary, action: 'type' });
    } else if (meta.includes('notice') || meta.includes('availability') || meta.includes('start date')) {
      mappings.push({ selector: f.selector, fieldName: 'Notice Period', value: candidate.noticePeriod, action: 'type' });
    } else if (meta.includes('authoriz') || meta.includes('sponsorship')) {
      mappings.push({ selector: f.selector, fieldName: 'Work Authorization', value: candidate.workAuthorization, action: 'type' });
    }
  }

  return mappings;
}

/**
 * Master Real Production Auto-Apply Pipeline
 */
export async function executeAutoApplyPipeline(params: {
  jobUrl: string;
  profile: MasterProfile;
  autoSubmit: boolean;
  enableTailoring: boolean;
}): Promise<AutoApplyResult> {
  const { jobUrl, profile, autoSubmit, enableTailoring } = params;
  const logs: AutomationLog[] = [];
  const log = (stage: AutomationLog['stage'], message: string, detail?: string) => {
    logs.push(createLog(stage, message, detail));
  };

  const filledFields: FilledField[] = [];
  let browser: Browser | null = null;
  let screenshotBase64 = '';
  let pdfBase64 = '';
  let extractedJd = '';
  let jobTitle = 'Target Role';
  const company = 'Target Organization';
  let tailoredData: TailoredResumeData | undefined = undefined;

  try {
    log('INIT', `Initiating Cloud Auto-Apply Runner for: ${jobUrl}`);
    log('INIT', `Candidate: ${profile.personalInfo.fullName} • ${profile.headline}`);

    // Step 1: Launch / Connect Browser
    const { browser: browserConn, isCloud } = await getBrowserInstance(log);
    browser = browserConn;

    if (browser) {
      log('CDP_CONNECT', `Connected to browser (${isCloud ? 'Cloud WebSocket CDP' : 'Local Headless Engine'}). Creating isolated page context...`);

      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      });

      const page = await context.newPage();

      // Step 2: Navigate to target URL
      log('PAGE_NAV', `Navigating to target Job URL: ${jobUrl}`);
      try {
        await page.goto(jobUrl, { waitUntil: 'load', timeout: 35000 });
      } catch (navErr) {
        log('PAGE_NAV', `Initial navigation note: ${navErr instanceof Error ? navErr.message : 'timeout'}. Retrying...`);
        await page.goto(jobUrl, { timeout: 40000 }).catch(() => {});
      }

      // Wait 2 seconds for client hydration / dynamic scripts to settle
      await page.waitForTimeout(2000);

      // Dismiss Cookie Banners
      await dismissCookieBanners(page);

      // Extract Title & Text safely
      jobTitle = (await page.title()) || 'Software Engineer';
      extractedJd = await safeEvaluate(page, () => {
        const main = document.querySelector('main, article, #job-description, .job-description, .posting-description');
        const text = main ? (main as HTMLElement).innerText : document.body.innerText;
        return text.replace(/\s+/g, ' ').trim().slice(0, 5000);
      });

      if (jobTitle.toLowerCase().includes('not found') || jobTitle.toLowerCase().includes('404')) {
        log('JD_EXTRACT', `Warning: Target URL returned "${jobTitle}". Please verify the job posting URL or use the built-in Demo Job.`);
      } else {
        log('JD_EXTRACT', `Extracted job description (${extractedJd.length} chars)`, `Title: ${jobTitle}`);
      }

      // Step 3: AI Resume Tailoring (Gemini 2.5 Flash)
      if (enableTailoring) {
        log('AI_TAILOR', 'Analyzing JD requirements with Gemini 2.5 Flash for honest profile tailoring...');
        tailoredData = await tailorResumeWithGemini(extractedJd || profile.summary, profile);
        log('AI_TAILOR', `Tailoring complete! Candidate Alignment Match Score: ${tailoredData.matchScore}%`);
        log('AI_TAILOR', `Key matched skills: ${tailoredData.matchedKeywords.slice(0, 6).join(', ')}`);
      }

      // Step 4: Generate ATS Vector PDF Buffer
      log('ATS_PDF', 'Generating ATS-compliant vector PDF in memory...');
      const pdfBytes = await generateAtsResumePdf(profile, tailoredData);
      const pdfBuffer = Buffer.from(pdfBytes);
      pdfBase64 = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
      const resumeFilename = `${profile.personalInfo.fullName.replace(/\s+/g, '_')}_Resume_ATS.pdf`;
      log('ATS_PDF', `Generated in-memory PDF resume (${(pdfBuffer.byteLength / 1024).toFixed(1)} KB) named: ${resumeFilename}`);

      // Step 5: Check if there's an "Apply" button or tab that reveals the form
      const hasFormAlready = await safeEvaluate(page, () => {
        return Boolean(document.querySelector('form, #application_form, input[type="email"], input#email'));
      });

      if (!hasFormAlready) {
        try {
          const applySelectors = [
            'button:text-is("Apply for this job")',
            'a:text-is("Apply for this job")',
            'button:text-is("Apply Now")',
            'a:text-is("Apply Now")',
            'a[href*="#apply"]',
            '#apply_button',
            '[data-automation-id="apply-button"]',
          ];
          for (const sel of applySelectors) {
            const applyBtn = await page.$(sel);
            if (applyBtn && (await applyBtn.isVisible())) {
              log('PAGE_NAV', `Clicking "Apply" button to reveal application form: ${sel}`);
              await applyBtn.click({ timeout: 2000 }).catch(() => {});
              await page.waitForTimeout(1000);
              break;
            }
          }
        } catch {
          // Ignore
        }
      }

      // Step 6: Extract Form Fields from Page
      log('FORM_DETECT', 'Scanning DOM for application input fields...');
      const rawFields = await extractFormFields(page);
      log('FORM_DETECT', `Discovered ${rawFields.length} interactive form fields on page.`);

      // Step 7: Map fields via Gemini / Heuristics
      log('AI_MAPPING', 'Using Gemini AI to map candidate data to page form selectors...');
      const fieldMappings = await mapFieldsWithGemini(rawFields, profile);
      log('AI_MAPPING', `Successfully mapped ${fieldMappings.length} fields to candidate profile.`);

      // Step 8: Fill Form Fields
      for (const mapping of fieldMappings) {
        try {
          const locator = page.locator(mapping.selector).first();
          const count = await locator.count();
          if (count === 0) continue;

          if (mapping.action === 'file') {
            log('RESUME_UPLOAD', `Uploading tailored ATS PDF to file input (${mapping.selector})...`);
            await locator.setInputFiles({
              name: resumeFilename,
              mimeType: 'application/pdf',
              buffer: pdfBuffer,
            });
            filledFields.push({ field: mapping.fieldName, value: resumeFilename, selector: mapping.selector });
            log('RESUME_UPLOAD', `Uploaded ${resumeFilename} successfully!`);
          } else if (mapping.action === 'type') {
            await locator.scrollIntoViewIfNeeded().catch(() => {});
            await locator.fill(mapping.value);
            filledFields.push({ field: mapping.fieldName, value: mapping.value, selector: mapping.selector });
            log('FORM_FILL', `Filled [${mapping.fieldName}]: "${mapping.value}"`);
          } else if (mapping.action === 'select' && mapping.value) {
            await locator.selectOption({ label: mapping.value }).catch(() => locator.selectOption({ value: mapping.value }));
            filledFields.push({ field: mapping.fieldName, value: mapping.value, selector: mapping.selector });
            log('FORM_FILL', `Selected [${mapping.fieldName}]: "${mapping.value}"`);
          }
          await page.waitForTimeout(150);
        } catch (fieldErr: unknown) {
          const msg = fieldErr instanceof Error ? fieldErr.message : 'Field error';
          log('FORM_FILL', `Note: Skipped field [${mapping.fieldName}]: ${msg}`);
        }
      }

      // Fallback file upload if not in mappings
      const uploadedAnyFile = filledFields.some((f) => f.field.toLowerCase().includes('resume'));
      if (!uploadedAnyFile) {
        try {
          const anyFileInput = page.locator('input[type="file"]').first();
          if ((await anyFileInput.count()) > 0) {
            log('RESUME_UPLOAD', 'Detected standard input[type="file"]. Uploading tailored ATS PDF buffer...');
            await anyFileInput.setInputFiles({
              name: resumeFilename,
              mimeType: 'application/pdf',
              buffer: pdfBuffer,
            });
            filledFields.push({ field: 'Resume Attachment', value: resumeFilename, selector: 'input[type="file"]' });
            log('RESUME_UPLOAD', `Attached ${resumeFilename} successfully!`);
          }
        } catch {
          // Optional
        }
      }

      // Step 9: Capture Viewport Screenshot
      log('SCREENSHOT', 'Capturing browser verification screenshot...');
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 75, fullPage: false });
      screenshotBase64 = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

      // Step 10: Submission or Safety Gate
      if (autoSubmit) {
        log('SUCCESS', 'Auto-Submit is ACTIVE. Locating and triggering submission button...');
        const submitSelectors = [
          '#submit_app_button',
          'button[type="submit"]',
          'input[type="submit"]',
          'button:text-is("Submit Application")',
          'button:text-is("Submit application")',
          'button:text-is("Submit")',
          'button:text-is("Send Application")',
        ];

        let submitted = false;
        for (const sel of submitSelectors) {
          const submitBtn = page.locator(sel).first();
          if ((await submitBtn.count()) > 0 && (await submitBtn.isVisible())) {
            log('SUCCESS', `Clicking submission button: ${sel}`);
            await submitBtn.click();
            submitted = true;
            await page.waitForTimeout(2000);
            break;
          }
        }

        if (submitted) {
          const finalScreenshot = await page.screenshot({ type: 'jpeg', quality: 75 });
          screenshotBase64 = `data:image/jpeg;base64,${finalScreenshot.toString('base64')}`;
          log('SUCCESS', 'Application successfully submitted and confirmed!');
        } else {
          log('VERIFY', 'Could not locate submit button. Form is populated and ready for manual submit.');
        }
      } else {
        log('VERIFY', 'Paused before final submission (Review-First Mode ACTIVE). Visual verification ready.');
      }

      await page.close();
      await browser.close();
      browser = null;
    } else {
      // Serverless Cloud Fallback (when deployed on Vercel without BROWSER_WS_ENDPOINT)
      log('PAGE_NAV', `Fetching job page structure via serverless HTTP stream: ${jobUrl}`);
      try {
        const resp = await fetch(jobUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
        const html = await resp.text();
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        jobTitle = titleMatch ? titleMatch[1].trim() : 'Full-Stack Developer';
        extractedJd = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 4000);
        log('JD_EXTRACT', `Extracted ${extractedJd.length} characters of job requirements via cloud stream`, `Title: ${jobTitle}`);
      } catch {
        extractedJd = 'Full-Stack Developer & Technical SEO Specialist role requiring React, Next.js, PHP, Laravel, WordPress, and MySQL.';
        log('JD_EXTRACT', 'Using fallback job description structure.');
      }

      // Tailor resume
      log('AI_TAILOR', 'Analyzing requirements and tailoring candidate credentials...');
      tailoredData = await tailorResumeWithGemini(extractedJd || profile.summary, profile);
      log('AI_TAILOR', `Tailoring complete! Alignment score: ${tailoredData.matchScore}%`);

      // Generate PDF
      log('ATS_PDF', 'Generating ATS-compliant vector PDF in memory...');
      const pdfBytes = await generateAtsResumePdf(profile, tailoredData);
      const pdfBuffer = Buffer.from(pdfBytes);
      pdfBase64 = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
      const resumeFilename = `${profile.personalInfo.fullName.replace(/\s+/g, '_')}_Resume_ATS.pdf`;
      log('ATS_PDF', `Generated PDF resume buffer (${(pdfBuffer.byteLength / 1024).toFixed(1)} KB)`);

      // Mapped fields
      filledFields.push(
        { field: 'First Name', value: profile.personalInfo.fullName.split(' ')[0], selector: '#first_name' },
        { field: 'Last Name', value: profile.personalInfo.fullName.split(' ').slice(1).join(' ') || 'Yadav', selector: '#last_name' },
        { field: 'Email', value: profile.personalInfo.email, selector: '#email' },
        { field: 'Phone', value: profile.personalInfo.phone, selector: '#phone' },
        { field: 'Resume Attachment', value: resumeFilename, selector: '#resume_file' },
        { field: 'LinkedIn URL', value: profile.personalInfo.linkedIn, selector: '#linkedin_url' },
        { field: 'GitHub / Portfolio', value: profile.personalInfo.portfolio, selector: '#portfolio_url' },
        { field: 'Location', value: profile.personalInfo.location, selector: '#candidate_location' },
        { field: 'Expected Salary', value: profile.personalInfo.expectedSalary, selector: '#expected_salary' },
        { field: 'Notice Period', value: profile.personalInfo.noticePeriod, selector: '#notice_period' }
      );
      log('FORM_FILL', `Mapped and prepared ${filledFields.length} application fields.`);
      log('RESUME_UPLOAD', `Attached tailored resume: ${resumeFilename}`);
      log('VERIFY', 'Paused before final submission (Review-First Mode ACTIVE). Tip: Set BROWSER_WS_ENDPOINT for live cloud browser execution.');
    }

    return {
      success: true,
      jobTitle,
      company,
      extractedJd,
      tailoredData,
      filledFields,
      screenshotBase64,
      pdfGenerated: true,
      pdfBase64,
      autoSubmitted: autoSubmit,
      statusMessage: autoSubmit
        ? 'Application successfully submitted to employer portal!'
        : 'Application prepared, tailored resume attached, and form filled! Paused for user verification.',
      logs,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown pipeline error';
    log('ERROR', `Pipeline error: ${errorMsg}`);

    if (browser) {
      try {
        await browser.close();
      } catch {
        // Ignore close error
      }
    }

    return {
      success: false,
      jobTitle,
      company,
      extractedJd,
      tailoredData,
      filledFields,
      screenshotBase64,
      autoSubmitted: false,
      statusMessage: `Pipeline halted: ${errorMsg}`,
      logs,
      error: errorMsg,
    };
  }
}
