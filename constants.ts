import { TimelineItem, Publication, Project, SkillCategory, SocialLink } from './types';

export const PERSONAL_DETAILS = {
  name: "M Saad Mahmood",
  title: "PhD Researcher & Materials Engineer",
  tagline: "Advancing Sustainable Energy through Computational Chemistry & Machine Learning",
  location: "San Sebastián, Spain",
  email: "mahmoodmsaad9@gmail.com",
  about: `As a dedicated scientific researcher, I specialize in applying computational chemistry to advance the fields of sensing and photovoltaic applications—technologies essential for sustainable energy and environmental solutions. My core competencies bridge the gap between theoretical chemistry and practical application, utilizing machine learning and rigorous data analysis to design, model, and optimize novel materials. Currently, I am focused on ab initio simulations of curved 2D materials, validating experimental findings to deepen our understanding of complex molecular systems like phosphorene.`,
};

export const SOCIAL_LINKS: SocialLink[] = [
  {
    platform: "LinkedIn",
    url: "https://www.linkedin.com/in/m-saad-mahmood-2288b2210",
    icon: "linkedin"
  },
  {
    platform: "GitHub",
    url: "https://github.com/mahmoodmsaad",
    icon: "github"
  },
  {
    platform: "Email",
    url: "mailto:mahmoodmsaad9@gmail.com",
    icon: "email"
  }
];

export const EXPERIENCE: TimelineItem[] = [
  {
    id: "exp-1",
    title: "Materials Engineer",
    organization: "REDERIK MICHAEL SCHILLER",
    location: "San Sebastián, Spain",
    date: "Jan 2025 – Current",
    type: "experience",
    description: [
      "Computational–Experimental Collaboration on Curved 2D Materials.",
      "Working within an experimental materials chemistry group to understand and model curved 2D materials.",
      "Learning advanced surface characterization techniques such as ARPES, X-ray photoelectron spectroscopy (XPS), and STEM.",
      "Performing ab initio simulations to validate experimental findings and bridge computational and experimental perspectives in the study of phosphorene and P/Cu(513) systems."
    ]
  },
  {
    id: "exp-2",
    title: "Python App Developer for Chemical Analysis",
    organization: "Dr. Javed Iqbal (Research Group)",
    location: "Faisalabad, Pakistan",
    date: "May 2022 – Current",
    type: "experience",
    description: [
      "Developed the 'Reactivity Index Calculator' application for streamlined chemical analysis.",
      "Designed and implemented the 'NBO Orbital Processing' application for advanced chemical calculations.",
      "Currently designing a predictive application for aqueous solubility of drug-like molecules using machine learning integrations."
    ]
  },
  {
    id: "exp-3",
    title: "Masters-Level Research in Computational Chemistry",
    organization: "Dr. Javed Iqbal (Research Group)",
    location: "Faisalabad, Pakistan",
    date: "Jan 2022 – Feb 2024",
    type: "experience",
    description: [
      "Utilized computational techniques to model and simulate complex organic molecules.",
      "Analyzed and interpreted computational data to identify trends and correlations in molecular behavior.",
      "Prepared comprehensive research reports, summaries, and presentations to effectively communicate scientific findings."
    ]
  }
];

export const EDUCATION: TimelineItem[] = [
  {
    id: "edu-1",
    title: "Doctor of Philosophy (PhD)",
    organization: "University of Trieste",
    location: "Trieste, Italy",
    date: "Oct 2024 – Current",
    type: "education",
    description: ["Field of study: Physics & Chemistry", "Focus on Natural Sciences, Mathematics and Statistics."]
  },
  {
    id: "edu-2",
    title: "Master of Philosophy in Chemistry",
    organization: "University of Agriculture Faisalabad",
    location: "Faisalabad, Pakistan",
    date: "Sep 2021 – Dec 2023",
    type: "education",
    description: [
      "Thesis: 'Sensing ability of C6N8 to detect NOx: A DFT study'",
      "Final Grade: 3.3 CGPA"
    ]
  },
  {
    id: "edu-3",
    title: "BS Chemistry",
    organization: "Government College University Faisalabad",
    location: "Faisalabad, Pakistan",
    date: "Sep 2016 – Sep 2023",
    type: "education",
    description: ["Final Grade: 3.71 CGPA"]
  }
];

export const PUBLICATIONS: Publication[] = [
  {
    id: "pub-1",
    year: "2023",
    title: "Sensing applications of graphitic carbon nitride (C6N8) for Nitrogen oxides: A DFT study",
    journal: "Published",
    authors: "M. Saad Mahmood, et al."
  },
  {
    id: "pub-2",
    year: "2023",
    title: "A Novel 2-D Phosphorene-Based Drug Delivery System for Anti-HIV Zidovudine Drug to Enhance the Therapeutic Effects: A DFT Study",
    journal: "Published",
    authors: "M. Saad Mahmood, et al."
  },
  {
    id: "pub-3",
    year: "Submitted",
    title: "Rational designing of a methoxy diphenylamine-substituted fluorene-based hole transporting materials for proficient perovskites solar cells",
    journal: "Under Review",
    status: "Submitted"
  }
];

export const SKILLS: SkillCategory[] = [
  {
    category: "Computational Chemistry",
    items: ["DFT (Density Functional Theory)", "Ab Initio Simulations", "Molecular Modeling", "Gaussian", "NBO Analysis"]
  },
  {
    category: "Programming & Data",
    items: ["Python", "NumPy", "Pandas", "Machine Learning", "Data Analysis", "Algorithm Design"]
  },
  {
    category: "Characterization",
    items: ["XPS (X-ray Photoelectron Spectroscopy)", "ARPES", "STEM (Scanning Transmission Electron Microscopy)"]
  },
  {
    category: "Languages",
    items: ["English (Fluent)", "Urdu (Native)"]
  }
];

export const PROJECTS: Project[] = [
  {
    id: "proj-1",
    title: "Reactivity Index Calculator",
    description: "A Python-based desktop application designed to automate the calculation of chemical reactivity indices from output files, significantly reducing manual analysis time.",
    technologies: ["Python", "Tkinter", "Computational Chemistry"],
    link: "https://github.com/mahmoodmsaad"
  },
  {
    id: "proj-2",
    title: "NBO Orbital Processing Tool",
    description: "An advanced processing tool implemented to analyze Natural Bond Orbital (NBO) data, facilitating the visualization and interpretation of orbital interactions in complex molecules.",
    technologies: ["Python", "Data Visualization", "Quantum Chemistry"],
    link: "https://github.com/mahmoodmsaad"
  },
  {
    id: "proj-3",
    title: "Drug Solubility Predictor (Ongoing)",
    description: "Developing a machine learning model to predict the aqueous solubility of drug-like molecules, aiming to assist in pharmaceutical drug discovery pipelines.",
    technologies: ["Python", "Scikit-Learn", "Cheminformatics"],
  }
];