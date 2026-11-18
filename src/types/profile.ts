export interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedIn: string;
  github: string;
  portfolio: string;
  citizenship: string;
  workAuthorization: string;
  noticePeriod: string;
  expectedSalary: string;
  currentCompany: string;
  currentTitle: string;
}

export interface WorkExperience {
  id: string;
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  highlights: string[];
  technologies: string[];
}

export interface Project {
  id: string;
  name: string;
  subtitle: string;
  liveUrl?: string;
  githubUrl?: string;
  technologies: string[];
  description: string;
  highlights: string[];
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  grade?: string;
}

export interface SkillCategory {
  category: string;
  skills: string[];
}

export interface ScreeningAnswers {
  yearsOfExperience: number;
  legallyAuthorizedInUS: boolean;
  requiresSponsorship: boolean;
  willingToRelocate: boolean;
  remotePreference: 'Remote' | 'Hybrid' | 'On-site';
  availableStartDate: string;
  customAnswers: Record<string, string>;
}

export interface MasterProfile {
  personalInfo: PersonalInfo;
  headline: string;
  summary: string;
  skillCategories: SkillCategory[];
  experience: WorkExperience[];
  projects: Project[];
  education: Education[];
  screeningAnswers: ScreeningAnswers;
}

export interface TailoredResumeData {
  targetJobTitle: string;
  targetCompany: string;
  tailoredHeadline: string;
  tailoredSummary: string;
  matchedKeywords: string[];
  tailoredHighlights: Record<string, string[]>; // experience/project id -> tailored bullet points
  matchScore: number;
  rationale: string;
}
