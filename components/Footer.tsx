import React from 'react';
import { SOCIAL_LINKS } from '../constants';

const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-50 py-8 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} M Saad Mahmood. All rights reserved.
        </div>
        
        <div className="flex gap-6">
           {SOCIAL_LINKS.map((link) => (
              <a 
                key={link.platform}
                href={link.url}
                target="_blank" 
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-academic-600 text-sm font-medium transition-colors"
              >
                {link.platform}
              </a>
            ))}
        </div>
      </div>
    </footer>
  );
};

export default Footer;