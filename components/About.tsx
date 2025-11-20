import React from 'react';
import { PERSONAL_DETAILS, SKILLS } from '../constants';

const About: React.FC = () => {
  return (
    <section id="about" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          
          {/* Biography */}
          <div>
            <h2 className="text-sm font-bold text-academic-600 uppercase tracking-widest mb-2">About Me</h2>
            <h3 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-6">
              Bridging Theory & Application
            </h3>
            <div className="prose prose-lg text-slate-600 leading-relaxed">
              <p className="mb-4">
                {PERSONAL_DETAILS.about}
              </p>
              <p>
                My academic journey has taken me from Pakistan to Spain and Italy, allowing me to collaborate with diverse international teams. Whether developing Python applications to automate chemical index calculations or modeling complex 2D material surfaces, I am driven by the challenge of solving real-world problems through computational precision.
              </p>
            </div>
          </div>

          {/* Skills Matrix */}
          <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100">
            <h3 className="text-2xl font-serif font-bold text-slate-900 mb-6">Technical Expertise</h3>
            <div className="space-y-6">
              {SKILLS.map((skillGroup) => (
                <div key={skillGroup.category}>
                  <h4 className="text-sm font-bold text-slate-400 uppercase mb-3 tracking-wide">
                    {skillGroup.category}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {skillGroup.items.map((item) => (
                      <span 
                        key={item} 
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded text-sm font-medium text-slate-700 shadow-sm"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default About;