import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import About from './components/About';
import Experience from './components/Experience';
import Research from './components/Research';
import Gallery from './components/Gallery';
import Contact from './components/Contact';
import Footer from './components/Footer';

function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-academic-200 selection:text-academic-900">
      <Navbar />
      <main>
        <Hero />
        <About />
        <Experience />
        <Research />
        <Gallery />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}

export default App;