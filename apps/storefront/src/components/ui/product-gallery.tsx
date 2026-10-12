'use client';

import React, { useState } from 'react';
import type { ProductMediaDto } from '@repo/api-contracts';

interface ProductGalleryProps {
  media: ProductMediaDto[];
  title: string;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({ media, title }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  // If no media available, show elegant craft placeholder
  if (!media || media.length === 0) {
    return (
      <div className="w-full aspect-square rounded-2xl bg-gradient-to-br from-stone-100 to-stone-200 border border-stone-200 flex flex-col items-center justify-center p-8 text-center">
        <svg
          className="w-20 h-20 text-stone-300 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-sm font-semibold text-stone-600">Artisan Workshop Photograph</p>
        <p className="text-xs text-stone-400 mt-1">
          Authentic handmade piece photographed directly at artisan studio.
        </p>
      </div>
    );
  }

  const fallbackMedia = media[0]!;
  const activeMedia = media[activeIndex] ?? fallbackMedia;

  return (
    <div className="space-y-4">
      {/* Primary Display Frame */}
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 shadow-sm">
        <img
          src={activeMedia.url}
          alt={activeMedia.altText || `${title} - View ${activeIndex + 1}`}
          className="w-full h-full object-cover transition-opacity duration-300"
        />
        <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-[10px] rounded-md font-medium">
          {activeIndex + 1} of {media.length}
        </div>
      </div>

      {/* Thumbnail Strip (if more than 1 image) */}
      {media.length > 1 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          {media.map((item, idx) => (
            <button
              key={item.id || idx}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                activeIndex === idx
                  ? 'border-amber-600 ring-2 ring-amber-600/30'
                  : 'border-stone-200 opacity-75 hover:opacity-100'
              }`}
              aria-label={`View image ${idx + 1} of ${title}`}
            >
              <img
                src={item.url}
                alt={item.altText || `${title} thumbnail ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
