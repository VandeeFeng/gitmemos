'use client';

import { useState, useEffect } from 'react';

interface LightboxProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
}

export function Lightbox({ isOpen, imageUrl, onClose }: LightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setIsImageLoaded(false);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!mounted) return null;
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className={`absolute inset-0 transition-opacity duration-300 ${
          isImageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
          aria-label="Close lightbox"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18"></path>
            <path d="M6 6l12 12"></path>
          </svg>
        </button>
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={imageUrl}
            alt="Lightbox image"
            className="max-w-[85vw] max-h-[85vh] object-contain"
            onClick={(e) => e.stopPropagation()}
            onLoad={() => setIsImageLoaded(true)}
          />
        </div>
      </div>
    </div>
  );
} 