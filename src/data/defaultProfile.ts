import { MasterProfile } from '@/types/profile';

export const defaultProfile: MasterProfile = {
  personalInfo: {
    fullName: 'Rajnish Yadav',
    email: 'admin@publicdomainmovie.org',
    phone: '+91 98765 43210',
    location: 'India (Available for Worldwide Remote Roles)',
    linkedIn: 'https://linkedin.com/in/rajnish-yadav',
    github: 'https://github.com/rajnish-yadav',
    portfolio: 'https://publicdomainmovie.org',
    citizenship: 'Indian',
    workAuthorization: 'Authorized for Remote Global Employment / India',
    noticePeriod: 'Immediately Available / 2 Weeks',
    expectedSalary: 'Competitive / Open to Discussion ($35,000 - $65,000 USD / year for Remote)',
    currentCompany: 'Public Domain Movie & Independent Tech Consulting',
    currentTitle: 'Full-Stack Developer & Technical SEO Specialist',
  },
  headline: 'Full-Stack Developer & Technical SEO Specialist | React, Next.js, PHP, Laravel, WordPress, MySQL',
  summary:
    'Dedicated Full-Stack Developer and Technical SEO Specialist with 2+ years of hands-on experience architecting high-performance web applications and driving measurable organic search growth. Proficient across the entire modern web stack—leveraging React, Next.js, PHP, Laravel, WordPress, and MySQL. Proven track record eliminating crawl budget waste, optimizing Core Web Vitals (LCP, INP, CLS) for top Lighthouse scores, implementing programmatic Schema.org structures, and shipping robust web platforms such as OwnLMS and PublicDomainMovie.',
  skillCategories: [
    {
      category: 'Frontend Engineering',
      skills: [
        'React',
        'Next.js (App Router, SSR, SSG)',
        'TypeScript',
        'JavaScript (ES6+)',
        'Tailwind CSS',
        'HTML5 / Semantic Web',
        'CSS3 / Responsive UI',
        'REST API Integration',
      ],
    },
    {
      category: 'Backend & Databases',
      skills: [
        'PHP 8+',
        'Laravel',
        'WordPress (Custom Themes, Plugins & REST API)',
        'MySQL (Database Design, Query Optimization, Indexing)',
        'Node.js',
        'Express',
        'RESTful APIs',
      ],
    },
    {
      category: 'Technical SEO & Search Analytics',
      skills: [
        'Technical SEO Audits',
        'Core Web Vitals Optimization (LCP, INP, CLS)',
        'Google Search Console (GSC)',
        'Google Analytics 4 (GA4)',
        'Structured Data / JSON-LD / Schema.org',
        'Screaming Frog SEO Spider',
        'Crawl Budget & Indexation Optimization',
        'XML Sitemaps & Robots.txt Architecture',
        'Programmatic SEO',
      ],
    },
    {
      category: 'DevOps & Tools',
      skills: [
        'Git & GitHub',
        'Vercel Deployment',
        'Linux / Apache / Nginx',
        'cPanel / Web Hosting Management',
        'Playwright / Cloud Browser Automation',
      ],
    },
  ],
  experience: [
    {
      id: 'exp-1',
      company: 'Public Domain Movie & Digital Solutions',
      role: 'Lead Full-Stack Web Developer & SEO Strategist',
      location: 'Remote',
      startDate: '2023-01',
      endDate: 'Present',
      current: true,
      technologies: ['Next.js', 'React', 'PHP', 'WordPress', 'MySQL', 'Tailwind CSS', 'Google Search Console', 'Technical SEO'],
      highlights: [
        'Architected and scaled the Public Domain Movie platform, handling high-volume daily streaming traffic with sub-100ms response times.',
        'Executed end-to-end Technical SEO optimization, elevating Google Lighthouse performance to 98+ across desktop and mobile, resulting in 200%+ organic traffic growth.',
        'Engineered custom WordPress and Laravel backend services, designing normalized MySQL tables and caching layers for fast asset delivery.',
        'Implemented advanced Schema.org VideoObject and BreadcrumbList structured data, securing rich snippets on Google Search engine results pages (SERPs).',
      ],
    },
    {
      id: 'exp-2',
      company: 'Tech Media & Web Solutions',
      role: 'Full-Stack Developer & SEO Specialist',
      location: 'India',
      startDate: '2022-06',
      endDate: '2022-12',
      current: false,
      technologies: ['PHP', 'Laravel', 'WordPress', 'MySQL', 'React', 'Google Analytics 4'],
      highlights: [
        'Developed dynamic client web applications utilizing PHP, Laravel, and React components with seamless MySQL relational integrations.',
        'Conducted detailed site audits using Screaming Frog and Google Search Console to fix 404 chains, canonical issues, duplicate metadata, and crawl loops.',
        'Built custom WordPress plugins to automate post syndication, on-page SEO meta tags generation, and XML sitemap updates.',
      ],
    },
  ],
  projects: [
    {
      id: 'proj-1',
      name: 'OwnLMS',
      subtitle: 'Modern Cloud-Native Learning Management System',
      liveUrl: 'https://ownlms-demo.vercel.app',
      githubUrl: 'https://github.com/rajnish-yadav/ownlms',
      technologies: ['Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'Laravel', 'MySQL'],
      description:
        'A comprehensive, cloud-native LMS platform engineered for online educators and academies to publish video lectures, manage course curricula, conduct student quizzes, and automate subscriptions.',
      highlights: [
        'Built course builder interface with dynamic syllabus sorting, lesson progression tracking, and video delivery pipeline.',
        'Implemented programmatic SEO architecture with automatic course sitemaps and Course Schema markup to drive organic search discoverability.',
        'Designed scalable MySQL relational database schema with foreign key constraints and index optimization for rapid lecture querying.',
      ],
    },
    {
      id: 'proj-2',
      name: 'PublicDomainMovie Platform',
      subtitle: 'High-Traffic Cultural Film Archive & Streaming Hub',
      liveUrl: 'https://publicdomainmovie.org',
      githubUrl: 'https://github.com/rajnish-yadav/publicdomainmovie',
      technologies: ['Next.js', 'React', 'PHP', 'WordPress REST API', 'MySQL', 'Technical SEO'],
      description:
        'An expansive digital media library featuring curated classic public domain cinema with automated metadata scraping, streaming optimization, and search rankings.',
      highlights: [
        'Engineered fast-loading catalog pages with responsive video embeds and instant client-side filtering.',
        'Boosted search visibility and indexation rate through automated semantic schema integration and zero-layout-shift Core Web Vitals optimization.',
      ],
    },
  ],
  education: [
    {
      id: 'edu-1',
      institution: 'University Information Technology Program',
      degree: 'Bachelor of Computer Applications (BCA)',
      fieldOfStudy: 'Computer Science & Software Development',
      startDate: '2019',
      endDate: '2022',
      grade: 'First Class with Distinction',
    },
  ],
  screeningAnswers: {
    yearsOfExperience: 2,
    legallyAuthorizedInUS: false,
    requiresSponsorship: false,
    willingToRelocate: false,
    remotePreference: 'Remote',
    availableStartDate: 'Immediately available / 2 weeks',
    customAnswers: {
      'Why are you a good fit for this role?':
        'I bring a proven combination of Full-Stack Web Development (Next.js/React & Laravel/PHP/MySQL) and specialized Technical SEO skills that ensure applications are not only robustly engineered but also lightning-fast, Core Web Vitals compliant, and built for top search engine visibility.',
      'What is your experience with modern JavaScript, React, and Next.js?':
        '2+ years building responsive production interfaces with React, Next.js (App Router, Server Components, SSR/SSG), TypeScript, and Tailwind CSS.',
      'Describe your backend, PHP, Laravel, and MySQL experience':
        'Extensive experience crafting clean REST APIs with PHP and Laravel, building custom WordPress solutions, designing normalized MySQL databases, and optimizing database queries for high concurrency.',
      'What is your remote work experience?':
        'Experienced working remotely across distributed teams, utilizing Git/GitHub, clear async communication, and disciplined milestone delivery.',
    },
  },
};
