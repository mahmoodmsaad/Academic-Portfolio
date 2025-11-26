import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { client, urlFor } from '../sanity/client';

interface GalleryItem {
  _id: string;
  image: any;
  title: string;
  description: string;
  date: string;
  category: string;
  order?: number;
}

const Gallery: React.FC = () => {
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [loading, setLoading] = useState(true);

  // Fetch gallery items from Sanity
  useEffect(() => {
    const fetchGalleryItems = async () => {
      try {
        const query = `*[_type == "galleryItem"] | order(order asc, _createdAt desc)`;
        const items = await client.fetch(query);
        setGalleryItems(items || []);
      } catch (error) {
        console.error('Error fetching gallery:', error);
        // On error, show empty state
        setGalleryItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchGalleryItems();
  }, []);

  const categories = ["All", ...Array.from(new Set(galleryItems.map(item => item.category)))];

  const filteredItems = selectedCategory === "All"
    ? galleryItems
    : galleryItems.filter(item => item.category === selectedCategory);

  const openLightbox = (item: GalleryItem) => {
    setSelectedImage(item);
  };

  const closeLightbox = () => {
    setSelectedImage(null);
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (!selectedImage) return;
    const currentIndex = filteredItems.findIndex(item => item._id === selectedImage._id);
    let newIndex;

    if (direction === 'next') {
      newIndex = (currentIndex + 1) % filteredItems.length;
    } else {
      newIndex = (currentIndex - 1 + filteredItems.length) % filteredItems.length;
    }

    setSelectedImage(filteredItems[newIndex]);
  };

  if (loading) {
    return (
      <section id="gallery" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="h-10 w-64 bg-slate-200 rounded-lg mx-auto mb-4 animate-pulse"></div>
            <div className="h-6 w-96 bg-slate-200 rounded-lg mx-auto animate-pulse"></div>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 w-24 bg-slate-200 rounded-full animate-pulse"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-[4/3] bg-slate-200 rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="gallery" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold font-serif text-slate-900 mb-4">
            Research Gallery
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            A visual journey through my scientific activities, research work, and academic milestones
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${selectedCategory === category
                  ? 'bg-academic-600 text-white shadow-lg scale-105'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 hover:border-academic-200'
                }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item._id}
              onClick={() => openLightbox(item)}
              className="group relative overflow-hidden rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer bg-white border border-slate-100"
            >
              {/* Image */}
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                <img
                  src={urlFor(item.image).width(600).height(450).url()}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
              </div>

              {/* Overlay on Hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                <span className="inline-block px-2 py-1 bg-academic-500/20 backdrop-blur-sm text-academic-100 text-xs font-semibold rounded mb-2 w-fit border border-academic-500/30">
                  {item.category}
                </span>
                <h3 className="text-white font-bold text-lg mb-1 leading-tight">{item.title}</h3>
                <p className="text-slate-200 text-sm line-clamp-2 opacity-90">{item.description}</p>
                <div className="mt-3 text-xs text-slate-400 font-medium">{item.date}</div>
              </div>

              {/* Bottom Info (Always Visible) - simplified */}
              <div className="p-4 group-hover:hidden bg-white">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-bold text-academic-600 uppercase tracking-wider">{item.category}</span>
                  <span className="text-xs text-slate-400">{item.date}</span>
                </div>
                <h3 className="text-slate-900 font-bold line-clamp-1">{item.title}</h3>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <div className="mb-6">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-slate-900 text-xl font-bold mb-2">No photos found</h3>
              <p className="text-slate-500 max-w-md mx-auto mb-6">
                {selectedCategory === "All"
                  ? "The gallery is currently empty. Check back later for updates."
                  : `No photos found in the "${selectedCategory}" category.`}
              </p>
              <a
                href="https://saad.sanity.studio"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium text-sm"
              >
                Manage Gallery
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        )}

        {/* Lightbox Modal */}
        {selectedImage && (
          <div
            className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={closeLightbox}
          >
            {/* Close Button */}
            <button
              onClick={closeLightbox}
              className="fixed top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-all z-50"
            >
              <X size={24} />
            </button>

            {/* Navigation Buttons */}
            <button
              onClick={(e) => { e.stopPropagation(); navigateImage('prev'); }}
              className="fixed left-4 md:left-8 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all z-50 hover:scale-110"
            >
              <ChevronLeft size={32} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); navigateImage('next'); }}
              className="fixed right-4 md:right-8 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all z-50 hover:scale-110"
            >
              <ChevronRight size={32} />
            </button>

            {/* Image Container */}
            <div
              className="max-w-6xl w-full flex flex-col md:flex-row gap-0 md:gap-0 bg-black rounded-2xl overflow-hidden shadow-2xl max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-1 bg-black flex items-center justify-center relative min-h-[40vh] md:min-h-[60vh]">
                <img
                  src={urlFor(selectedImage.image).width(1200).url()}
                  alt={selectedImage.title}
                  className="max-w-full max-h-[80vh] object-contain"
                />
              </div>

              {/* Image Info Sidebar */}
              <div className="w-full md:w-96 bg-white p-6 md:p-8 flex flex-col overflow-y-auto max-h-[40vh] md:max-h-auto">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-academic-100 text-academic-700 text-xs font-bold uppercase tracking-wider rounded-full">
                    {selectedImage.category}
                  </span>
                  <span className="text-slate-400 text-sm font-medium">{selectedImage.date}</span>
                </div>

                <h3 className="text-2xl font-bold text-slate-900 mb-4 leading-tight">{selectedImage.title}</h3>

                <div className="prose prose-slate prose-sm text-slate-600 leading-relaxed mb-6 flex-grow">
                  {selectedImage.description}
                </div>

                <div className="pt-6 border-t border-slate-100 mt-auto">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Image {filteredItems.findIndex(item => item._id === selectedImage._id) + 1} of {filteredItems.length}</span>
                    <span>Use arrow keys to navigate</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Gallery;
