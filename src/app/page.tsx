'use client';

import React, { useState, useEffect } from 'react';
import {
  Play,
  FileText,
  User,
  Download,
  Sparkles,
  CheckCircle2,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Globe,
  RefreshCw,
  Cpu,
  Briefcase,
  Check,
  Eye,
  Maximize2,
  X,
  FileCheck,
  Search,
  Building,
  Layers,
  Clock,
  Send,
  Sliders,
  Filter,
  CheckSquare,
  Square,
  AlertTriangle,
  Landmark,
} from 'lucide-react';
import { defaultProfile } from '@/data/defaultProfile';
import { MasterProfile, TailoredResumeData } from '@/types/profile';
import { AutomationLog, FilledField } from '@/lib/browserAutomation';
import { JobListing, JobCategory, JobQueueItem, BatchRunProgress } from '@/types/job';

interface SystemStatus {
  gemini: {
    configured: boolean;
    model: string;
    status: string;
  };
  browser: {
    configured: boolean;
    endpointType: string;
    status: string;
  };
  vercelReady: boolean;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'finder' | 'runner' | 'profile' | 'resume'>('finder');
  const [profile, setProfile] = useState<MasterProfile>(defaultProfile);
  const [savedNotification, setSavedNotification] = useState<string | null>(null);

  // System environment status
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  // ==========================================
  // TAB 1: AUTO JOB FINDER & QUEUE STATES
  // ==========================================
  const [jobCategory, setJobCategory] = useState<JobCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [discoveredJobs, setDiscoveredJobs] = useState<JobListing[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(false);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [batchQueue, setBatchQueue] = useState<JobQueueItem[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<BatchRunProgress | null>(null);

  // ==========================================
  // TAB 2: SINGLE RUNNER STATES
  // ==========================================
  const [jobUrl, setJobUrl] = useState<string>('/demo-job');
  const [autoSubmit, setAutoSubmit] = useState<boolean>(false);
  const [enableTailoring, setEnableTailoring] = useState<boolean>(true);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [logs, setLogs] = useState<AutomationLog[]>([
    {
      timestamp: 'Ready',
      stage: 'INIT',
      message: 'Agent ready. Select a job from Job Finder or enter a custom job URL.',
    },
  ]);
  const [runResult, setRunResult] = useState<{
    success: boolean;
    jobTitle?: string;
    company?: string;
    tailoredData?: TailoredResumeData;
    filledFields?: FilledField[];
    screenshotBase64?: string;
    pdfBase64?: string;
    autoSubmitted?: boolean;
    error?: string;
    statusMessage?: string;
  } | null>(null);

  // Modal Screenshot state
  const [activeScreenshot, setActiveScreenshot] = useState<{ url: string; title: string } | null>(null);

  // ==========================================
  // TAB 3 & 4: RESUME TAILORING STATES
  // ==========================================
  const [tailoredData, setTailoredData] = useState<TailoredResumeData | null>(null);
  const [resumeMode, setResumeMode] = useState<'master' | 'tailored'>('master');
  const [customJdInput, setCustomJdInput] = useState<string>('');
  const [isTailoring, setIsTailoring] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // Fetch API & Cloud Browser status on mount
  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => setSystemStatus(data))
      .catch((e) => console.error('Failed to fetch system status:', e));
  }, []);

  // Fetch initial jobs on mount
  useEffect(() => {
    loadJobs('all', '');
  }, []);

  // Local storage profile persistence
  useEffect(() => {
    const saved = localStorage.getItem('jobpilot_master_profile');
    if (saved) {
      try {
        setProfile(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load profile from localStorage', e);
      }
    }
  }, []);

  const saveProfile = (newProfile: MasterProfile) => {
    setProfile(newProfile);
    localStorage.setItem('jobpilot_master_profile', JSON.stringify(newProfile));
    triggerNotification('Master Profile successfully saved!');
  };

  const resetProfile = () => {
    if (confirm('Reset Master Profile back to default template?')) {
      setProfile(defaultProfile);
      localStorage.removeItem('jobpilot_master_profile');
      triggerNotification('Profile reset to default.');
    }
  };

  const triggerNotification = (msg: string) => {
    setSavedNotification(msg);
    setTimeout(() => setSavedNotification(null), 3000);
  };

  // Load jobs from discovery API
  const loadJobs = async (cat: JobCategory, queryStr: string) => {
    setIsLoadingJobs(true);
    try {
      const res = await fetch(`/api/jobs/discover?category=${cat}&query=${encodeURIComponent(queryStr)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.jobs)) {
        setDiscoveredJobs(data.jobs);
      }
    } catch (e) {
      console.error('Failed to load jobs:', e);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  // Toggle selection of a job for batch applying
  const toggleJobSelection = (id: string) => {
    const updated = new Set(selectedJobIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedJobIds(updated);
  };

  const selectAllJobs = () => {
    if (selectedJobIds.size === discoveredJobs.length) {
      setSelectedJobIds(new Set());
    } else {
      setSelectedJobIds(new Set(discoveredJobs.map((j) => j.id)));
    }
  };

  // Trigger 1-Click Auto Apply for a single card directly
  const handleDirectApply = (job: JobListing) => {
    setJobUrl(job.applyUrl || job.url);
    setActiveTab('runner');
    setTimeout(() => {
      triggerNotification(`Loaded: ${job.title} at ${job.company}`);
    }, 100);
  };

  // Run Batch Auto-Apply
  const handleRunBatch = async () => {
    const selectedJobsList = discoveredJobs.filter((j) => selectedJobIds.has(j.id));
    if (selectedJobsList.length === 0) {
      alert('Please select at least one job to auto-apply.');
      return;
    }

    setIsBatchRunning(true);
    setBatchProgress({
      total: selectedJobsList.length,
      completed: 0,
      successful: 0,
      failed: 0,
      stage: 'Preparing batch runner and loading candidate profile...',
    });

    try {
      const res = await fetch('/api/auto-apply/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobs: selectedJobsList,
          profile,
          autoSubmit,
          enableTailoring,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setBatchProgress(data.progress);
        setBatchQueue(data.results || []);
        triggerNotification(`Batch Complete! ${data.progress.successful}/${data.progress.total} jobs processed.`);
      } else {
        alert(data.error || 'Batch auto-apply failed.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Batch execution failed';
      alert('Batch error: ' + msg);
    } finally {
      setIsBatchRunning(false);
    }
  };

  // Run Single Auto-Apply Pipeline
  const handleRunAutoApply = async () => {
    if (!jobUrl.trim()) return;
    const resolvedUrl = jobUrl.startsWith('/')
      ? `${window.location.origin}${jobUrl}`
      : jobUrl;

    setIsRunning(true);
    setRunResult(null);
    setLogs([
      {
        timestamp: new Date().toLocaleTimeString(),
        stage: 'INIT',
        message: `Dispatching Cloud Auto-Apply Runner for: ${resolvedUrl}`,
      },
    ]);

    try {
      const res = await fetch('/api/auto-apply/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobUrl: resolvedUrl,
          autoSubmit,
          enableTailoring,
          profile,
        }),
      });

      const data = await res.json();
      if (data.logs && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }
      setRunResult(data);
      if (data.tailoredData) {
        setTailoredData(data.tailoredData);
        setResumeMode('tailored');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network request failed';
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toLocaleTimeString(),
          stage: 'ERROR',
          message: msg,
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  // Download ATS PDF from Master/Tailored tab
  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const res = await fetch('/api/resume/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          tailoredData: resumeMode === 'tailored' ? tailoredData : null,
        }),
      });

      if (!res.ok) throw new Error('PDF generation failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${profile.personalInfo.fullName.replace(/\s+/g, '_')}_${
        resumeMode === 'tailored' ? 'Tailored' : 'Master'
      }_ATS_Resume.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert('Failed to download PDF. Please check server logs.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Download uploaded PDF from single run
  const handleDownloadUploadedPdf = (pdfBase64Str?: string) => {
    const target = pdfBase64Str || runResult?.pdfBase64;
    if (!target) return;
    const a = document.createElement('a');
    a.href = target;
    a.download = `${profile.personalInfo.fullName.replace(/\s+/g, '_')}_Tailored_Application_Resume.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Quick test tailoring
  const handleCustomTailoring = async () => {
    if (!customJdInput.trim()) {
      alert('Please paste a job description snippet first.');
      return;
    }
    setIsTailoring(true);
    try {
      const res = await fetch('/api/resume/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: customJdInput,
          profile,
        }),
      });
      const data = await res.json();
      if (data.success && data.tailoredData) {
        setTailoredData(data.tailoredData);
        setResumeMode('tailored');
        triggerNotification('Resume tailored successfully with Gemini AI!');
      } else {
        alert(data.error || 'Tailoring failed.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error during tailoring';
      alert('Error: ' + msg);
    } finally {
      setIsTailoring(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification */}
      {savedNotification && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 border border-emerald-400 text-sm animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{savedNotification}</span>
        </div>
      )}

      {/* Screenshot Lightbox Modal */}
      {activeScreenshot && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-5xl w-full max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Eye className="w-4 h-4 text-indigo-400" />
                <span>Verification Screenshot: {activeScreenshot.title}</span>
              </div>
              <button
                onClick={() => setActiveScreenshot(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-auto p-4 flex-1 bg-slate-950 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeScreenshot.url}
                alt="Verification Screenshot"
                className="max-w-full rounded-lg border border-slate-800 shadow"
              />
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">JobPilot AI</span>
                <span className="text-[11px] font-semibold bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30">
                  Autonomous V2
                </span>
              </div>
              <p className="text-xs text-slate-400">Scrape, Tailor & Auto-Apply • Tech, Remote & Sarkari IT</p>
            </div>
          </div>

          {/* Cloud Readiness & Environment Badges */}
          <div className="hidden md:flex items-center gap-2.5 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-slate-300">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                Browser:{' '}
                <strong className={systemStatus?.browser.configured ? 'text-emerald-400 font-semibold' : 'text-indigo-300'}>
                  {systemStatus ? systemStatus.browser.status : 'CDP Ready'}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>
                AI:{' '}
                <strong className={systemStatus?.gemini.configured ? 'text-emerald-400 font-semibold' : 'text-purple-300'}>
                  {systemStatus ? systemStatus.gemini.status : 'Gemini 2.5 Flash'}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>100% Free Resources</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 border-t border-slate-800/60 pt-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('finder')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'finder'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Search className="w-4 h-4 text-indigo-400" />
            <span>Auto Job Finder & Live Feeds</span>
            <span className="px-1.5 py-0.2 rounded-full bg-indigo-600/30 text-indigo-300 text-[10px] font-bold">
              {discoveredJobs.length || '140+'}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('runner')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'runner'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Play className="w-4 h-4" />
            <span>Single-URL Auto-Apply</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Master Profile ({profile.personalInfo.fullName.split(' ')[0]})</span>
          </button>
          <button
            onClick={() => setActiveTab('resume')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'resume'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>ATS Resume & PDF</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {/* ========================================================= */}
        {/* TAB 1: AUTO JOB FINDER & LIVE FEEDS                       */}
        {/* ========================================================= */}
        {activeTab === 'finder' && (
          <div className="space-y-6">
            {/* Top Discovery Filter Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Search className="w-5 h-5 text-indigo-400" />
                    Multi-Source Job Scraper & Autonomous Queue
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Continuously aggregates active openings across RemoteOK, Arbeitnow, Greenhouse/Lever company boards, and Sarkari IT feeds.
                  </p>
                </div>

                {/* Source Category Pills */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => {
                      setJobCategory('all');
                      loadJobs('all', searchQuery);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                      jobCategory === 'all'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🌐 All Sources ({discoveredJobs.length})
                  </button>
                  <button
                    onClick={() => {
                      setJobCategory('sarkari_govt');
                      loadJobs('sarkari_govt', searchQuery);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1 ${
                      jobCategory === 'sarkari_govt'
                        ? 'bg-amber-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Landmark className="w-3.5 h-3.5" />
                    <span>🏛️ Sarkari / Govt IT</span>
                  </button>
                  <button
                    onClick={() => {
                      setJobCategory('tech_remote');
                      loadJobs('tech_remote', searchQuery);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                      jobCategory === 'tech_remote'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    💻 Remote Global
                  </button>
                  <button
                    onClick={() => {
                      setJobCategory('top_companies');
                      loadJobs('top_companies', searchQuery);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                      jobCategory === 'top_companies'
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🏢 Top Companies
                  </button>
                </div>
              </div>

              {/* Search Bar & Fast Keyword Filter Tags */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadJobs(jobCategory, searchQuery)}
                    placeholder="Search by role or tech (e.g. Next.js, Laravel, WordPress, SEO, PHP, Programmer)..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={() => loadJobs(jobCategory, searchQuery)}
                  disabled={isLoadingJobs}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isLoadingJobs ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Filter className="w-3.5 h-3.5" />
                  )}
                  <span>Search Feeds</span>
                </button>
              </div>

              {/* Keyword Quick Tags */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 pt-1">
                <span className="text-slate-500">Fast Filters:</span>
                {['Next.js', 'React', 'PHP', 'Laravel', 'WordPress', 'SEO', 'MySQL', 'Full Stack', 'Programmer'].map(
                  (kw) => (
                    <button
                      key={kw}
                      onClick={() => {
                        setSearchQuery(kw);
                        loadJobs(jobCategory, kw);
                      }}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-[11px] cursor-pointer transition-colors"
                    >
                      {kw}
                    </button>
                  )
                )}
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      loadJobs(jobCategory, '');
                    }}
                    className="text-rose-400 hover:underline text-[11px] ml-2"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>

            {/* Sticky Batch Control Toolbar (When 1+ jobs selected) */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/40 rounded-2xl p-4 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={selectAllJobs}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  {selectedJobIds.size === discoveredJobs.length ? (
                    <CheckSquare className="w-4 h-4 text-indigo-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>
                    {selectedJobIds.size === discoveredJobs.length ? 'Deselect All' : 'Select All Jobs'}
                  </span>
                </button>

                <div className="text-xs text-slate-300">
                  <strong className="text-indigo-400 text-sm">{selectedJobIds.size}</strong> jobs selected for batch run
                </div>
              </div>

              {/* Batch Settings & Action CTA */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300">
                  <span>Auto-Submit:</span>
                  <input
                    type="checkbox"
                    checked={autoSubmit}
                    onChange={(e) => setAutoSubmit(e.target.checked)}
                    className="cursor-pointer"
                  />
                  <span className={autoSubmit ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                    {autoSubmit ? 'Active (Direct Submit)' : 'Review-First Safe'}
                  </span>
                </div>

                <button
                  onClick={handleRunBatch}
                  disabled={isBatchRunning || selectedJobIds.size === 0}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-all"
                >
                  {isBatchRunning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Batch Running...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>⚡ Auto-Apply to {selectedJobIds.size || 0} Selected</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Batch Progress Bar (when running) */}
            {batchProgress && (
              <div className="bg-slate-900 border border-indigo-500/50 rounded-2xl p-5 shadow-xl space-y-3 animate-fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    <span>{batchProgress.stage}</span>
                  </span>
                  <span className="text-indigo-300 font-mono">
                    {batchProgress.completed} / {batchProgress.total} completed ({batchProgress.successful} successful, {batchProgress.failed} failed)
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-2.5 transition-all duration-300"
                    style={{
                      width: `${(batchProgress.completed / (batchProgress.total || 1)) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            )}

            {/* Batch Results Drawer / History (if any processed) */}
            {batchQueue.length > 0 && (
              <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-5 shadow-xl space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Completed Batch Applications Queue ({batchQueue.length})</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto">
                  {batchQueue.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-white">{item.job.title}</div>
                        <div className="text-[11px] text-slate-400">
                          {item.job.company} • Match: <strong className="text-emerald-400">{item.matchScore}%</strong>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          Status: <span className="text-indigo-300 font-medium">{item.status}</span> ({item.fieldsFilledCount} fields filled)
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {item.screenshotBase64 && (
                          <button
                            onClick={() =>
                              setActiveScreenshot({
                                url: item.screenshotBase64!,
                                title: `${item.job.title} at ${item.job.company}`,
                              })
                            }
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-slate-300 cursor-pointer"
                            title="View Screenshot Proof"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-400" />
                          </button>
                        )}
                        {item.pdfBase64 && (
                          <button
                            onClick={() => handleDownloadUploadedPdf(item.pdfBase64)}
                            className="p-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 rounded text-emerald-300 cursor-pointer"
                            title="Download Tailored PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Discovered Jobs Card Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Showing {discoveredJobs.length} active opportunities</span>
                <span>Select cards to batch apply, or click &quot;Apply Now&quot; for instant run</span>
              </div>

              {isLoadingJobs ? (
                <div className="py-20 text-center space-y-3 bg-slate-900/40 rounded-2xl border border-slate-800">
                  <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                  <p className="text-sm text-slate-300">Scraping and aggregating jobs across all free feeds...</p>
                </div>
              ) : discoveredJobs.length === 0 ? (
                <div className="py-20 text-center space-y-3 bg-slate-900/40 rounded-2xl border border-slate-800">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-sm text-slate-300">No jobs matched your filter. Try clearing keywords.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {discoveredJobs.map((job) => {
                    const isSelected = selectedJobIds.has(job.id);
                    const isSarkari = job.category === 'sarkari_govt';
                    const isTopCompany = job.category === 'top_companies';

                    return (
                      <div
                        key={job.id}
                        className={`bg-slate-900 border rounded-2xl p-5 shadow-xl transition-all flex flex-col justify-between space-y-4 hover:border-indigo-500/60 ${
                          isSelected ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-800'
                        }`}
                      >
                        {/* Header: Title, Company, Source & Selection Checkbox */}
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => toggleJobSelection(job.id)}
                                className="mt-1 text-slate-400 hover:text-indigo-400 cursor-pointer"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-5 h-5 text-indigo-400" />
                                ) : (
                                  <Square className="w-5 h-5 text-slate-600" />
                                )}
                              </button>

                              <div>
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                      isSarkari
                                        ? 'bg-amber-950 text-amber-300 border-amber-700'
                                        : isTopCompany
                                        ? 'bg-purple-950 text-purple-300 border-purple-700'
                                        : 'bg-blue-950 text-blue-300 border-blue-700'
                                    }`}
                                  >
                                    {job.source}
                                  </span>

                                  {job.salary && (
                                    <span className="text-[11px] text-emerald-400 font-mono">
                                      {job.salary}
                                    </span>
                                  )}
                                </div>

                                <h3 className="font-bold text-base text-white hover:text-indigo-300 transition-colors">
                                  {job.title}
                                </h3>

                                <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                                  <span className="font-medium text-slate-300">{job.company}</span>
                                  <span>•</span>
                                  <span>{job.location}</span>
                                </div>
                              </div>
                            </div>

                            {/* Match Score Badge */}
                            {job.matchScore && (
                              <div className="text-center px-2.5 py-1 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
                                <div className="text-[9px] text-slate-400 uppercase font-semibold">Match</div>
                                <div className="text-sm font-bold text-emerald-400">{job.matchScore}%</div>
                              </div>
                            )}
                          </div>

                          {/* Description Snippet */}
                          <p className="text-xs text-slate-300 line-clamp-3 mt-3 leading-relaxed">
                            {job.description}
                          </p>

                          {/* Tags */}
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {job.tags.slice(0, 5).map((t, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-400 font-mono"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Action Footer */}
                        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-500">{job.postedAt}</span>

                          <div className="flex items-center gap-2">
                            <a
                              href={job.applyUrl || job.url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1"
                            >
                              <span>Original URL</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>

                            <button
                              onClick={() => handleDirectApply(job)}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Auto-Apply</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: SINGLE-URL AUTO-APPLY RUNNER                      */}
        {/* ========================================================= */}
        {activeTab === 'runner' && (
          <div className="space-y-6">
            {/* Top Control Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-indigo-400" />
                    Target Job Application Runner
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Autonomous Playwright browser connects over WebSocket CDP, extracts JD, rewrites resume bullets with Gemini 2.5 Flash, maps form selectors, uploads ATS PDF in-memory, and provides visual proof.
                  </p>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-500">Quick Test URLs:</span>
                  <button
                    onClick={() => setJobUrl('/demo-job')}
                    className="px-2.5 py-1 bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 rounded border border-indigo-700 font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <span>🎯 Built-in Live Demo Job</span>
                    <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-1 rounded">100% Verified</span>
                  </button>
                  <a
                    href="/demo-job"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 border border-slate-700 flex items-center gap-1"
                  >
                    <span>View Demo Page</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* URL Input & Controls */}
              <div className="pt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Job Posting URL (Greenhouse, Lever, LinkedIn, Workday, Sarkari Portal, etc.)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={jobUrl}
                      onChange={(e) => setJobUrl(e.target.value)}
                      placeholder="https://... or /demo-job"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                    />
                  </div>
                </div>

                {/* Automation Toggles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div className="flex items-center justify-between p-3.5 bg-slate-950/70 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-sm font-medium text-slate-200">AI Resume Tailoring</span>
                      <p className="text-xs text-slate-400">
                        Analyze JD & rewrite bullets to match requirements using Gemini 2.5 Flash
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableTailoring}
                        onChange={(e) => setEnableTailoring(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-slate-950/70 rounded-xl border border-slate-800">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-slate-200">Auto-Submit Final Form</span>
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                          Review-First Safe
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        When off, pipeline pauses at the final review step for visual confirmation
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoSubmit}
                        onChange={(e) => setAutoSubmit(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>
                </div>

                {/* Action CTA */}
                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Candidate Profile: <strong>{profile.personalInfo.fullName}</strong></span>
                  </div>

                  <button
                    onClick={handleRunAutoApply}
                    disabled={isRunning}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isRunning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Running Cloud Pipeline...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Start Auto-Apply Run</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Run Outcome Card (Visual Proof, Screenshot, Filled Fields & PDF Download) */}
            {runResult && (
              <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Pipeline Executed
                      </span>
                      <span className="text-xs text-slate-400">
                        {runResult.autoSubmitted ? 'Application Submitted' : 'Pre-Submission Verified'}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mt-1.5">{runResult.jobTitle}</h3>
                    <p className="text-xs text-slate-300">{runResult.statusMessage}</p>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {runResult.tailoredData && (
                      <div className="text-center px-4 py-2 bg-slate-950 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Match Score</div>
                        <div className="text-xl font-bold text-emerald-400">
                          {runResult.tailoredData.matchScore}%
                        </div>
                      </div>
                    )}

                    {runResult.pdfBase64 && (
                      <button
                        onClick={() => handleDownloadUploadedPdf()}
                        className="px-3.5 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <FileCheck className="w-4 h-4" />
                        Download Uploaded PDF
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setActiveTab('resume');
                        setResumeMode('tailored');
                      }}
                      className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-xl text-xs font-medium border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      View Tailored Resume
                    </button>
                  </div>
                </div>

                {/* Visual Proof & Filled Fields Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Live Browser Screenshot Preview */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-indigo-400" />
                        Browser Viewport Screenshot
                      </span>
                      {runResult.screenshotBase64 && (
                        <button
                          onClick={() =>
                            setActiveScreenshot({
                              url: runResult.screenshotBase64!,
                              title: runResult.jobTitle || 'Application Preview',
                            })
                          }
                          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Maximize2 className="w-3 h-3" />
                          <span>Enlarge</span>
                        </button>
                      )}
                    </div>

                    <div
                      onClick={() =>
                        runResult.screenshotBase64 &&
                        setActiveScreenshot({
                          url: runResult.screenshotBase64,
                          title: runResult.jobTitle || 'Application Preview',
                        })
                      }
                      className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden aspect-video flex items-center justify-center cursor-pointer group"
                    >
                      {runResult.screenshotBase64 ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={runResult.screenshotBase64}
                            alt="Browser Viewport"
                            className="w-full h-full object-cover object-top transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-medium gap-1.5">
                            <Maximize2 className="w-4 h-4" />
                            Click to View Full Resolution
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-slate-500">No screenshot captured</span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Filled Form Fields Summary */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Auto-Filled Application Fields ({runResult.filledFields?.length || 0})
                    </span>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-56 overflow-y-auto space-y-2">
                      {runResult.filledFields && runResult.filledFields.length > 0 ? (
                        runResult.filledFields.map((f, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs py-1.5 px-2 bg-slate-900/60 rounded border border-slate-800/80"
                          >
                            <span className="font-semibold text-slate-300">{f.field}:</span>
                            <span className="text-indigo-300 font-mono text-[11px] truncate max-w-[220px]">
                              {f.value}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-500 py-4 text-center">
                          No input fields required or detected on page.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Live Status Log Feed */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Live Execution Logs & CDP Status Feed
                  </span>
                </div>
                <button
                  onClick={() =>
                    setLogs([
                      {
                        timestamp: new Date().toLocaleTimeString(),
                        stage: 'INIT',
                        message: 'Console cleared. Agent ready.',
                      },
                    ])
                  }
                  className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  Clear Console
                </button>
              </div>

              <div className="p-4 font-mono text-xs max-h-96 overflow-y-auto space-y-2">
                {logs.map((log, idx) => {
                  let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
                  if (log.stage === 'INIT') badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
                  if (log.stage === 'CDP_CONNECT') badgeColor = 'bg-indigo-950 text-indigo-300 border-indigo-700';
                  if (log.stage === 'PAGE_NAV') badgeColor = 'bg-blue-950 text-blue-300 border-blue-700';
                  if (log.stage === 'JD_EXTRACT') badgeColor = 'bg-cyan-950 text-cyan-300 border-cyan-700';
                  if (log.stage === 'AI_TAILOR') badgeColor = 'bg-purple-950 text-purple-300 border-purple-700';
                  if (log.stage === 'ATS_PDF') badgeColor = 'bg-pink-950 text-pink-300 border-pink-700';
                  if (log.stage === 'FORM_FILL' || log.stage === 'FORM_DETECT' || log.stage === 'AI_MAPPING')
                    badgeColor = 'bg-amber-950 text-amber-300 border-amber-700';
                  if (log.stage === 'RESUME_UPLOAD') badgeColor = 'bg-teal-950 text-teal-300 border-teal-700';
                  if (log.stage === 'SCREENSHOT') badgeColor = 'bg-violet-950 text-violet-300 border-violet-700';
                  if (log.stage === 'SUCCESS' || log.stage === 'VERIFY')
                    badgeColor = 'bg-emerald-950 text-emerald-300 border-emerald-700';
                  if (log.stage === 'ERROR') badgeColor = 'bg-rose-950 text-rose-300 border-rose-700';

                  return (
                    <div key={idx} className="flex items-start gap-3 py-1 hover:bg-slate-900/40 px-2 rounded">
                      <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider border shrink-0 ${badgeColor}`}
                      >
                        {log.stage}
                      </span>
                      <div className="flex-1 text-slate-200">
                        <span>{log.message}</span>
                        {log.detail && (
                          <div className="text-[11px] text-slate-400 mt-0.5">{log.detail}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: MASTER PROFILE EDITOR                              */}
        {/* ========================================================= */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-400" />
                  Candidate Master Profile
                </h2>
                <p className="text-xs text-slate-400">
                  Pre-filled with Full-Stack & Technical SEO credentials. Used as ground-truth for honest AI tailoring.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={resetProfile}
                  className="px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 cursor-pointer"
                >
                  Reset Defaults
                </button>
                <button
                  onClick={() => saveProfile(profile)}
                  className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Profile
                </button>
              </div>
            </div>

            {/* Section 1: Personal & Contact Information */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 pb-2 border-b border-slate-800">
                1. Personal & Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profile.personalInfo.fullName}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        personalInfo: { ...profile.personalInfo, fullName: e.target.value },
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={profile.personalInfo.email}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        personalInfo: { ...profile.personalInfo, email: e.target.value },
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Phone</label>
                  <input
                    type="text"
                    value={profile.personalInfo.phone}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        personalInfo: { ...profile.personalInfo, phone: e.target.value },
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Location</label>
                  <input
                    type="text"
                    value={profile.personalInfo.location}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        personalInfo: { ...profile.personalInfo, location: e.target.value },
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">LinkedIn URL</label>
                  <input
                    type="text"
                    value={profile.personalInfo.linkedIn}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        personalInfo: { ...profile.personalInfo, linkedIn: e.target.value },
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">GitHub URL</label>
                  <input
                    type="text"
                    value={profile.personalInfo.github}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        personalInfo: { ...profile.personalInfo, github: e.target.value },
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Portfolio / Website</label>
                  <input
                    type="text"
                    value={profile.personalInfo.portfolio}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        personalInfo: { ...profile.personalInfo, portfolio: e.target.value },
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Work Authorization</label>
                  <input
                    type="text"
                    value={profile.personalInfo.workAuthorization}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        personalInfo: { ...profile.personalInfo, workAuthorization: e.target.value },
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Expected Salary</label>
                  <input
                    type="text"
                    value={profile.personalInfo.expectedSalary}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        personalInfo: { ...profile.personalInfo, expectedSalary: e.target.value },
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                  />
                </div>
              </div>

              {/* Headline & Summary */}
              <div className="pt-2 space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Professional Headline</label>
                  <input
                    type="text"
                    value={profile.headline}
                    onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Professional Summary</label>
                  <textarea
                    rows={3}
                    value={profile.summary}
                    onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Categorized Skills */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 pb-2 border-b border-slate-800 flex items-center justify-between">
                <span>2. Core Skills by Category</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profile.skillCategories.map((cat, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                    <h4 className="text-xs font-semibold text-slate-300 mb-2">{cat.category}</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.skills.map((skill, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: Work Experience */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 pb-2 border-b border-slate-800">
                3. Work Experience
              </h3>

              <div className="space-y-4">
                {profile.experience.map((exp) => (
                  <div key={exp.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-white text-sm">{exp.role}</div>
                        <div className="text-xs text-slate-400">
                          {exp.company} • {exp.location}
                        </div>
                      </div>
                      <div className="text-xs text-indigo-400 font-mono">
                        {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <div className="text-xs font-medium text-slate-400">Key Achievements:</div>
                      {exp.highlights.map((h, hIdx) => (
                        <div key={hIdx} className="text-xs text-slate-300 flex items-start gap-2">
                          <span className="text-indigo-400 mt-0.5">•</span>
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 4: Projects (including OwnLMS) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 pb-2 border-b border-slate-800">
                4. Highlighted Projects (e.g. OwnLMS)
              </h3>

              <div className="grid grid-cols-1 gap-4">
                {profile.projects.map((proj) => (
                  <div key={proj.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-white text-sm flex items-center gap-2">
                        <span>{proj.name}</span>
                        <span className="text-[11px] font-normal text-slate-400">({proj.subtitle})</span>
                      </div>
                      {proj.liveUrl && (
                        <a
                          href={proj.liveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          <span>{proj.liveUrl.replace('https://', '')}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-slate-300">{proj.description}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {proj.technologies.map((t, tIdx) => (
                        <span
                          key={tIdx}
                          className="px-2 py-0.5 bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 rounded text-[10px]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: ATS RESUME PREVIEW & PDF DOWNLOAD                   */}
        {/* ========================================================= */}
        {activeTab === 'resume' && (
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center">
                  <button
                    onClick={() => setResumeMode('master')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                      resumeMode === 'master'
                        ? 'bg-slate-800 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Master Resume
                  </button>
                  <button
                    onClick={() => setResumeMode('tailored')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      resumeMode === 'tailored'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>AI-Tailored Resume</span>
                    {tailoredData && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 rounded">
                        {tailoredData.matchScore}%
                      </span>
                    )}
                  </button>
                </div>

                <span className="text-xs text-slate-400 hidden sm:inline">
                  ATS Standard 1-Page Vector Rendering
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-medium rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isDownloadingPdf ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Download ATS Resume (PDF)</span>
                </button>
              </div>
            </div>

            {/* AI Tailoring Sandbox Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Live Gemini 2.5 Flash Resume Tailor
                  </span>
                </div>
                {tailoredData && (
                  <span className="text-xs text-emerald-400 font-medium">
                    Job Match Alignment: {tailoredData.matchScore}%
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <textarea
                  rows={2}
                  value={customJdInput}
                  onChange={(e) => setCustomJdInput(e.target.value)}
                  placeholder="Paste any target job description or requirements here to test instant AI tailoring..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />

                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5 text-xs text-slate-400">
                    {tailoredData?.matchedKeywords && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-500">Keywords extracted:</span>
                        {tailoredData.matchedKeywords.map((kw, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 text-[11px]"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleCustomTailoring}
                    disabled={isTailoring}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {isTailoring ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>Tailor Resume</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ATS Resume Sheet Visual Preview */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex justify-center">
              <div className="w-full max-w-3xl bg-white text-slate-900 p-8 sm:p-12 rounded-lg shadow-2xl font-serif text-[13px] leading-relaxed select-text">
                {/* Resume Header */}
                <div className="text-center border-b border-slate-300 pb-3 mb-4">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 font-sans">
                    {profile.personalInfo.fullName}
                  </h1>
                  <p className="text-xs font-sans text-slate-600 mt-1 font-medium">
                    {resumeMode === 'tailored' && tailoredData?.tailoredHeadline
                      ? tailoredData.tailoredHeadline
                      : profile.headline}
                  </p>
                  <p className="text-[11px] font-sans text-slate-500 mt-1.5 space-x-2">
                    <span>{profile.personalInfo.email}</span>
                    <span>•</span>
                    <span>{profile.personalInfo.phone}</span>
                    <span>•</span>
                    <span>{profile.personalInfo.location}</span>
                    <span>•</span>
                    <span>{profile.personalInfo.portfolio.replace('https://', '')}</span>
                    <span>•</span>
                    <span>{profile.personalInfo.github.replace('https://', '')}</span>
                  </p>
                </div>

                {/* Section: Professional Summary */}
                <div className="mb-4">
                  <h2 className="text-xs font-bold font-sans tracking-wider uppercase text-slate-800 border-b border-slate-300 pb-0.5 mb-2">
                    Professional Summary
                  </h2>
                  <p className="text-xs text-slate-700 font-sans leading-normal">
                    {resumeMode === 'tailored' && tailoredData?.tailoredSummary
                      ? tailoredData.tailoredSummary
                      : profile.summary}
                  </p>
                </div>

                {/* Section: Technical Skills */}
                <div className="mb-4">
                  <h2 className="text-xs font-bold font-sans tracking-wider uppercase text-slate-800 border-b border-slate-300 pb-0.5 mb-2">
                    Technical Skills
                  </h2>
                  <div className="space-y-1 font-sans text-xs">
                    {profile.skillCategories.map((cat, i) => (
                      <div key={i}>
                        <span className="font-semibold text-slate-900">{cat.category}: </span>
                        <span className="text-slate-700">{cat.skills.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section: Work Experience */}
                <div className="mb-4">
                  <h2 className="text-xs font-bold font-sans tracking-wider uppercase text-slate-800 border-b border-slate-300 pb-0.5 mb-2">
                    Professional Experience
                  </h2>
                  <div className="space-y-3 font-sans">
                    {profile.experience.map((exp) => {
                      const bullets =
                        resumeMode === 'tailored' &&
                        tailoredData?.tailoredHighlights &&
                        tailoredData.tailoredHighlights[exp.id]
                          ? tailoredData.tailoredHighlights[exp.id]
                          : exp.highlights;

                      return (
                        <div key={exp.id}>
                          <div className="flex justify-between items-baseline text-xs">
                            <span className="font-bold text-slate-950">{exp.role}</span>
                            <span className="text-[11px] text-slate-600">
                              {exp.startDate} – {exp.current ? 'Present' : exp.endDate}
                            </span>
                          </div>
                          <div className="text-[11px] italic text-slate-600 mb-1">
                            {exp.company} | {exp.location}
                          </div>
                          <ul className="list-disc list-outside pl-4 space-y-0.5 text-xs text-slate-700">
                            {bullets.map((b, bIdx) => (
                              <li key={bIdx}>{b}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section: Featured Projects */}
                <div className="mb-4">
                  <h2 className="text-xs font-bold font-sans tracking-wider uppercase text-slate-800 border-b border-slate-300 pb-0.5 mb-2">
                    Featured Projects
                  </h2>
                  <div className="space-y-3 font-sans">
                    {profile.projects.map((proj) => {
                      const bullets =
                        resumeMode === 'tailored' &&
                        tailoredData?.tailoredHighlights &&
                        tailoredData.tailoredHighlights[proj.id]
                          ? tailoredData.tailoredHighlights[proj.id]
                          : proj.highlights;

                      return (
                        <div key={proj.id}>
                          <div className="flex justify-between items-baseline text-xs">
                            <span className="font-bold text-slate-950">{proj.name}</span>
                            <span className="text-[11px] text-slate-600">
                              {proj.technologies.slice(0, 4).join(', ')}
                            </span>
                          </div>
                          <div className="text-[11px] italic text-slate-600 mb-0.5">
                            {proj.subtitle}
                          </div>
                          <p className="text-xs text-slate-700 mb-1">{proj.description}</p>
                          <ul className="list-disc list-outside pl-4 space-y-0.5 text-xs text-slate-700">
                            {bullets.map((b, bIdx) => (
                              <li key={bIdx}>{b}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section: Education */}
                <div>
                  <h2 className="text-xs font-bold font-sans tracking-wider uppercase text-slate-800 border-b border-slate-300 pb-0.5 mb-2">
                    Education
                  </h2>
                  <div className="space-y-1 font-sans text-xs">
                    {profile.education.map((edu) => (
                      <div key={edu.id} className="flex justify-between items-baseline">
                        <div>
                          <span className="font-bold text-slate-900">{edu.institution}</span>
                          <span className="text-slate-700">
                            {' '}
                            — {edu.degree} in {edu.fieldOfStudy}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-600">
                          {edu.startDate} – {edu.endDate}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <p>JobPilot AI • 100% Cloud-Native • Autonomous Scraper & Auto-Apply • Next.js App Router • Gemini 2.5 Flash</p>
      </footer>
    </div>
  );
}
