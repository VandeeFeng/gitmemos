import { warnLog, errorLog } from '@/lib/debug';

interface ImageGeneratorOptions {
  element: HTMLElement;
  backgroundColor: string;
  padding?: number;
  radius?: number;
  pixelRatio?: number;
  signal?: AbortSignal;
}

export async function generateImage({
  element,
  backgroundColor,
  padding = 12,
  radius = 8,
  pixelRatio = 2,
  signal,
}: ImageGeneratorOptions): Promise<string> {
  const { toCanvas } = await import('html-to-image');

  // Check if operation has been aborted
  if (signal?.aborted) {
    throw new DOMException('Image generation aborted', 'AbortError');
  }

  // Wait for all images to load
  const images = Array.from(element.getElementsByTagName('img'));
  let loadingImages = false;

  // Check if any images are still loading
  for (const img of images) {
    if (!img.complete) {
      loadingImages = true;
      break;
    }
  }

  if (loadingImages) {
    // If images are loading, wait for all images to load
    await Promise.all(
      images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve, reject) => {
          const handleAbort = () => {
            img.removeEventListener('load', handleLoad);
            img.removeEventListener('error', handleError);
            reject(new DOMException('Image generation aborted', 'AbortError'));
          };

          const handleLoad = () => {
            cleanup();
            resolve(undefined);
          };

          const handleError = () => {
            cleanup();
            reject(new Error(`Failed to load image: ${img.src}`));
          };

          const cleanup = () => {
            img.removeEventListener('load', handleLoad);
            img.removeEventListener('error', handleError);
            signal?.removeEventListener('abort', handleAbort);
          };

          img.addEventListener('load', handleLoad);
          img.addEventListener('error', handleError);
          signal?.addEventListener('abort', handleAbort);

          // Set a timeout to avoid infinite waiting
          setTimeout(() => {
            cleanup();
            reject(new Error('Image load timeout'));
          }, 30000); // 30 seconds timeout
        }).catch(error => {
          errorLog('Image load failed:', img.src, error);
          // Continue processing even if image loading fails
          return Promise.resolve();
        });
      })
    );
  }

  // Check if operation has been aborted
  if (signal?.aborted) {
    throw new DOMException('Image generation aborted', 'AbortError');
  }

  // Wait for all images to be converted to base64
  await preloadImages(element, signal);

  // Check if all images are loaded successfully
  const allImagesLoaded = images.every(img => {
    const isLoaded = img.complete && img.naturalWidth > 0;
    if (!isLoaded) {
      warnLog('Image not properly loaded:', img.src);
    }
    return isLoaded;
  });

  if (!allImagesLoaded) {
    warnLog('Some images failed to load properly');
  }

  // Check if operation has been aborted
  if (signal?.aborted) {
    throw new DOMException('Image generation aborted', 'AbortError');
  }

  // Generate image
  const dataUrl = await toCanvas(element, {
    quality: 1.0,
    pixelRatio,
    backgroundColor: 'transparent',
    style: {
      transform: 'scale(1)',
      transformOrigin: 'top left',
    },
    filter: (node) => {
      // Filter out unwanted elements like scrollbars and image previews
      const classList = node.classList;
      if (!classList) return true;
      return !classList.contains('overflow-y-auto') && 
             !classList.contains('cursor-zoom-in');
    },
    fontEmbedCSS: undefined, // Disable font embedding
    skipFonts: true, // Skip font processing
  }).then(canvas => {
    // Check if operation has been aborted
    if (signal?.aborted) {
      throw new DOMException('Image generation aborted', 'AbortError');
    }

    // Create a new canvas to add rounded corners and padding
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = canvas.width + padding * 2;
    finalCanvas.height = canvas.height + padding * 2;
    
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    ctx.save();
    
    // Set the background color to match the content background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    
    // Create rounded corner path
    ctx.beginPath();
    ctx.moveTo(padding + radius, padding);
    ctx.lineTo(finalCanvas.width - padding - radius, padding);
    ctx.arcTo(finalCanvas.width - padding, padding, finalCanvas.width - padding, padding + radius, radius);
    ctx.lineTo(finalCanvas.width - padding, finalCanvas.height - padding - radius);
    ctx.arcTo(finalCanvas.width - padding, finalCanvas.height - padding, finalCanvas.width - padding - radius, finalCanvas.height - padding, radius);
    ctx.lineTo(padding + radius, finalCanvas.height - padding);
    ctx.arcTo(padding, finalCanvas.height - padding, padding, finalCanvas.height - padding - radius, radius);
    ctx.lineTo(padding, padding + radius);
    ctx.arcTo(padding, padding, padding + radius, padding, radius);
    ctx.closePath();

    // Use rounded corner path as clipping area
    ctx.clip();
    
    // Draw content
    ctx.drawImage(canvas, padding, padding);

    ctx.restore();

    return finalCanvas.toDataURL('image/png', 1.0);
  });

  return dataUrl;
}

async function convertImageToBase64(imgUrl: string, signal?: AbortSignal): Promise<string> {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      // Check if operation has been aborted
      if (signal?.aborted) {
        throw new DOMException('Image conversion aborted', 'AbortError');
      }

      // Use proxy for http links
      const proxyUrl = imgUrl.startsWith('http') ? `/api/proxy/image?url=${encodeURIComponent(imgUrl)}` : imgUrl;
      
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error('Image load timeout'));
        }, 10000); // 10 seconds timeout

        const handleAbort = () => {
          cleanup();
          reject(new DOMException('Image conversion aborted', 'AbortError'));
        };
        
        const handleLoad = () => {
          cleanup();
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Failed to get canvas context'));
              return;
            }
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } catch (err) {
            reject(err);
          }
        };
        
        const handleError = () => {
          cleanup();
          // If proxy loading fails, try loading the original image
          if (img.src !== imgUrl) {
            img.src = imgUrl;
          } else {
            reject(new Error('Failed to load image'));
          }
        };

        const cleanup = () => {
          clearTimeout(timeoutId);
          img.removeEventListener('load', handleLoad);
          img.removeEventListener('error', handleError);
          signal?.removeEventListener('abort', handleAbort);
        };
        
        img.addEventListener('load', handleLoad);
        img.addEventListener('error', handleError);
        signal?.addEventListener('abort', handleAbort);
        
        img.src = proxyUrl;
      });
    } catch (error) {
      // If it's an abort operation, throw the error directly
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }

      retryCount++;
      if (retryCount === maxRetries) {
        errorLog('Failed to convert image after retries:', error);
        // Return a placeholder image base64
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      }
      // Wait for a while before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }
  
  throw new Error('Failed to convert image after all retries');
}

async function preloadImages(element: HTMLElement, signal?: AbortSignal): Promise<void> {
  const images = Array.from(element.getElementsByTagName('img'));
  
  const imagePromises = images.map(async (img) => {
    try {
      if (img.src.startsWith('data:')) return;
      
      const base64Url = await convertImageToBase64(img.src, signal);
      
      // Check if operation has been aborted
      if (signal?.aborted) {
        throw new DOMException('Image preload aborted', 'AbortError');
      }

      img.src = base64Url;
      
      // Wait for image to load
      if (!img.complete) {
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('Image load timeout'));
          }, 10000); // 10 seconds timeout
          
          const handleAbort = () => {
            cleanup();
            reject(new DOMException('Image preload aborted', 'AbortError'));
          };

          const handleLoad = () => {
            cleanup();
            resolve(undefined);
          };

          const handleError = () => {
            cleanup();
            reject(new Error('Failed to load converted image'));
          };

          const cleanup = () => {
            clearTimeout(timeoutId);
            img.removeEventListener('load', handleLoad);
            img.removeEventListener('error', handleError);
            signal?.removeEventListener('abort', handleAbort);
          };

          img.addEventListener('load', handleLoad);
          img.addEventListener('error', handleError);
          signal?.addEventListener('abort', handleAbort);
        }).catch(error => {
          errorLog('Failed to load converted image:', error);
          // Don't let a single image failure affect the overall process
        });
      }
    } catch (error) {
      // If it's an abort operation, throw the error directly
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      errorLog('Failed to convert image:', error);
      // Don't let a single image failure affect the overall process
    }
  });
  
  // Wait for all images to process, even if some fail
  await Promise.allSettled(imagePromises);
} 