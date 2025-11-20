import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface GalleryItem {
  id: string;
  image: string;
  title: string;
  description: string;
  date: string;
  category: string;
}

const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: "1",
    image: "/images/gallery/activity1.jpg",
    title: "Research Laboratory Work",
    description: "Working on computational chemistry simulations at the University of Trieste.",
    date: "2024",
    category: "Research"
  },
  {
    id: "2",
    image: "/images/gallery/activity2.jpg",
    title: "Conference Presentation",
    description: "Presenting findings on 2D materials at international conference.",
    date: "2024",
    category: "Conference"
  },
  {
    id: "3",
    image: "/images/gallery/activity3.jpg",
    title: "Lab Equipment Training",
    description: "Learning ARPES and XPS characterization techniques.",
    date: "2025",
    category: "Training"
  },
  // Add more items as you upload photos
];

const Gallery: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = ["All", ...Array.from(new Set(GALLERY_ITEMS.map(item => item.category)))];
  
  const filteredItems = selectedCategory === "All" 
    ? GALLERY_ITEMS 
    : GALLERY_ITEMS.filter(item => item.category === selectedCategory);

  const openLightbox = (item: GalleryItem) => {
    setSelectedImage(item);
  };

  const closeLightbox = () => {
    setSelectedImage(null);
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (!selectedImage) return;
    const currentIndex = filteredItems.findIndex(item => item.id === selectedImage.id);
    let newIndex;
    
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % filteredItems.length;
    } else {
      newIndex = (currentIndex - 1 + filteredItems.length) % filteredItems.length;
    }
    
    setSelectedImage(filteredItems[newIndex]);
  };

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
              className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${
                selectedCategory === category
                  ? 'bg-academic-600 text-white shadow-lg'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
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
              key={item.id}
              onClick={() => openLightbox(item)}
              className="group relative overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer bg-white"
            >
              {/* Image */}
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  onError={(e) => {
                    // Fallback if image doesn't exist yet
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/600x450/0284c7/ffffff?text=Upload+Photo';
                  }}
                />
              </div>
              
              {/* Overlay on Hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-5">
                <span className="text-xs text-academic-300 font-semibold mb-1">{item.category} • {item.date}</span>
                <h3 className="text-white font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-slate-200 text-sm line-clamp-2">{item.description}</p>
              </div>

              {/* Bottom Info (Always Visible) */}
              <div className="p-4 group-hover:hidden">
                <span className="text-xs text-academic-600 font-semibold">{item.category} • {item.date}</span>
                <h3 className="text-slate-900 font-bold mt-1">{item.title}</h3>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <div className="text-center py-16">
            <p className="text-slate-500 text-lg">No photos in this category yet.</p>
          </div>
        )}

        {/* Lightbox Modal */}
        {selectedImage && (
          <div 
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
            onClick={closeLightbox}
          >
            {/* Close Button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 text-white hover:text-academic-400 transition-colors z-10"
            >
              <X size={32} />
            </button>

            {/* Navigation Buttons */}
            <button
              onClick={(e) => { e.stopPropagation(); navigateImage('prev'); }}
              className="absolute left-4 text-white hover:text-academic-400 transition-colors z-10"
            >
              <ChevronLeft size={40} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); navigateImage('next'); }}
              className="absolute right-4 text-white hover:text-academic-400 transition-colors z-10"
            >
              <ChevronRight size={40} />
            </button>

            {/* Image Container */}
            <div 
              className="max-w-5xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedImage.image}
                alt={selectedImage.title}
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/1200x900/0284c7/ffffff?text=Upload+Photo';
                }}
              />
              
              {/* Image Info */}
              <div className="bg-white rounded-lg p-6 mt-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-3 py-1 bg-academic-100 text-academic-700 text-xs font-semibold rounded-full">
                    {selectedImage.category}
                  </span>
                  <span className="text-slate-500 text-sm">{selectedImage.date}</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{selectedImage.title}</h3>
                <p className="text-slate-600">{selectedImage.description}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Gallery;
