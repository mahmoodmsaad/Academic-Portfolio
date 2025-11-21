import React, { useState, useEffect } from 'react';
import { Download, Linkedin, Github, Mail } from 'lucide-react';
import { client, urlFor } from '../sanity/client';
import { PERSONAL_DETAILS, SOCIAL_LINKS } from '../constants';

interface PersonalInfo {
  name: string;
  title: string;
  tagline: string;
  location: string;
  email: string;
  about: string;
  profilePhoto: any;
  cvFile?: any;
}

interface SocialLink {
  platform: string;
  url: string;
  icon: string;
}

const Hero: React.FC = () => {
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [info, links] = await Promise.all([
          client.fetch(`*[_type == "personalInfo"][0]`),
          client.fetch(`*[_type == "socialLink"] | order(_createdAt asc)`)
        ]);

        // Use Sanity data if available, otherwise use constants
        if (info) setPersonalInfo(info);
        if (links && links.length > 0) setSocialLinks(links);
      } catch (error) {
        console.error('Error fetching data:', error);
        // On error, use fallback - no need to set state as we already have fallback logic
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Use Sanity data if available, otherwise fallback to constants
  const displayInfo = personalInfo || PERSONAL_DETAILS;
  const displayLinks = socialLinks.length > 0 ? socialLinks : SOCIAL_LINKS;

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'linkedin': return <Linkedin className="w-6 h-6" />;
      case 'github': return <Github className="w-6 h-6" />;
      case 'email': return <Mail className="w-6 h-6" />;
      default: return null;
    }
  };

  const handleDownloadCV = () => {
    if (personalInfo?.cvFile?.asset?.url) {
      window.open(personalInfo.cvFile.asset.url, '_blank');
    } else {
      alert('CV not available. Please upload in admin panel.');
    }
  };

  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-academic-50 pt-16 overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-academic-200/30 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-primary-200/30 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-[40%] left-[20%] w-72 h-72 bg-purple-200/20 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center relative z-10">

        {/* Text Content */}
        <div className="flex-1 text-center md:text-left order-2 md:order-1 mt-12 md:mt-0">
          <div className="inline-block px-4 py-1.5 mb-6 text-xs font-bold tracking-widest text-academic-700 uppercase bg-academic-100/80 backdrop-blur-sm rounded-full animate-fade-in-up">
            Available for Collaboration
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold font-serif text-slate-900 mb-6 leading-tight animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            {displayInfo.name}
          </h1>
          <h2 className="text-2xl md:text-3xl text-academic-600 font-medium mb-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            {displayInfo.title}
          </h2>
          <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-lg mx-auto md:mx-0 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            {displayInfo.tagline}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <a
              href="#contact"
              className="px-8 py-4 bg-academic-600 text-white rounded-full shadow-lg shadow-academic-600/30 hover:bg-academic-700 hover:shadow-academic-600/40 hover:-translate-y-1 transition-all duration-300 font-semibold text-center"
            >
              Get in Touch
            </a>
            <button
              className="px-8 py-4 border border-slate-200 bg-white/80 backdrop-blur-sm text-slate-700 rounded-full hover:border-academic-400 hover:text-academic-600 hover:-translate-y-1 transition-all duration-300 font-semibold flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
              onClick={handleDownloadCV}
            >
              <Download size={20} />
              Download CV
            </button>
          </div>

          <div className="mt-12 flex gap-6 justify-center md:justify-start animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
            {displayLinks.map((link) => (
              <a
                key={link.platform}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-academic-600 transition-colors duration-300 transform hover:scale-110"
                aria-label={link.platform}
              >
                {getIcon(link.icon)}
              </a>
            ))}
          </div>
        </div>

        {/* Image Placeholder */}
        <div className="flex-1 flex justify-center order-1 md:order-2 relative animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="w-72 h-72 md:w-96 md:h-96 relative">
            {/* Decorative rings */}
            <div className="absolute inset-0 rounded-full border-2 border-academic-100 scale-110 animate-pulse"></div>
            <div className="absolute inset-0 rounded-full border border-academic-200 scale-125 opacity-50"></div>

            <div className="relative w-full h-full rounded-full overflow-hidden border-4 border-white shadow-2xl shadow-academic-200/50">
              {personalInfo?.profilePhoto ? (
                <img
                  src={urlFor(personalInfo.profilePhoto).width(600).height(600).url()}
                  alt={`${displayInfo.name} - ${displayInfo.title}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src="/images/profile.jpg"
                  alt={`${displayInfo.name} - ${displayInfo.title}`}
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            {/* Floating badge */}
            <div className="absolute bottom-6 right-0 bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-white/50 animate-bounce" style={{ animationDuration: '3s' }}>
              <span className="text-3xl">🎓</span>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Current Role</p>
                <p className="text-sm font-bold text-slate-900">PhD Researcher</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;