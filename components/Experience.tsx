import React from 'react';
import { Briefcase, GraduationCap, Calendar, MapPin } from 'lucide-react';
import { EXPERIENCE, EDUCATION } from '../constants';

const Experience: React.FC = () => {
  return (
    <section id="experience" className="py-20 bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <h2 className="text-sm font-bold text-academic-600 uppercase tracking-widest mb-2">Resume</h2>
          <h3 className="text-3xl md:text-4xl font-serif font-bold text-slate-900">Academic & Professional Journey</h3>
        </div>

        <div className="space-y-12">
          
          {/* Experience Column */}
          <div>
            <div className="flex items-center mb-8">
              <div className="p-3 bg-academic-100 rounded-full text-academic-600 mr-4">
                <Briefcase size={24} />
              </div>
              <h4 className="text-2xl font-bold text-slate-800">Work Experience</h4>
            </div>
            <div className="border-l-2 border-slate-200 ml-6 space-y-10 pb-4">
              {EXPERIENCE.map((item) => (
                <div key={item.id} className="relative pl-10">
                  <div className="absolute -left-[9px] top-2 w-4 h-4 rounded-full bg-academic-500 border-4 border-white shadow-sm"></div>
                  
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline mb-2">
                    <h5 className="text-xl font-bold text-slate-900">{item.title}</h5>
                    <span className="inline-flex items-center text-sm font-medium text-academic-600 bg-academic-50 px-2 py-1 rounded mt-2 sm:mt-0">
                      <Calendar size={14} className="mr-1.5" /> {item.date}
                    </span>
                  </div>
                  
                  <div className="text-base font-semibold text-slate-700 mb-1">{item.organization}</div>
                  <div className="flex items-center text-sm text-slate-500 mb-4">
                    <MapPin size={14} className="mr-1" /> {item.location}
                  </div>
                  
                  <ul className="list-disc list-outside ml-5 text-slate-600 space-y-1.5">
                    {item.description?.map((desc, idx) => (
                      <li key={idx} className="text-sm sm:text-base">{desc}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Education Column */}
          <div>
             <div className="flex items-center mb-8">
              <div className="p-3 bg-green-100 rounded-full text-green-600 mr-4">
                <GraduationCap size={24} />
              </div>
              <h4 className="text-2xl font-bold text-slate-800">Education</h4>
            </div>
            <div className="border-l-2 border-slate-200 ml-6 space-y-10 pb-4">
              {EDUCATION.map((item) => (
                <div key={item.id} className="relative pl-10">
                  <div className="absolute -left-[9px] top-2 w-4 h-4 rounded-full bg-green-500 border-4 border-white shadow-sm"></div>
                  
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline mb-2">
                    <h5 className="text-xl font-bold text-slate-900">{item.title}</h5>
                    <span className="inline-flex items-center text-sm font-medium text-green-700 bg-green-50 px-2 py-1 rounded mt-2 sm:mt-0">
                      <Calendar size={14} className="mr-1.5" /> {item.date}
                    </span>
                  </div>
                  
                  <div className="text-base font-semibold text-slate-700 mb-1">{item.organization}</div>
                  <div className="flex items-center text-sm text-slate-500 mb-4">
                    <MapPin size={14} className="mr-1" /> {item.location}
                  </div>
                  
                  <ul className="list-disc list-outside ml-5 text-slate-600 space-y-1.5">
                    {item.description?.map((desc, idx) => (
                      <li key={idx} className="text-sm sm:text-base">{desc}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Experience;