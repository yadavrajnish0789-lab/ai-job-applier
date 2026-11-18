# 🚀 JobPilot AI — 100% Cloud-Native Auto-Apply Agent

> **Autonomous, Vercel-Deployable AI Job Application Web App** powered by **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, **Playwright Core (CDP)**, and **Google Gemini 2.5 Flash (`@google/genai`)**.

Runs 100% in the cloud without needing local Python scripts, local Chrome binaries, or desktop automation setups.

---

## 🌟 Key Architecture & Capabilities

1. **100% Vercel Serverless Compatible**:
   - Vercel Serverless Functions cannot bundle heavy 200MB+ Chromium binaries.
   - The browser automation layer connects via **WebSocket CDP** (`playwright-core` + `chromium.connectOverCDP()`) to remote Cloud Headless Browser clusters (**Browserless.io** or **Browserbase** via `BROWSER_WS_ENDPOINT`).
   - Includes automatic local fallback (`channel: 'chrome'`) during offline local development.

2. **AI Resume Tailoring Engine (Gemini 2.5 Flash)**:
   - Evaluates target Job Descriptions against candidate credentials without fabricating false experience.
   - Rewrites headlines, professional summaries, and project/work bullet points to highlight alignment with target requirements.
   - Computes an ATS alignment match score (0–100%) and recruiter rationale.

3. **In-Memory ATS-Compliant Vector PDF Generation**:
   - Generates clean, ATS-scannable 1-page vector PDFs directly in memory using `pdf-lib` (zero Linux native dependencies).
   - Uploads directly as an in-memory `Buffer` into `input[type="file"]` elements during browser automation.

4. **AI-Assisted Dynamic Form Field Mapping**:
   - Inspects interactive DOM inputs (`<input>`, `<textarea>`, `<select>`, `input[type="file"]`) across diverse ATS portals (Greenhouse, Lever, Workday, etc.).
   - Employs Gemini to map candidate fields (Name, Email, Phone, LinkedIn, GitHub, Location, Experience, Notice Period) to the exact CSS selectors on the page.

5. **Review-First Visual Proof & Safety Gate**:
   - Captures high-resolution browser viewport screenshots before and after form autofill.
   - Default safety mode stops immediately before clicking "Submit", presenting visual proof and filled fields summary for user verification.
   - Optional toggle allows one-click autonomous submission.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router, Server Actions & Route Handlers)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS
- **AI / LLM**: `@google/genai` (Google Gemini 2.5 Flash)
- **Browser Automation**: `playwright-core` (WebSocket CDP)
- **PDF Engine**: `pdf-lib` (Pure in-memory vector generation)
- **Icons**: `lucide-react`

---

## 📋 Environment Variables Setup

Create a `.env.local` file in your project root or configure these in your **Vercel Project Settings > Environment Variables**:

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Recommended | Google Gemini API Key for JD analysis, bullet rewriting, and form mapping. |
| `BROWSER_WS_ENDPOINT` | Required on Vercel | WebSocket CDP URL to a Cloud Headless Browser provider (Browserless.io or Browserbase). |

---

### Step-by-Step: Obtaining Free Cloud API Keys

#### 1. Google Gemini API Key (`GEMINI_API_KEY`)
1. Visit [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **"Get API key"** > **"Create API key in new project"**.
4. Copy the generated key and set it as `GEMINI_API_KEY`.
*(Note: If left unset, the app operates in an intelligent heuristic demo mode).*

#### 2. Cloud Headless Browser Endpoint (`BROWSER_WS_ENDPOINT`)
For production serverless execution on Vercel, connect to a cloud browser service:

##### Option A: Browserless.io (Recommended)
1. Sign up for a free account at [Browserless.io](https://www.browserless.io/).
2. From your Browserless dashboard, copy your API Key / Token.
3. Your WebSocket endpoint will look like:
   ```env
   BROWSER_WS_ENDPOINT=wss://chrome.browserless.io?token=YOUR_BROWSERLESS_TOKEN
   ```

##### Option B: Browserbase.com
1. Sign up at [Browserbase.com](https://www.browserbase.com/).
2. Grab your Project ID and API Key.
3. Your WebSocket endpoint will look like:
   ```env
   BROWSER_WS_ENDPOINT=wss://connect.browserbase.com?apiKey=YOUR_BROWSERBASE_API_KEY
   ```

> **Local Development Note**: When running locally (`npm run dev`), if `BROWSER_WS_ENDPOINT` is left blank, the app will automatically launch your local Google Chrome or Microsoft Edge browser.

---

## 💻 Local Development Guide

1. **Clone & Install Dependencies**:
   ```bash
   git clone <YOUR_REPO_URL>
   cd Job
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env.local
   # Add your GEMINI_API_KEY and optionally BROWSER_WS_ENDPOINT
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Run Production Build Verification**:
   ```bash
   npm run build
   ```

---

## ☁️ Deploying to Vercel (1-Click)

1. Push your repository to **GitHub** (see instructions below).
2. Go to the [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New Project"**.
3. Import your GitHub repository.
4. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`
   - `BROWSER_WS_ENDPOINT`
5. Click **Deploy**. Vercel will build and deploy your app in under 60 seconds!

---

## 📂 Project Structure

```
├── .env.example                # Template for environment variables
├── next.config.ts              # Next.js config with serverExternalPackages
├── package.json                # Dependencies & scripts
├── public/                     # Static assets
└── src/
    ├── app/
    │   ├── api/
    │   │   ├── auto-apply/
    │   │   │   └── run/        # Cloud Browser automation runner endpoint (maxDuration = 60s)
    │   │   ├── resume/
    │   │   │   ├── pdf/        # ATS-friendly vector PDF generator endpoint
    │   │   │   └── tailor/     # Gemini 2.5 Flash resume tailoring endpoint
    │   │   └── status/         # System & Cloud Browser health check endpoint
    │   ├── globals.css         # Tailwind CSS styling
    │   ├── layout.tsx          # Root layout
    │   └── page.tsx            # Full Dashboard UI (Runner, Profile, Resume tabs)
    ├── data/
    │   └── defaultProfile.ts   # Candidate Ground-Truth Profile (Rajnish Yadav)
    ├── lib/
    │   ├── browserAutomation.ts# Playwright CDP cloud connector, form mapper & screenshot engine
    │   ├── geminiTailor.ts     # Gemini 2.5 Flash prompt & tailoring service
    │   └── pdfGenerator.ts     # In-memory ATS vector PDF builder (pdf-lib)
    └── types/
        └── profile.ts          # TypeScript schemas for candidate profiles & tailored data
```

---

## 🔒 Security & Privacy

- **Safe Defaults**: All `.env*` files are ignored by git to protect credentials.
- **Review-First Gate**: Prevents automated submissions until the candidate inspects the live browser screenshot and filled fields.
- **Pure Cloud-Native**: No local daemon processes or unverified script executions.
