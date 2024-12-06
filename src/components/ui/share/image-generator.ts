import { toast } from "sonner";

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

  // 等待所有图片加载完成并转换为 base64
  await preloadImages(element);

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
  
  for (const img of images) {
    try {
      if (img.src.startsWith('data:')) continue;
      const base64Url = await convertImageToBase64(img.src);
      img.src = base64Url;
    } catch (error) {
      console.error('Failed to convert image:', error);
    }
  }

  // 等待所有图片加载完成
  const imagePromises = images.map(img => {
    if (img.complete) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      img.addEventListener('load', resolve);
      img.addEventListener('error', reject);
    });
  });
  await Promise.all(imagePromises);
} 