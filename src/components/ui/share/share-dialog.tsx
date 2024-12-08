import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Issue } from "@/types/github";
import { ShareCard } from "./share-card";
import { toast } from "sonner";
import { generateImage } from "./image-generator";
import { useRef, useState, useEffect } from 'react';
import { useTheme } from 'next-themes';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={() => onOpenChange?.(false)}
    >
      {children}
    </div>
  );
}

function DialogContent({ children, className }: DialogContentProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn(
        isDark ? "bg-[#2d333b]" : "bg-white",
        "rounded-lg shadow-lg w-full max-h-[85vh] overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  issue: Issue;
}

interface ImagePreviewProps {
  imageUrl: string;
  fileName: string;
  onClose: () => void;
  isDark: boolean;
  onDownload: (imageUrl: string, fileName: string) => void;
  downloadButtonText: string;
}

function ImagePreview({ imageUrl, fileName, onClose, isDark, onDownload, downloadButtonText }: ImagePreviewProps) {
  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className={cn(
          "relative rounded-lg overflow-hidden max-w-full max-h-[90vh] flex flex-col",
          isDark ? "bg-[#2d333b]" : "bg-white"
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="relative flex-1 flex items-center justify-center p-4">
          <div className={cn(
            "rounded-lg overflow-hidden",
            isDark ? "border border-[#444c56] shadow-lg" : "border border-gray-200 shadow-md"
          )}>
            <img 
              src={imageUrl} 
              alt="Preview" 
              className="max-w-full max-h-[70vh] w-auto h-auto object-contain"
            />
          </div>
          <button
            className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            onClick={onClose}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className={cn(
          "p-4 text-center border-t",
          isDark ? "border-[#444c56]" : "border-gray-200"
        )}>
          <Button
            className="bg-[#2da44e] hover:bg-[#2c974b] text-white transition-colors"
            size="lg"
            onClick={() => onDownload(imageUrl, fileName)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {downloadButtonText}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ShareDialog({ isOpen, onClose, issue }: ShareDialogProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const toastIdRef = useRef<string | number | null>(null);

  // 清理函数
  const cleanup = () => {
    // 取消正在进行的图片生成
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 清除正在显示的 toast
    if (toastIdRef.current !== null) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }

    // 清理预览图片
    if (previewImage && previewImage.startsWith('blob:')) {
      URL.revokeObjectURL(previewImage);
    }
    setPreviewImage(null);
  };

  // 监听对话框关闭
  useEffect(() => {
    if (!isOpen) {
      cleanup();
    }
    return () => cleanup();
  }, [isOpen]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleGenerateImage = async () => {
    if (!cardRef.current) return;

    // 清理之前的操作
    cleanup();

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();
    toastIdRef.current = toast.loading("Generating image...");

    try {
      const dataUrl = await generateImage({
        element: cardRef.current,
        backgroundColor: isDark ? '#2d333b' : '#ffffff',
        pixelRatio: 2,
        signal: abortControllerRef.current.signal,
      });

      // 如果已经被取消，直接返回
      if (abortControllerRef.current.signal.aborted) {
        return;
      }

      // 检测是否为移动端设备
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        // 转换 dataUrl 为 Blob URL
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // 显示预览
        setPreviewImage(blobUrl);
      } else {
        // 桌面端直接显示预览
        setPreviewImage(dataUrl);
      }

      if (toastIdRef.current !== null) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    } catch (error) {
      // 如果不是取消操作导致的错误，才显示错误提示
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('Failed to generate image:', error);
        if (toastIdRef.current !== null) {
          toast.dismiss(toastIdRef.current);
          toastIdRef.current = null;
        }
        toast.error("Failed to generate image");
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleDownload = (imageUrl: string, fileName: string) => {
    try {
      // 检测是否为 Firefox
      const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
      // 检测是否为移动设备
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isFirefox && isMobile) {
        // Firefox 移动版：直接打开图片在新标签页，用户可以长按保存
        window.open(imageUrl, '_blank');
        toast.success("Long press the image to save");
      } else {
        // 其他浏览器：使用 download 属性
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = fileName;
        link.target = '_blank'; // 添加 target 属性以提高兼容性
        document.body.appendChild(link); // 某些浏览器需要元素在 DOM 中
        link.click();
        setTimeout(() => {
          document.body.removeChild(link); // 清理 DOM
        }, 100);
        toast.success("Image saved successfully");
      }
    } catch (err) {
      console.error('Failed to download image:', err);
      // 如果下载失败，提供备选方案
      window.open(imageUrl, '_blank');
      toast.error("Failed to save image. Please try long pressing the image instead.");
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] flex flex-col">
          <div className={`flex justify-between gap-4 p-6 border-b ${
            isDark ? "border-[#444c56]" : "border-gray-200"
          }`}>
            <Button
              variant="outline"
              size="lg"
              className={`flex-1 ${
                isDark 
                  ? "border-[#444c56] hover:bg-[#2d333b]/80" 
                  : "border-gray-200 hover:bg-gray-100"
              }`}
              onClick={handleCopyLink}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              Copy Link
            </Button>
            <Button
              variant="outline"
              size="lg"
              className={`flex-1 ${
                isDark 
                  ? "border-[#444c56] hover:bg-[#2d333b]/80" 
                  : "border-gray-200 hover:bg-gray-100"
              }`}
              onClick={handleGenerateImage}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
              Image
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              <div className={`border rounded-lg overflow-hidden ${
                isDark ? "border-[#444c56]" : "border-gray-200"
              }`}>
                <div ref={cardRef} className={isDark ? "bg-[#2d333b]" : "bg-white"}>
                  <ShareCard issue={issue} />
                  <div className={`flex items-center justify-center text-base border-t p-4 ${
                    isDark 
                      ? "text-gray-400 border-[#444c56]" 
                      : "text-gray-500 border-gray-200"
                  }`}>
                    <img src="/favicon.ico" alt="GitMemo" className="w-10 h-10 mr-2 rounded-full" />
                    via GitMemo
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {previewImage && (
        <ImagePreview
          imageUrl={previewImage}
          fileName={`gitmemo-${issue.number}.png`}
          onClose={() => {
            cleanup();
          }}
          isDark={isDark}
          onDownload={handleDownload}
          downloadButtonText={
            /firefox/i.test(navigator.userAgent) && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
              ? "Open Image"
              : "Download Image"
          }
        />
      )}
    </>
  );
} 