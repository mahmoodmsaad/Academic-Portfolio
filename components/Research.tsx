import React, { useState, useEffect } from 'react';
import { FileText, ExternalLink, Code, BookOpen } from 'lucide-react';
import { client } from '../sanity/client';
import { PUBLICATIONS } from '../constants';

interface Publication {
  _id?: string;
  id?: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  status?: string;
  link?: string;
  order?: number;
}

const Research: React.FC = () => {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPublications = async () => {
      try {
        const query = `*[_type == "publication"] | order(order asc, year desc)`;
        const pubs = await client.fetch(query);
        if (pubs && pubs.length > 0) {
          setPublications(pubs);
        }
      } catch (error) {
        console.error('Error fetching publications:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPublications();
  }, []);

  // Use Sanity data if available, otherwise fallback to constants
  const displayPublications = publications.length > 0 ? publications : PUBLICATIONS;

  if (loading) {
    return (
      <section id="research" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-slate-500">Loading...</p>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section id="research" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-sm font-bold text-academic-600 uppercase tracking-widest mb-2">Research & Development</h2>
          <h3 className="text-3xl md:text-4xl font-serif font-bold text-slate-900">Publications</h3>
          <p className="mt-4 max-w-2xl mx-auto text-slate-600">
            A curated list of my scientific contributions and research work.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          
          {/* Publications List */}
          <div>
             <div className="flex items-center mb-6 pb-4 border-b border-slate-100">
                <BookOpen className="w-6 h-6 text-academic-600 mr-3" />
                <h4 className="text-2xl font-bold text-slate-800">Selected Publications</h4>
            </div>
            <div className="space-y-6">
              {displayPublications.map((pub) => (
                <div key={pub._id || pub.id} className="group p-6 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-shadow hover:border-academic-200">
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
                        <span className={`font-medium ${pub.status === 'Submitted' || pub.status === 'Under Review' ? 'text-amber-600' : 'text-green-600'}`}>
                          {pub.journal || pub.status}
                        </span>
                      </div>
                    </div>
                    {pub.link && (
                        <a href={pub.link} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-academic-600 transition-colors">
                            <ExternalLink size={20} />
                        </a>
                    )}
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

export default Research;