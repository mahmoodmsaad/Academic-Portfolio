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

  if (loading) {
    return (
      <section id="home" className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-academic-50 pt-16">
        <div className="text-center">
          <p className="text-slate-500">Loading...</p>
        </div>
      </section>
    );
  }

  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-academic-50 pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center">
        
        {/* Text Content */}
        <div className="flex-1 text-center md:text-left order-2 md:order-1 mt-10 md:mt-0">
          <div className="inline-block px-3 py-1 mb-4 text-xs font-semibold tracking-wider text-academic-600 uppercase bg-academic-100 rounded-full">
            Available for Collaboration
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold font-serif text-slate-900 mb-4 leading-tight">
            {displayInfo.name}
          </h1>
          <h2 className="text-xl md:text-2xl text-academic-600 font-medium mb-6">
            {displayInfo.title}
          </h2>
          <p className="text-lg text-slate-600 mb-8 max-w-lg mx-auto md:mx-0 leading-relaxed">
            {displayInfo.tagline}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
            <a 
              href="#contact" 
              className="px-8 py-3 bg-academic-600 text-white rounded-lg shadow-lg hover:bg-academic-700 transition-all duration-300 font-medium text-center"
            >
              Get in Touch
            </a>
            <button 
              className="px-8 py-3 border border-slate-300 bg-white text-slate-700 rounded-lg hover:border-academic-400 hover:text-academic-600 transition-all duration-300 font-medium flex items-center justify-center gap-2 shadow-sm"
              onClick={handleDownloadCV}
            >
              <Download size={18} />
              Download CV
            </button>
          </div>

          <div className="mt-10 flex gap-6 justify-center md:justify-start">
            {displayLinks.map((link) => (
              <a 
                key={link.platform}
                href={link.url}
                target="_blank" 
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-academic-600 transition-colors duration-300 transform hover:-translate-y-1"
                aria-label={link.platform}
              >
                {getIcon(link.icon)}
              </a>
            ))}
          </div>
        </div>

        {/* Image Placeholder */}
        <div className="flex-1 flex justify-center order-1 md:order-2 relative">
          <div className="w-64 h-64 md:w-80 md:h-80 relative">
             {/* Decorative blobs */}
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-full h-full rounded-full bg-academic-200 opacity-50 blur-3xl animate-pulse"></div>
            <div className="relative w-full h-full rounded-full overflow-hidden border-4 border-white shadow-2xl">
              {personalInfo?.profilePhoto ? (
                <img 
                  src={urlFor(personalInfo.profilePhoto).width(400).height(400).url()} 
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
            <div className="absolute bottom-4 right-4 bg-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 border-l-4 border-academic-500">
              <span className="text-2xl">🎓</span>
              <div>
                <p className="text-xs text-slate-500">Current Role</p>
                <p className="text-sm font-bold text-slate-800">PhD Researcher</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;