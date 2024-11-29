'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

interface LightboxProps {
  src: string;
  alt?: string;
  className?: string;
  width?: number | string;
  height?: number | string;
}

interface Position {
  x: number;
  y: number;
}

export function Lightbox({ src, alt = '', className = '', width, height }: LightboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<Position>({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  }, [handleClose]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.current.x;
      const newY = e.clientY - dragStart.current.y;
      
      // 限制拖动范围
      const img = imageRef.current;
      if (img) {
        const bounds = img.getBoundingClientRect();
        const maxX = window.innerWidth * 0.2;
        const maxY = window.innerHeight * 0.2;
        
        setPosition({
          x: Math.max(Math.min(newX, maxX), -maxX),
          y: Math.max(Math.min(newY, maxY), -maxY)
        });
      }
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const toggleZoom = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale === 1) {
      setScale(1.5);
      // 如果有鼠标位置，则以鼠标位置为中心放大
      if (imageRef.current) {
        const bounds = imageRef.current.getBoundingClientRect();
        const mouseX = e.clientX - bounds.left;
        const mouseY = e.clientY - bounds.top;
        const centerX = bounds.width / 2;
        const centerY = bounds.height / 2;
        setPosition({
          x: (centerX - mouseX) * 0.5,
          y: (centerY - mouseY) * 0.5
        });
      }
    } else {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isOpen, handleKeyDown, handleMouseUp]);

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={`cursor-zoom-in hover:opacity-90 transition-opacity ${className}`}
        onClick={() => setIsOpen(true)}
        loading="lazy"
        width={width}
        height={height}
      />
      
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={handleClose}
          onMouseMove={handleMouseMove}
        >
          <div 
            className="relative max-w-[min(80vw,1000px)] max-h-[80vh]"
            onClick={e => e.stopPropagation()}
          >
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-gray-300 border-t-white rounded-full animate-spin"></div>
              </div>
            )}
            <img
              ref={imageRef}
              src={src}
              alt={alt}
              className={`w-auto h-auto max-w-full max-h-[80vh] object-contain transition-all duration-200 ease-out select-none
                ${isDragging ? 'cursor-grabbing' : scale === 1 ? 'cursor-zoom-in' : 'cursor-grab'}`}
              style={{ 
                transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
                transformOrigin: 'center'
              }}
              onLoad={() => setLoading(false)}
              onMouseDown={scale > 1 ? handleMouseDown : undefined}
              onClick={scale === 1 ? toggleZoom : undefined}
              draggable={false}
            />
            <div className="fixed top-4 right-4 flex gap-2">
              <button
                className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
                onClick={toggleZoom}
                title={scale === 1 ? "Zoom in" : "Zoom out"}
              >
                {scale === 1 ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    <line x1="11" y1="8" x2="11" y2="14"></line>
                    <line x1="8" y1="11" x2="14" y2="11"></line>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    <line x1="8" y1="11" x2="14" y2="11"></line>
                  </svg>
                )}
              </button>
              <button
                className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                title="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 