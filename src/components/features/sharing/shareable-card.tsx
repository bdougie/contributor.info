import { useState, useRef, ReactNode } from "react";
import { Download, Share2, Copy, Link } from "lucide-react";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import { createChartShareUrl, getDubConfig } from "@/lib/dub";
import { trackShareEvent as trackAnalytics } from "@/lib/analytics";
import { useTheme } from "@/components/common/theming/theme-provider";

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
  
  const { theme } = useTheme();
  
  const location = useLocation();
  const dubConfig = getDubConfig();

  // Helper function to get the actual theme (resolves 'system' to 'light' or 'dark')
  const getActualTheme = () => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  };

  const handleCapture = async (action: 'download' | 'copy' | 'share') => {
    if (!cardRef.current) return;

    setIsCapturing(true);
    
    try {
      // Add temporary styling for capture
      const element = cardRef.current;
      element.style.position = 'relative';
      
      // Ensure theme class is applied during capture
      const actualTheme = getActualTheme();
      
      // Add watermark if enabled
      let watermarkEl: HTMLDivElement | null = null;
      if (watermark) {
        watermarkEl = document.createElement('div');
        
        // Adaptive watermark color based on theme
        const isLightMode = actualTheme === 'light';
        const watermarkColor = isLightMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)';
        const backgroundColor = isLightMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)';
        const borderColor = isLightMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)';
        
        watermarkEl.style.cssText = `
          position: absolute;
          bottom: 16px;
          right: 8px;
          font-size: 12px;
          color: ${watermarkColor};
          font-family: system-ui;
          font-weight: 500;
          z-index: 1000;
          padding: 4px 8px 6px 8px;
          border-radius: 6px;
          backdrop-filter: blur(4px);
          text-shadow: ${isLightMode ? `1px 1px 2px ${borderColor}` : `1px 1px 2px ${borderColor}`};
          border: 1px solid ${borderColor};
          background: ${backgroundColor};
          display: flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
        `;
        watermarkEl.textContent = `contributor.info${contextInfo?.repository ? ` • ${contextInfo.repository}` : ''}`;
        element.appendChild(watermarkEl);
      }

      const canvas = await html2canvas(element, {
        useCORS: true,
        allowTaint: true,
      });

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
      className={cn("relative group shareable-card", className)}
      data-shareable-card
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
    </div>
  );
}