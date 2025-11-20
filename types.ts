export interface TimelineItem {
  id: string;
  title: string;
  organization: string;
  location: string;
  date: string;
  description?: string[];
  type: 'education' | 'experience';
}

export interface Publication {
  id: string;
  year: string;
  title: string;
  journal?: string;
  status?: string;
  authors?: string;
}

export interface Project {
  id: string;
  title: string;
  role?: string;
  description: string;
  technologies?: string[];
  link?: string;
}

export interface SkillCategory {
  category: string;
  items: string[];
}

export interface SocialLink {
  platform: string;
  url: string;
  icon: 'linkedin' | 'github' | 'email' | 'phone';
}