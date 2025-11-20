import React from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import { PERSONAL_DETAILS } from '../constants';

const Contact: React.FC = () => {
  return (
    <section id="contact" className="py-20 bg-academic-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          
          {/* Contact Info */}
          <div>
            <h2 className="text-sm font-bold text-academic-300 uppercase tracking-widest mb-2">Get In Touch</h2>
            <h3 className="text-3xl md:text-4xl font-serif font-bold mb-6">Let's Collaborate</h3>
            <p className="text-academic-100 text-lg mb-10 leading-relaxed">
              I am always open to discussing new research opportunities, collaborations in computational chemistry, or Python development projects.
            </p>

            <div className="space-y-6">
              <div className="flex items-start">
                <div className="bg-academic-800 p-3 rounded-lg mr-4">
                  <Mail className="w-6 h-6 text-academic-300" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-academic-200 uppercase tracking-wide">Email</h4>
                  <a href={`mailto:${PERSONAL_DETAILS.email}`} className="text-lg font-medium hover:text-academic-300 transition-colors">
                    {PERSONAL_DETAILS.email}
                  </a>
                </div>
              </div>

               <div className="flex items-start">
                <div className="bg-academic-800 p-3 rounded-lg mr-4">
                  <MapPin className="w-6 h-6 text-academic-300" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-academic-200 uppercase tracking-wide">Location</h4>
                  <p className="text-lg font-medium">
                    {PERSONAL_DETAILS.location}
                  </p>
                </div>
              </div>

               <div className="flex items-start">
                <div className="bg-academic-800 p-3 rounded-lg mr-4">
                  <Phone className="w-6 h-6 text-academic-300" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-academic-200 uppercase tracking-wide">Phone</h4>
                  <p className="text-lg font-medium">
                    (+92) 3430788403
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form (Visual Only) */}
          <div className="bg-white rounded-2xl p-8 text-slate-800 shadow-2xl">
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-2">Name</label>
                  <input 
                    type="text" 
                    id="name" 
                    className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 focus:border-academic-500 focus:ring-2 focus:ring-academic-200 outline-none transition-all"
                    placeholder="Dr. Jane Doe"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                  <input 
                    type="email" 
                    id="email" 
                    className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 focus:border-academic-500 focus:ring-2 focus:ring-academic-200 outline-none transition-all"
                    placeholder="jane@university.edu"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="subject" className="block text-sm font-semibold text-slate-700 mb-2">Subject</label>
                <select 
                  id="subject" 
                  className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 focus:border-academic-500 focus:ring-2 focus:ring-academic-200 outline-none transition-all"
                >
                  <option>Research Collaboration</option>
                  <option>Speaking Inquiry</option>
                  <option>General Question</option>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-semibold text-slate-700 mb-2">Message</label>
                <textarea 
                  id="message" 
                  rows={4} 
                  className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 focus:border-academic-500 focus:ring-2 focus:ring-academic-200 outline-none transition-all"
                  placeholder="Write your message here..."
                ></textarea>
              </div>

              <button 
                type="submit" 
                className="w-full bg-academic-600 text-white font-bold py-4 rounded-lg hover:bg-academic-700 transition-colors shadow-lg"
              >
                Send Message
              </button>
            </form>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Contact;