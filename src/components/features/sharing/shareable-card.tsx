import { useState, useRef, ReactNode } from "react";
import { Download, Share2, Copy, Link } from "lucide-react";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import { createChartShareUrl, getDubConfig } from "@/lib/dub";
import { trackShareEvent as trackAnalytics } from "@/lib/analytics";

interface ShareableCardProps {
  children: ReactNode;
  title: string;
  className?: string;
  contextInfo?: {
    repository?: string;
    metric?: string;
  };
  chartType?: string; // For categorizing the type of chart/metric
  bypassAnalytics?: boolean; // For testing purposes
}

export function ShareableCard({ 
  children, 
  title, 
  className,
  contextInfo,
  chartType = "chart",
  bypassAnalytics = false
}: ShareableCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isGeneratingUrl, setIsGeneratingUrl] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Safe router access for testing environment
  let location;
  try {
    location = useLocation();
  } catch {
    location = { pathname: '/' };
  }
  const dubConfig = getDubConfig();


  const handleCapture = async (action: 'download' | 'copy' | 'share') => {
    if (!cardRef.current) return;

    setIsCapturing(true);
    
    // Wait a moment for the buttons to be removed from DOM
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      // Create a wrapper div for the entire capture with border and attribution
      const element = cardRef.current;
      let wrapper: HTMLDivElement | null = null;
      let attributionBar: HTMLDivElement | null = null;
      let contentWrapper: HTMLDivElement | null = null;
      
      // Store original parent and styles
      const originalParent = element.parentNode;
      const originalNextSibling = element.nextSibling;
      
      wrapper = document.createElement('div');
      
      // Wrapper styling with orange border and rounded corners
      wrapper.style.cssText = `
        border: 3px solid #f97316;
        border-radius: 0.75rem;
        overflow: hidden;
        background: inherit;
        position: relative;
      `;
      
      // Add attribution bar at the top
      attributionBar = document.createElement('div');
      attributionBar.style.cssText = `
        height: 48px;
        background-color: #000000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        font-family: system-ui;
        color: white;
        position: relative;
        z-index: 1000;
      `;
      
      // Attribution content: repo on left, logo on right
      attributionBar.innerHTML = `
        <span style="color: rgba(255,255,255,0.7); font-size: 14px;">
          ${contextInfo?.repository || ''}
        </span>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: white; font-size: 16px; font-weight: 500;">contributor.info</span>
          <span style="font-size: 24px;">🌱</span>
        </div>
      `;
      
      // Content wrapper to ensure proper padding and no overlap
      contentWrapper = document.createElement('div');
      contentWrapper.style.cssText = `
        padding: 16px;
        background: inherit;
        min-height: 200px;
      `;
      
      // Build the structure: wrapper > attribution + contentWrapper > original element
      wrapper.appendChild(attributionBar);
      wrapper.appendChild(contentWrapper);
      contentWrapper.appendChild(element);
      
      // Insert wrapper where the original element was
      if (originalParent) {
        originalParent.insertBefore(wrapper, originalNextSibling);
      }

      const canvas = await html2canvas(wrapper!, {
        useCORS: true,
        allowTaint: true,
      });

      // Restore original DOM structure
      if (originalParent && wrapper) {
        originalParent.insertBefore(element, originalNextSibling);
        if (wrapper.parentNode) {
          wrapper.parentNode.removeChild(wrapper);
        }
      }

      if (action === 'download') {
        // Download as PNG
        const link = document.createElement('a');
        link.download = `${title.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL();
        link.click();
        toast.success("Chart downloaded!");
        
        // Track download event
        if (!bypassAnalytics) {
          await trackShareEvent('download', 'image');
        }
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
          if (!bypassAnalytics) {
            await trackShareEvent('copy', 'image');
          }
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
              if (!bypassAnalytics) {
                await trackShareEvent('share', 'native', { 
                  shortUrl, 
                  withImage: true,
                  dubLinkId: shortUrl !== currentUrl ? shortUrl.split('/').pop() : undefined 
                });
              }
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
      if (!bypassAnalytics) {
        await trackShareEvent('share', 'url', { 
          shortUrl, 
          isShortened,
          dubLinkId: isShortened ? shortUrl.split('/').pop() : undefined 
        });
      }
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
      
      {/* Floating action buttons on hover - completely removed during capture */}
      {!isCapturing && (
        <div
          className={cn(
            "absolute top-2 right-2 flex gap-2 transition-opacity duration-200",
            isHovered && !isGeneratingUrl ? "opacity-100" : "opacity-0 pointer-events-none"
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
      )}
    </div>
  );
}