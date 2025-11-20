import React from 'react';
import { FileText, ExternalLink, Code, BookOpen } from 'lucide-react';
import { PUBLICATIONS, PROJECTS } from '../constants';

const Research: React.FC = () => {
  return (
    <section id="research" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-sm font-bold text-academic-600 uppercase tracking-widest mb-2">Research & Development</h2>
          <h3 className="text-3xl md:text-4xl font-serif font-bold text-slate-900">Publications & Tools</h3>
          <p className="mt-4 max-w-2xl mx-auto text-slate-600">
            A curated list of my scientific contributions and software tools developed for chemical analysis.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Publications List */}
          <div className="lg:col-span-7">
             <div className="flex items-center mb-6 pb-4 border-b border-slate-100">
                <BookOpen className="w-6 h-6 text-academic-600 mr-3" />
                <h4 className="text-2xl font-bold text-slate-800">Selected Publications</h4>
            </div>
            <div className="space-y-6">
              {PUBLICATIONS.map((pub) => (
                <div key={pub.id} className="group p-6 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-shadow hover:border-academic-200">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className="inline-block px-2 py-1 text-xs font-bold text-academic-700 bg-academic-50 rounded mb-2">
                        {pub.year}
                      </span>
                      <h5 className="text-lg font-bold text-slate-900 leading-tight mb-2 group-hover:text-academic-700 transition-colors">
                        {pub.title}
                      </h5>
                      <p className="text-sm text-slate-600 mb-1 italic">{pub.authors}</p>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span className={`font-medium ${pub.status === 'Submitted' ? 'text-amber-600' : 'text-green-600'}`}>
                          {pub.journal || pub.status}
                        </span>
                      </div>
                    </div>
                    {pub.journal !== 'Under Review' && (
                        <a href="#" className="text-slate-400 hover:text-academic-600 transition-colors">
                            <ExternalLink size={20} />
                        </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Projects List */}
          <div id="projects" className="lg:col-span-5">
             <div className="flex items-center mb-6 pb-4 border-b border-slate-100">
                <Code className="w-6 h-6 text-academic-600 mr-3" />
                <h4 className="text-2xl font-bold text-slate-800">Technical Projects</h4>
            </div>
            <div className="space-y-6">
              {PROJECTS.map((proj) => (
                <div key={proj.id} className="bg-slate-50 p-6 rounded-xl border border-slate-200 hover:border-academic-300 transition-colors">
                  <h5 className="text-lg font-bold text-slate-900 mb-2">{proj.title}</h5>
                  <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                    {proj.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {proj.technologies?.map(tech => (
                      <span key={tech} className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                        {tech}
                      </span>
                    ))}
                  </div>

                  {proj.link && (
                    <a 
                      href={proj.link} 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm font-semibold text-academic-600 hover:text-academic-800"
                    >
                      View on GitHub <ExternalLink size={14} className="ml-1" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Research;