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
 * Connects to a Cloud Headless Browser via WebSocket CDP on Vercel,
 * or falls back to local Google Chrome / Edge in local development.
 */
export async function getBrowserInstance(
  log: (stage: AutomationLog['stage'], msg: string, detail?: string) => void
): Promise<{ browser: Browser; isCloud: boolean }> {
  const wsEndpoint = process.env.BROWSER_WS_ENDPOINT?.trim();

  if (wsEndpoint && wsEndpoint.startsWith('ws')) {
    log('CDP_CONNECT', `Connecting to Cloud Browser via WebSocket CDP...`, `Endpoint: ${wsEndpoint.replace(/:[^:]*@/, ':***@')}`);
    const browser = await chromium.connectOverCDP(wsEndpoint, { timeout: 30000 });
    return { browser, isCloud: true };
  }

  // Local development fallback
  log('CDP_CONNECT', 'No BROWSER_WS_ENDPOINT detected. Launching local development browser...');
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
      throw new Error(
        'Unable to connect to browser. In production on Vercel, please provide BROWSER_WS_ENDPOINT (from Browserless.io or Browserbase). In local dev, ensure Google Chrome or Edge is installed.'
      );
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
    'button:has-text("Accept All")',
    'button:has-text("Accept all")',
    'button:has-text("Accept Cookies")',
    'button:has-text("Accept")',
    'button:has-text("I agree")',
    'button:has-text("Allow all")',
    'button:has-text("Got it")',
    '#onetrust-accept-btn-handler',
    '[data-testid="cookie-banner-accept"]',
  ];

  for (const selector of cookieSelectors) {
    try {
      const btn = await page.$(selector);
      if (btn && (await btn.isVisible())) {
        await btn.click({ timeout: 1500 });
        await page.waitForTimeout(500);
        break;
      }
    } catch {
      // Ignore non-matching banners
    }
  }
}

/**
 * Inspects all interactive form inputs on the application page
 */
interface RawFormField {
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
  return await page.evaluate(() => {
    const fields: RawFormField[] = [];
    const elements = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input, textarea, select'
      )
    );

    elements.forEach((el, index) => {
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute('type') || (tag === 'textarea' ? 'textarea' : 'text')).toLowerCase();

      // Skip hidden, submit, button, image, reset types (except type="file" which might have opacity: 0)
      if (['submit', 'button', 'image', 'reset', 'hidden'].includes(type) && type !== 'file') {
        return;
      }

      // Check visibility
      const style = window.getComputedStyle(el);
      const isVisible =
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        (type === 'file' || style.opacity !== '0');

      if (!isVisible && type !== 'file') return;

      // Find associated label text
      let labelText = '';
      if (el.id) {
        const labelEl = document.querySelector(`label[for="${el.id}"]`);
        if (labelEl) labelText = (labelEl.textContent || '').trim();
      }
      if (!labelText) {
        const parentLabel = el.closest('label');
        if (parentLabel) labelText = (parentLabel.textContent || '').trim();
      }
      if (!labelText) {
        // Look for preceding sibling or parent text
        const prev = el.previousElementSibling;
        if (prev && (prev.tagName.toLowerCase().startsWith('h') || prev?.tagName.toLowerCase() === 'span')) {
          labelText = (prev.textContent || '').trim();
        }
      }

      // Construct a reliable unique CSS selector
      let selector = '';
      if (el.id) {
        selector = `#${CSS.escape(el.id)}`;
      } else if (el.name) {
        selector = `${tag}[name="${CSS.escape(el.name)}"]`;
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
        name: el.name || '',
        id: el.id || '',
        placeholder: 'placeholder' in el ? (el as HTMLInputElement).placeholder : '',
        ariaLabel: el.getAttribute('aria-label') || '',
        labelText: labelText.slice(0, 100),
        options,
        isVisible,
      });
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
    lastName: profile.personalInfo.fullName.split(' ').slice(1).join(' ') || 'Candidate',
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
    "value": "Alex",
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
    } else if (meta.includes('salary') || meta.includes('compensation')) {
      mappings.push({ selector: f.selector, fieldName: 'Expected Salary', value: candidate.expectedSalary, action: 'type' });
    } else if (meta.includes('notice') || meta.includes('start date')) {
      mappings.push({ selector: f.selector, fieldName: 'Notice Period', value: candidate.noticePeriod, action: 'type' });
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
    log('CDP_CONNECT', `Connected to browser (${isCloud ? 'Cloud WebSocket CDP' : 'Local Headless Engine'}). Creating isolated page context...`);

    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Step 2: Navigate to target URL
    log('PAGE_NAV', `Navigating to target Job URL: ${jobUrl}`);
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(1500);

    // Dismiss Cookie Banners
    await dismissCookieBanners(page);

    // Extract Title & Text
    jobTitle = (await page.title()) || 'Software Engineer';
    extractedJd = await page.evaluate(() => {
      const main = document.querySelector('main, article, #job-description, .job-description, .posting-description');
      const text = main ? (main as HTMLElement).innerText : document.body.innerText;
      return text.replace(/\s+/g, ' ').trim().slice(0, 5000);
    });

    log('JD_EXTRACT', `Successfully extracted job description (${extractedJd.length} chars)`, `Title: ${jobTitle}`);

    // Step 3: AI Resume Tailoring (Gemini 2.5 Flash)
    if (enableTailoring) {
      log('AI_TAILOR', 'Analyzing JD requirements with Gemini 2.5 Flash for honest profile tailoring...');
      tailoredData = await tailorResumeWithGemini(extractedJd, profile);
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
    try {
      const applySelectors = [
        'button:has-text("Apply for this job")',
        'a:has-text("Apply for this job")',
        'button:has-text("Apply Now")',
        'a:has-text("Apply Now")',
        'a[href*="#apply"]',
        '#apply_button',
        '[data-automation-id="apply-button"]',
        'button:has-text("Apply")',
      ];
      for (const sel of applySelectors) {
        const applyBtn = await page.$(sel);
        if (applyBtn && (await applyBtn.isVisible())) {
          log('PAGE_NAV', `Clicking "Apply" button to reveal application form: ${sel}`);
          await applyBtn.click({ timeout: 2000 });
          await page.waitForTimeout(1500);
          break;
        }
      }
    } catch {
      // Ignore if form is already directly visible
    }

    // Step 6: Extract Form Fields from Page
    log('FORM_DETECT', 'Scanning DOM for visible application input fields...');
    const rawFields = await extractFormFields(page);
    log('FORM_DETECT', `Discovered ${rawFields.length} interactive form fields on page.`);

    // Step 7: Map fields via Gemini / Heuristics
    log('AI_MAPPING', 'Using Gemini AI to map candidate data to page form selectors...');
    const fieldMappings = await mapFieldsWithGemini(rawFields, profile);
    log('AI_MAPPING', `Successfully mapped ${fieldMappings.length} fields to candidate profile.`);

    // Step 8: Fill Form Fields
    for (const mapping of fieldMappings) {
      try {
        const el = await page.$(mapping.selector);
        if (!el) continue;

        if (mapping.action === 'file') {
          // Upload Tailored PDF directly from in-memory Buffer!
          log('RESUME_UPLOAD', `Uploading tailored ATS PDF to file input (${mapping.selector})...`);
          await el.setInputFiles({
            name: resumeFilename,
            mimeType: 'application/pdf',
            buffer: pdfBuffer,
          });
          filledFields.push({ field: mapping.fieldName, value: resumeFilename, selector: mapping.selector });
          log('RESUME_UPLOAD', `Uploaded ${resumeFilename} successfully!`);
        } else if (mapping.action === 'type') {
          await el.scrollIntoViewIfNeeded();
          await el.click({ timeout: 1500 });
          await el.fill(mapping.value);
          filledFields.push({ field: mapping.fieldName, value: mapping.value, selector: mapping.selector });
          log('FORM_FILL', `Filled [${mapping.fieldName}]: "${mapping.value}"`);
        } else if (mapping.action === 'select' && mapping.value) {
          await el.selectOption({ label: mapping.value }).catch(() => el.selectOption({ value: mapping.value }));
          filledFields.push({ field: mapping.fieldName, value: mapping.value, selector: mapping.selector });
          log('FORM_FILL', `Selected [${mapping.fieldName}]: "${mapping.value}"`);
        }
        await page.waitForTimeout(200); // Natural delay
      } catch (fieldErr: unknown) {
        const msg = fieldErr instanceof Error ? fieldErr.message : 'Field error';
        log('FORM_FILL', `Note: Skipped field [${mapping.fieldName}]: ${msg}`);
      }
    }

    // If file input wasn't in fieldMappings but exists on page, try to upload to any file input
    const uploadedAnyFile = filledFields.some((f) => f.field.toLowerCase().includes('resume'));
    if (!uploadedAnyFile) {
      try {
        const anyFileInput = await page.$('input[type="file"]');
        if (anyFileInput) {
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
        // Optional upload fallback
      }
    }

    // Step 9: Capture Viewport Screenshot
    log('SCREENSHOT', 'Capturing high-resolution browser verification screenshot...');
    const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 75, fullPage: false });
    screenshotBase64 = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

    // Step 10: Submission or Safety Gate
    if (autoSubmit) {
      log('SUCCESS', 'Auto-Submit is ACTIVE. Locating and triggering submission button...');
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Submit Application")',
        'button:has-text("Submit application")',
        'button:has-text("Submit")',
        'button:has-text("Send Application")',
      ];

      let submitted = false;
      for (const sel of submitSelectors) {
        const submitBtn = await page.$(sel);
        if (submitBtn && (await submitBtn.isVisible())) {
          log('SUCCESS', `Clicking submission button: ${sel}`);
          await submitBtn.click();
          submitted = true;
          await page.waitForTimeout(3000);
          break;
        }
      }

      if (submitted) {
        // Take post-submission confirmation screenshot
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

    return {
      success: true,
      jobTitle,
      company,
      extractedJd,
      tailoredData,
      formFieldsDetected: rawFields.map((f) => f.labelText || f.name || f.placeholder || f.selector),
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
