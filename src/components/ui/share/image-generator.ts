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

  // 等待所有图片加载完成
  const images = Array.from(element.getElementsByTagName('img'));
  let loadingImages = false;

  // 检查是否有任何图片仍在加载
  for (const img of images) {
    if (!img.complete) {
      loadingImages = true;
      break;
    }
  }

  if (loadingImages) {
    // 如果有图片正在加载，等待所有图片加载完成
    await Promise.all(
      images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          // 设置一个超时，避免无限等待
          setTimeout(reject, 30000); // 30秒超时
        }).catch(error => {
          console.error('Image load failed:', img.src, error);
          // 即使图片加载失败也继续处理
          return Promise.resolve();
        });
      })
    );
  }

  // 等待所有图片转换为 base64
  await preloadImages(element);

  // 再次检查所有图片是否都成功加载
  const allImagesLoaded = images.every(img => {
    const isLoaded = img.complete && img.naturalWidth > 0;
    if (!isLoaded) {
      console.warn('Image not properly loaded:', img.src);
    }
    return isLoaded;
  });

  if (!allImagesLoaded) {
    console.warn('Some images failed to load properly');
  }

  // 生成图片
  const dataUrl = await toCanvas(element, {
    quality: 1.0,
    pixelRatio,
    backgroundColor: 'transparent',
    style: {
      transform: 'scale(1)',
      transformOrigin: 'top left',
    },
    filter: (node) => {
      // 过滤掉不需要的元素，比如滚动条和图片预览
      const classList = node.classList;
      if (!classList) return true;
      return !classList.contains('overflow-y-auto') && 
             !classList.contains('cursor-zoom-in');
    },
    fontEmbedCSS: undefined, // 禁用字体嵌入
    skipFonts: true, // 跳过字体处理
  }).then(canvas => {
    // 创建一个新的 canvas 来添加圆角和内边距
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = canvas.width + padding * 2;
    finalCanvas.height = canvas.height + padding * 2;
    
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

    // 填充背景
    ctx.fillStyle = backgroundColor;
    ctx.fill();

    // 使用圆角路径作为裁剪区域
    ctx.clip();

    // 绘制内容
    ctx.drawImage(canvas, padding, padding);

    ctx.restore();

    return finalCanvas.toDataURL('image/png', 1.0);
  });

  return dataUrl;
}

async function convertImageToBase64(imgUrl: string): Promise<string> {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      // 如果是 http 链接，使用代理
      const proxyUrl = imgUrl.startsWith('http') ? `/api/proxy/image?url=${encodeURIComponent(imgUrl)}` : imgUrl;
      
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        const timeoutId = setTimeout(() => {
          reject(new Error('Image load timeout'));
        }, 10000); // 10秒超时
        
        img.onload = () => {
          clearTimeout(timeoutId);
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
        
        img.onerror = () => {
          clearTimeout(timeoutId);
          // 如果代理加载失败，尝试直接加载原始图片
          if (img.src !== imgUrl) {
            img.src = imgUrl;
          } else {
            reject(new Error('Failed to load image'));
          }
        };
        
        img.src = proxyUrl;
      });
    } catch (error) {
      retryCount++;
      if (retryCount === maxRetries) {
        console.error('Failed to convert image after retries:', error);
        // 返回一个占位图片的 base64
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      }
      // 等待一段时间后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }
  
  throw new Error('Failed to convert image after all retries');
}

async function preloadImages(element: HTMLElement): Promise<void> {
  const images = Array.from(element.getElementsByTagName('img'));
  
  const imagePromises = images.map(async (img) => {
    try {
      if (img.src.startsWith('data:')) return;
      
      const base64Url = await convertImageToBase64(img.src);
      img.src = base64Url;
      
      // 等待图片加载完成
      if (!img.complete) {
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Image load timeout'));
          }, 10000); // 10秒超时
          
          img.onload = () => {
            clearTimeout(timeoutId);
            resolve(undefined);
          };
          img.onerror = () => {
            clearTimeout(timeoutId);
            reject(new Error('Failed to load converted image'));
          };
        }).catch(error => {
          console.error('Failed to load converted image:', error);
          // 不要让单个图片的失败影响整体流程
        });
      }
    } catch (error) {
      console.error('Failed to convert image:', error);
      // 不要让单个图片的失败影响整体流程
    }
  });
  
  // 等待所有图片处理完成，即使有些失败了
  await Promise.allSettled(imagePromises);
} 