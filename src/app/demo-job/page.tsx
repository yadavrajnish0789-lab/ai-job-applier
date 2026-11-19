'use client';

import React, { useState } from 'react';
import { Briefcase, Building, MapPin, Globe, CheckCircle2, Upload, Send } from 'lucide-react';

export default function DemoJobPage() {
  const [submitted, setSubmitted] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 sm:p-8">
      <div className="max-w-4xl mx-auto bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl">
        {/* Header */}
        <div className="border-b border-slate-800 pb-6 mb-8">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Building className="w-4 h-4" />
            <span>CloudTech Global Careers Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Senior Full-Stack Developer & Technical SEO Specialist
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-3">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              Worldwide (100% Remote)
            </span>
            <span className="flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-slate-500" />
              Full-time Engineering
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              Competitive Compensation
            </span>
          </div>
        </div>

        {/* Job Description Content */}
        <section className="space-y-6 text-sm text-slate-300 leading-relaxed border-b border-slate-800 pb-8 mb-8" id="job-description">
          <div>
            <h2 className="text-base font-semibold text-white mb-2">About The Role</h2>
            <p>
              We are seeking a high-performing <strong>Senior Full-Stack Developer & Technical SEO Specialist</strong> to architect our core digital platforms, drive organic growth via technical SEO, and scale internal applications. You will bridge frontend user experience with scalable backend microservices and maintain strict Core Web Vitals health across millions of visitors.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-white mb-2">Core Technical Stack & Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>Architect modern web applications using <strong>React, Next.js (App Router), TypeScript, and Tailwind CSS</strong>.</li>
              <li>Engineer secure, high-concurrency backend services using <strong>PHP 8+, Laravel, WordPress REST API, and MySQL</strong>.</li>
              <li>Lead technical SEO initiatives: eliminating crawl budget waste, optimizing Core Web Vitals (LCP, INP, CLS) to 95+ Lighthouse scores, and structuring JSON-LD Schema.org hierarchies.</li>
              <li>Design robust database architectures, write optimized MySQL queries, and build internal tools like Learning Management Systems (LMS) and analytics dashboards.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-white mb-2">Required Qualifications</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>2+ years of verified software engineering experience in React, Next.js, and modern TypeScript.</li>
              <li>Demonstrated experience in PHP, Laravel, WordPress plugin/theme architecture, and relational MySQL schemas.</li>
              <li>Proven track record in Technical SEO, Google Search Console audits, and Core Web Vitals acceleration.</li>
              <li>Strong independent problem-solving skills and async communication in distributed teams.</li>
            </ul>
          </div>
        </section>

        {/* Application Form */}
        <section id="apply-section">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-indigo-400" />
              Submit Your Application
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Please complete all required fields below. ATS automated parsing is enabled.
            </p>
          </div>

          {submitted ? (
            <div className="p-8 bg-emerald-950/40 border border-emerald-500/50 rounded-xl text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">Application Received Successfully!</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                Thank you for applying. Your profile and tailored ATS resume have been recorded in our hiring pipeline.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} id="application_form" className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="block text-xs font-semibold text-slate-300 mb-1">
                    First Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    required
                    placeholder="e.g. Rajnish"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="last_name" className="block text-xs font-semibold text-slate-300 mb-1">
                    Last Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    required
                    placeholder="e.g. Yadav"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    placeholder="e.g. admin@publicdomainmovie.org"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-xs font-semibold text-slate-300 mb-1">
                    Phone Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    required
                    placeholder="+91 ..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Resume File Upload */}
              <div>
                <label htmlFor="resume_file" className="block text-xs font-semibold text-slate-300 mb-1">
                  Resume / CV (PDF format) <span className="text-rose-400">*</span>
                </label>
                <div className="relative border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-4 text-center transition-colors bg-slate-900/50">
                  <input
                    type="file"
                    id="resume_file"
                    name="resume_file"
                    accept=".pdf,.doc,.docx"
                    required
                    onChange={(e) => setFileName(e.target.files?.[0]?.name || '')}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                    <Upload className="w-5 h-5 text-indigo-400" />
                    <span className="text-xs font-medium text-slate-200">
                      {fileName ? `Attached: ${fileName}` : 'Click or drag & drop ATS Resume PDF here'}
                    </span>
                    <span className="text-[11px] text-slate-500">PDF up to 10MB</span>
                  </div>
                </div>
              </div>

              {/* Online Profiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="linkedin_url" className="block text-xs font-semibold text-slate-300 mb-1">
                    LinkedIn Profile URL
                  </label>
                  <input
                    type="url"
                    id="linkedin_url"
                    name="linkedin_url"
                    placeholder="https://linkedin.com/in/..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="portfolio_url" className="block text-xs font-semibold text-slate-300 mb-1">
                    GitHub / Website / Portfolio
                  </label>
                  <input
                    type="url"
                    id="portfolio_url"
                    name="portfolio_url"
                    placeholder="https://github.com/..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Location & Compensation */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="candidate_location" className="block text-xs font-semibold text-slate-300 mb-1">
                    Current Location / City
                  </label>
                  <input
                    type="text"
                    id="candidate_location"
                    name="candidate_location"
                    placeholder="e.g. India"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="expected_salary" className="block text-xs font-semibold text-slate-300 mb-1">
                    Expected Salary / Rate
                  </label>
                  <input
                    type="text"
                    id="expected_salary"
                    name="expected_salary"
                    placeholder="e.g. Competitive"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="notice_period" className="block text-xs font-semibold text-slate-300 mb-1">
                    Availability / Notice Period
                  </label>
                  <input
                    type="text"
                    id="notice_period"
                    name="notice_period"
                    placeholder="e.g. 2 Weeks"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  id="submit_app_button"
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-600/30 cursor-pointer transition-all flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Application</span>
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
