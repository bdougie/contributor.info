import { useState, useRef, ReactNode } from "react";
import { Download, Share2, Copy, Link } from "lucide-react";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import { LoginDialog } from "@/components/features/auth/login-dialog";
import { useGitHubAuth } from "@/hooks/use-github-auth";
import { createChartShareUrl, getDubConfig } from "@/lib/dub";
import { trackShareEvent as trackAnalytics } from "@/lib/analytics";

interface ShareableCardProps {
  children: ReactNode;
  title: string;
  className?: string;
  watermark?: boolean;
  contextInfo?: {
    repository?: string;
    metric?: string;
  };
  chartType?: string; // For categorizing the type of chart/metric
}

export function ShareableCard({ 
  children, 
  title, 
  className,
  watermark = true,
  contextInfo,
  chartType = "chart"
}: ShareableCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isGeneratingUrl, setIsGeneratingUrl] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const { isLoggedIn, showLoginDialog, setShowLoginDialog } = useGitHubAuth();
  
  const location = useLocation();
  const dubConfig = getDubConfig();

  const handleCapture = async (action: 'download' | 'copy' | 'share') => {
    if (!isLoggedIn) {
      toast.error("Please login to share content");
      setShowLoginDialog(true);
      return;
    }

    if (!cardRef.current) return;

    setIsCapturing(true);
    
    try {
      // Add temporary styling for capture
      const element = cardRef.current;
      element.style.position = 'relative';
      
      // Add watermark if enabled
      let watermarkEl: HTMLDivElement | null = null;
      if (watermark) {
        watermarkEl = document.createElement('div');
        watermarkEl.style.cssText = `
          position: absolute;
          bottom: 8px;
          right: 8px;
          font-size: 12px;
          color: rgba(0,0,0,0.5);
          font-family: system-ui;
          z-index: 1000;
        `;
        watermarkEl.textContent = `contributor.info${contextInfo?.repository ? ` • ${contextInfo.repository}` : ''}`;
        element.appendChild(watermarkEl);
      }

      const canvas = await html2canvas(element);

      // Remove watermark after capture
      if (watermarkEl) {
        element.removeChild(watermarkEl);
      }

      if (action === 'download') {
        // Download as PNG
        const link = document.createElement('a');
        link.download = `${title.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL();
        link.click();
        toast.success("Chart downloaded!");
        
        // Track download event
        await trackShareEvent('download', 'image');
      } else if (action === 'copy') {
        // Copy to clipboard
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          
          try {
            // Try to copy both image and URL (rich clipboard)
            const clipboardItems = [
              new ClipboardItem({
                'image/png': blob,
                'text/plain': new Blob([window.location.href], { type: 'text/plain' })
              })
            ];
            await navigator.clipboard.write(clipboardItems);
            toast.success("Chart copied to clipboard with link!");
          } catch (err) {
            // Fallback to just copying the image
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
              ]);
              toast.success("Chart copied to clipboard!");
            } catch (err2) {
              toast.error("Failed to copy to clipboard");
            }
          }
          
          // Track copy event
          await trackShareEvent('copy', 'image');
        });
      } else if (action === 'share') {
        // Native share with image
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          
          const file = new File([blob], `${title}.png`, { type: 'image/png' });
          
          if (navigator.share && navigator.canShare({ files: [file] })) {
            try {
              // Generate short URL for native sharing
              const currentUrl = window.location.href;
              const shortUrl = await createChartShareUrl(
                currentUrl,
                chartType,
                contextInfo?.repository
              );
              
              await navigator.share({
                title: title,
                text: `Check out this ${contextInfo?.metric || 'chart'} for ${contextInfo?.repository || 'this repository'}`,
                url: shortUrl,
                files: [file]
              });
              
              // Track share event
              await trackShareEvent('share', 'native', { 
                shortUrl, 
                withImage: true,
                dubLinkId: shortUrl !== currentUrl ? shortUrl.split('/').pop() : undefined 
              });
            } catch (err) {
              // User cancelled share
            }
          } else {
            // Fallback to URL share only
            handleShareUrl();
          }
        });
      }
    } catch (error) {
      console.error('Error capturing element:', error);
      toast.error("Failed to capture chart");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleShareUrl = async () => {
    if (!isLoggedIn) {
      toast.error("Please login to share content");
      setShowLoginDialog(true);
      return;
    }

    setIsGeneratingUrl(true);
    
    try {
      // Generate short URL for charts/metrics only
      const currentUrl = window.location.href;
      const shortUrl = await createChartShareUrl(
        currentUrl,
        chartType,
        contextInfo?.repository
      );
      
      // Create a descriptive share message
      const shareText = contextInfo?.repository 
        ? `Check out this ${contextInfo.metric || chartType} for ${contextInfo.repository}\n${shortUrl}`
        : `Check out this ${chartType} chart\n${shortUrl}`;
      
      await navigator.clipboard.writeText(shareText);
      
      const domain = dubConfig.isDev ? "dub.co" : "oss.fyi";
      const isShortened = shortUrl !== currentUrl;
      
      if (isShortened) {
        toast.success(`Short link copied! (${domain})`);
      } else {
        toast.success("Link copied to clipboard!");
      }
      
      // Track URL share event
      await trackShareEvent('share', 'url', { 
        shortUrl, 
        isShortened,
        dubLinkId: isShortened ? shortUrl.split('/').pop() : undefined 
      });
    } catch (err) {
      console.error("Failed to create short URL:", err);
      // Fallback to original URL with descriptive text
      try {
        const fallbackText = contextInfo?.repository 
          ? `Check out this ${contextInfo.metric || chartType} for ${contextInfo.repository}\n${window.location.href}`
          : `Check out this ${chartType} chart\n${window.location.href}`;
        await navigator.clipboard.writeText(fallbackText);
        toast.success("Link copied to clipboard!");
      } catch (fallbackErr) {
        toast.error("Failed to copy link");
      }
    } finally {
      setIsGeneratingUrl(false);
    }
  };

  const trackShareEvent = async (action: string, type: string, metadata?: Record<string, any>) => {
    try {
      await trackAnalytics({
        original_url: window.location.href,
        short_url: metadata?.shortUrl,
        dub_link_id: metadata?.dubLinkId,
        chart_type: chartType,
        repository: contextInfo?.repository,
        page_path: location.pathname,
        action: action as any,
        share_type: type as any,
        domain: dubConfig.isDev ? 'dub.co' : 'oss.fyi',
        metadata: {
          isLoggedIn,
          title,
          isShortened: metadata?.isShortened,
          ...metadata
        }
      });
    } catch (error) {
      console.error('Failed to track share event:', error);
    }
  };

  return (
    <div
      ref={cardRef}
      className={cn("relative group", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      
      {/* Floating action buttons on hover */}
      <div
        className={cn(
          "absolute top-2 right-2 flex gap-2 transition-opacity duration-200",
          isHovered && !isCapturing && !isGeneratingUrl ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 bg-background/80 backdrop-blur-sm"
          onClick={() => handleCapture('copy')}
          title="Copy chart as image"
          disabled={isCapturing || isGeneratingUrl}
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 bg-background/80 backdrop-blur-sm"
          onClick={() => handleCapture('download')}
          title="Download chart"
          disabled={isCapturing || isGeneratingUrl}
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 bg-background/80 backdrop-blur-sm"
          onClick={handleShareUrl}
          title={`Copy short link (${dubConfig.isDev ? 'dub.co' : 'oss.fyi'})`}
          disabled={isCapturing || isGeneratingUrl}
        >
          {isGeneratingUrl ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Link className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 bg-background/80 backdrop-blur-sm"
          onClick={() => handleCapture('share')}
          title="Share chart"
          disabled={isCapturing || isGeneratingUrl}
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Login dialog */}
      <LoginDialog 
        open={showLoginDialog} 
        onOpenChange={setShowLoginDialog} 
      />
    </div>
  );
}