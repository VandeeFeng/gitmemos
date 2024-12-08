import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Issue } from "@/types/github";
import { ShareCard } from "./share-card";
import { toast } from "sonner";
import { generateImage } from "./image-generator";
import { useRef } from 'react';
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

export function ShareDialog({ isOpen, onClose, issue }: ShareDialogProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

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

    const toastId = toast.loading("Generating image...");

    try {
      const dataUrl = await generateImage({
        element: cardRef.current,
        backgroundColor: isDark ? '#2d333b' : '#ffffff',
        pixelRatio: 2,
      });

      // 检测是否为移动端设备
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        // 移动端直接创建下载链接
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        // 创建一个隐藏的下载链接
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `gitmemo-${issue.number}.png`;
        link.style.display = 'none';
        document.body.appendChild(link);

        // 触发点击
        link.click();

        // 清理
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
          document.body.removeChild(link);
        }, 100);

        // 显示提示
        toast.success("图片已准备好，请在通知中查看下载");
      } else {
        // 桌面端使用下载链接
        const link = document.createElement('a');
        link.download = `gitmemo-${issue.number}.png`;
        link.href = dataUrl;
        link.click();
      }

      toast.dismiss(toastId);
      toast.success("Image generated successfully");
    } catch (err) {
      console.error('Failed to generate image:', err);
      toast.dismiss(toastId);
      toast.error("Failed to generate image");
    }
  };

  return (
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
  );
} 