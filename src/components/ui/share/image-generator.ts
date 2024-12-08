interface ImageGeneratorOptions {
  element: HTMLElement;
  backgroundColor: string;
  padding?: number;
  radius?: number;
  pixelRatio?: number;
}

export async function generateImage({
  element,
  backgroundColor,
  padding = 24,
  radius = 8,
  pixelRatio = 2,
}: ImageGeneratorOptions): Promise<string> {
  const { toCanvas } = await import('html-to-image');
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // 等待所有图片加载完成并转换为 base64
  await preloadImages(element);

  // 生成图片
  const dataUrl = await toCanvas(element, {
    quality: 1.0,
    pixelRatio: isMobile ? Math.min(pixelRatio, window.devicePixelRatio || 2) : pixelRatio,
    backgroundColor: 'transparent',
    style: {
      transform: 'scale(1)',
      transformOrigin: 'top left',
    },
    filter: (node) => {
      const classList = node.classList;
      if (!classList) return true;
      return !classList.contains('overflow-y-auto') && 
             !classList.contains('cursor-zoom-in');
    },
    fontEmbedCSS: undefined,
    skipFonts: true,
    cacheBust: isMobile, // 移动端添加缓存破坏
  }).then(canvas => {
    // 移动端限制画布大小
    let finalWidth = canvas.width;
    let finalHeight = canvas.height;
    
    if (isMobile) {
      const maxWidth = 1200;
      const maxHeight = 1600;
      
      if (finalWidth > maxWidth) {
        const ratio = maxWidth / finalWidth;
        finalWidth = maxWidth;
        finalHeight = Math.floor(canvas.height * ratio);
      }
      
      if (finalHeight > maxHeight) {
        const ratio = maxHeight / finalHeight;
        finalHeight = maxHeight;
        finalWidth = Math.floor(finalWidth * ratio);
      }
    }

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = finalWidth + padding * 2;
    finalCanvas.height = finalHeight + padding * 2;
    
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    ctx.save();
    
    // 创建圆角路径
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

    ctx.fillStyle = backgroundColor;
    ctx.fill();
    ctx.clip();

    // 绘制内容
    ctx.drawImage(
      canvas,
      0, 0, canvas.width, canvas.height,
      padding, padding, finalWidth, finalHeight
    );

    ctx.restore();

    return finalCanvas.toDataURL('image/png', 1.0);
  });

  return dataUrl;
}

async function convertImageToBase64(imgUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
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
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imgUrl;
  });
}

async function preloadImages(element: HTMLElement): Promise<void> {
  const images = Array.from(element.getElementsByTagName('img'));
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  const loadImage = async (img: HTMLImageElement) => {
    try {
      if (img.src.startsWith('data:')) return;
      
      // 移动端设置较短的超时时间
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Image load timeout')), isMobile ? 10000 : 30000);
      });
      
      const base64Promise = convertImageToBase64(img.src);
      const base64Url = await Promise.race([base64Promise, timeoutPromise]);
      img.src = base64Url as string;
    } catch (error) {
      console.error('Failed to convert image:', error);
      // 如果转换失败，保留原始图片URL
      return;
    }
  };

  // 移动端限制并发数，PC 端并行处理
  if (isMobile) {
    const batchSize = 3;
    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);
      await Promise.all(batch.map(img => loadImage(img)));
    }
  } else {
    await Promise.all(images.map(img => loadImage(img)));
  }

  // 等待所有图片加载完成
  await Promise.all(images.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve; // 即使加载失败也继续处理
    });
  }));
} 