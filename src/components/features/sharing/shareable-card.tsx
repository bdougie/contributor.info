import { useState, useRef, ReactNode } from "react";
import { Download, Share2, Copy, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLocation as useRouterLocation } from "react-router-dom";
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
  const useLocation = () => {
    try {
      return useRouterLocation();
    } catch {
      return { pathname: '/' };
    }
  };
  
  const location = useLocation();
  const dubConfig = getDubConfig();


  const handleCapture = async (action: 'download' | 'copy' | 'share') => {
    if (!cardRef.current) return;

    setIsCapturing(true);
    
    // Lazy load html2canvas to reduce initial bundle size
    const { default: html2canvas } = await import('html2canvas');
    
    // Use requestAnimationFrame to ensure DOM operations are batched and buttons are hidden
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    try {
      // Create a wrapper div for the entire capture with border and attribution
      const element = cardRef.current;
      let wrapper: HTMLDivElement | null = null;
      let attributionBar: HTMLDivElement | null = null;
      let contentWrapper: HTMLDivElement | null = null;
      
      // Store original parent and styles for cleanup
      const originalParent = element.parentNode;
      const originalNextSibling = element.nextSibling;
      
      // Cleanup function to ensure DOM is always restored
      const cleanup = () => {
        try {
          if (originalParent && element) {
            originalParent.insertBefore(element, originalNextSibling);
          }
          if (wrapper?.parentNode) {
            wrapper.parentNode.removeChild(wrapper);
          }
        } catch (cleanupError) {
          console.warn('Cleanup error:', cleanupError);
        }
      };
      
      wrapper = document.createElement('div');
      wrapper.setAttribute('data-capture-wrapper', 'true');
      
      // Wrapper styling with thick orange border and rounded corners (matching lottery factory card)
      wrapper.style.cssText = `
        border: 10px solid #f97316;
        border-radius: 36px;
        overflow: hidden;
        background: white;
        position: relative;
        max-width: 540px;
        min-width: 540px;
        width: 540px;
        margin: 0 auto;
      `;
      
      // Add attribution bar at the top (matching lottery factory card header)
      attributionBar = document.createElement('div');
      attributionBar.style.cssText = `
        height: 60px;
        background-color: #202020;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        color: white;
        position: relative;
        z-index: 1000;
      `;
      
      // Attribution content: repo with icon on left, logo on right (adjusted for smaller width)
      // Create elements programmatically to avoid XSS vulnerabilities
      const leftContainer = document.createElement('div');
      leftContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
      
      const iconContainer = document.createElement('div');
      iconContainer.style.cssText = 'width: 24px; height: 24px; background-color: #404040; border-radius: 4px; display: flex; align-items: center; justify-content: center;';
      const iconSpan = document.createElement('span');
      iconSpan.style.cssText = 'font-size: 12px;';
      iconSpan.textContent = '📊';
      iconContainer.appendChild(iconSpan);
      
      const repoName = document.createElement('span');
      repoName.style.cssText = 'color: white; font-size: 16px; font-weight: bold; font-family: "Inter", system-ui, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px;';
      repoName.textContent = contextInfo?.repository || 'Repository'; // Safe: using textContent instead of innerHTML
      
      leftContainer.appendChild(iconContainer);
      leftContainer.appendChild(repoName);
      
      const rightContainer = document.createElement('div');
      rightContainer.style.cssText = 'display: flex; align-items: center; flex-shrink: 0;';
      
      const logoIcon = document.createElement('span');
      logoIcon.style.cssText = 'font-size: 18px; margin-right: 4px;';
      logoIcon.textContent = '🌱';
      
      const logoText = document.createElement('span');
      logoText.style.cssText = 'color: white; font-size: 14px; font-weight: 500; font-family: "Inter", system-ui, sans-serif;';
      logoText.textContent = 'contributor.info';
      
      rightContainer.appendChild(logoIcon);
      rightContainer.appendChild(logoText);
      
      attributionBar.appendChild(leftContainer);
      attributionBar.appendChild(rightContainer);
      
      // Content wrapper to ensure proper padding and no overlap (adjusted for smaller width)
      contentWrapper = document.createElement('div');
      contentWrapper.style.cssText = `
        padding: 20px;
        background: white;
        min-height: 300px;
        color-scheme: light;
      `;
      
      // Add style element to force light mode and fix text rendering
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        .shareable-capture-wrapper * {
          color-scheme: light !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
          text-rendering: optimizeLegibility !important;
        }
        .shareable-capture-wrapper .bg-background,
        .shareable-capture-wrapper .bg-card,
        .shareable-capture-wrapper .dark\\:bg-background,
        .shareable-capture-wrapper .dark\\:bg-card {
          background-color: white !important;
        }
        .shareable-capture-wrapper .text-foreground,
        .shareable-capture-wrapper .text-card-foreground,
        .shareable-capture-wrapper .dark\\:text-foreground,
        .shareable-capture-wrapper .dark\\:text-card-foreground {
          color: #111827 !important;
        }
        .shareable-capture-wrapper .border,
        .shareable-capture-wrapper .dark\\:border {
          border-color: #e5e7eb !important;
        }
        .shareable-capture-wrapper .bg-muted,
        .shareable-capture-wrapper .dark\\:bg-muted {
          background-color: #f9fafb !important;
        }
        .shareable-capture-wrapper .text-muted-foreground,
        .shareable-capture-wrapper .dark\\:text-muted-foreground {
          color: #6b7280 !important;
        }
        .shareable-capture-wrapper .bg-accent,
        .shareable-capture-wrapper .dark\\:bg-accent {
          background-color: #f3f4f6 !important;
        }
        /* Fix text overflow and truncation */
        .shareable-capture-wrapper .truncate {
          overflow: visible !important;
          text-overflow: clip !important;
          white-space: normal !important;
        }
        /* Ensure badges are properly rendered */
        .shareable-capture-wrapper .bg-red-100,
        .shareable-capture-wrapper .dark\\:bg-red-900\\/20 {
          background-color: #fee2e2 !important;
        }
        .shareable-capture-wrapper .text-red-700,
        .shareable-capture-wrapper .dark\\:text-red-400 {
          color: #b91c1c !important;
        }
        .shareable-capture-wrapper .bg-yellow-100,
        .shareable-capture-wrapper .dark\\:bg-yellow-900\\/20 {
          background-color: #fef3c7 !important;
        }
        .shareable-capture-wrapper .text-yellow-700,
        .shareable-capture-wrapper .dark\\:text-yellow-400 {
          color: #b45309 !important;
        }
        .shareable-capture-wrapper .bg-green-100,
        .shareable-capture-wrapper .dark\\:bg-green-900\\/20 {
          background-color: #d1fae5 !important;
        }
        .shareable-capture-wrapper .text-green-700,
        .shareable-capture-wrapper .dark\\:text-green-400 {
          color: #15803d !important;
        }
      `;
      contentWrapper.appendChild(styleElement);
      contentWrapper.classList.add('shareable-capture-wrapper');
      
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
        logging: false,
        width: 540
      });

      // Restore original DOM structure using cleanup function
      cleanup();

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
      // Ensure cleanup runs even on error
      try {
        const element = cardRef.current;
        if (element) {
          const wrapper = element.closest('[data-capture-wrapper]');
          if (wrapper?.parentNode) {
            wrapper.parentNode.removeChild(wrapper);
          }
        }
      } catch (cleanupError) {
        console.warn('Error cleanup failed:', cleanupError);
      }
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