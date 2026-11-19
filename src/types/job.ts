export type JobCategory = 'all' | 'tech_remote' | 'top_companies' | 'sarkari_govt';

export type ApplicationStatus =
  | 'discovered'
  | 'queued'
  | 'tailoring'
  | 'filling'
  | 'review_ready'
  | 'submitted'
  | 'failed';

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  category: JobCategory;
  source: 'RemoteOK' | 'Arbeitnow' | 'Greenhouse' | 'Lever' | 'Sarkari_Govt_IT' | 'Direct';
  url: string;
  applyUrl: string;
  description: string;
  tags: string[];
  salary?: string;
  postedAt: string;
  matchScore?: number;
  logoUrl?: string;
}

export interface JobQueueItem {
  job: JobListing;
  status: ApplicationStatus;
  tailoredHeadline?: string;
  tailoredSummary?: string;
  matchedKeywords?: string[];
  matchScore?: number;
  screenshotBase64?: string;
  pdfBase64?: string;
  fieldsFilledCount?: number;
  error?: string;
  timestamp: string;
}

export interface BatchRunProgress {
  total: number;
  completed: number;
  successful: number;
  failed: number;
  currentJobTitle?: string;
  currentCompany?: string;
  stage?: string;
}
