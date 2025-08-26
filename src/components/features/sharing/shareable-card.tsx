import { useState, useRef, ReactNode } from 'react';
import { Download, Share2, Copy } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLocation as useRouterLocation } from 'react-router-dom';
import { createChartShareUrl, getDubConfig } from '@/lib/dub';
import { trackShareEvent as trackAnalytics } from '@/lib/analytics';
import { SnapDOMCaptureService } from '@/lib/snapdom-capture';

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
  chartType = 'chart',
  bypassAnalytics = false,
}: ShareableCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
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

    try {
      // Use SnapDOM for superior performance and accuracy
      // Use wider width for treemap charts to provide better visualization
      const captureWidth = chartType === 'distribution-treemap' ? 840 : 540;

      const captureResult = await SnapDOMCaptureService.captureElement(cardRef.current, {
        title,
        repository: contextInfo?.repository,
        width: captureWidth,
        backgroundColor: 'white',
      });

      const { blob } = captureResult;

      if (action === 'download') {
        // Download as PNG using the utility method
        const filename = `${title.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.png`;
        SnapDOMCaptureService.downloadBlob(blob, filename);
        toast.success('Chart downloaded!');

        // Track download event
        if (!bypassAnalytics) {
          await trackShareEvent('download', 'image');
        }
      } else if (action === 'copy') {
        // Copy to clipboard
        try {
          // Generate short URL for copy with image
          const currentUrl = window.location.href;
          const shortUrl = await createChartShareUrl(
            currentUrl,
            chartType,
            contextInfo?.repository,
          );

          // Try to copy both image and URL (rich clipboard)
          const clipboardItems = [
            new ClipboardItem({
              'image/png': blob,
              'text/plain': new Blob([shortUrl], { type: 'text/plain' }),
            }),
          ];
          await navigator.clipboard.write(clipboardItems);
          toast.success('Chart copied to clipboard with link!');

          // Track copy event
          if (!bypassAnalytics) {
            await trackShareEvent('copy', 'image', {
              shortUrl,
              isShortened: shortUrl !== currentUrl,
              dubLinkId: shortUrl !== currentUrl ? shortUrl.split('/').pop() : undefined,
            });
          }
        } catch (err) {
          // Fallback to just copying the image
          try {
            await SnapDOMCaptureService.copyBlobToClipboard(blob);
            toast.success('Chart copied to clipboard!');

            // Track copy event (image only)
            if (!bypassAnalytics) {
              await trackShareEvent('copy', 'image');
            }
          } catch (err2) {
            toast.error('Failed to copy to clipboard');
          }
        }
      } else if (action === 'share') {
        // Native share with image
        const file = new File([blob], `${title}.png`, { type: 'image/png' });

        if (navigator.share && navigator.canShare({ files: [file] })) {
          try {
            // Generate short URL for native sharing
            const currentUrl = window.location.href;
            const shortUrl = await createChartShareUrl(
              currentUrl,
              chartType,
              contextInfo?.repository,
            );

            await navigator.share({
              title: title,
              text: `Check out this ${contextInfo?.metric || 'chart'} for ${contextInfo?.repository || 'this repository'}`,
              url: shortUrl,
              files: [file],
            });

            // Track share event
            if (!bypassAnalytics) {
              await trackShareEvent('share', 'native', {
                shortUrl,
                withImage: true,
                dubLinkId: shortUrl !== currentUrl ? shortUrl.split('/').pop() : undefined,
              });
            }
          } catch (err) {
            // User cancelled share
          }
        } else {
          // Fallback to copy functionality
          await handleCapture('copy');
        }
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error('Failed to capture chart');
    } finally {
      setIsCapturing(false);
    }
  };

  const trackShareEvent = async (
    action: string,
    type: string,
    meta_data?: Record<string, unknown>,
  ) => {
    try {
      await trackAnalytics({
        original_url: window.location.href,
        short_url: metadata?.shortUrl,
        dub_link_id: metadata?.dubLinkId,
        chart_type: chartType,
        repository: contextInfo?.repository,
        page_path: location.pathname,
        action,
        share_type: type,
        domain: dubConfig.isDev ? 'dub.co' : 'oss.fyi',
        metadata: {
          title,
          isShortened: metadata?.isShortened,
          ...metadata,
        },
      });
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div
      ref={cardRef}
      className={cn('relative group shareable-card', isCapturing && 'capturing', className)}
      data-shareable-card
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}

      {/* Floating action buttons on hover - completely removed during capture */}
      {!isCapturing && (
        <div
          className={cn(
            'absolute top-2 left-1/2 -translate-x-1/2 flex gap-2 transition-opacity duration-200',
            isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
        >
          <Button
            size="icon"
            variant="secondary"
            className="hidden sm:flex h-8 w-8 bg-primary-white-overlay backdrop-blur-sm"
            onClick={() => handleCapture('copy')}
            title="Copy chart as image"
            disabled={isCapturing}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="hidden sm:flex h-8 w-8 bg-primary-white-overlay backdrop-blur-sm"
            onClick={() => handleCapture('download')}
            title="Download chart"
            disabled={isCapturing}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="sm:hidden h-8 w-8 bg-primary-white-overlay backdrop-blur-sm"
            onClick={() => handleCapture('share')}
            title="Share chart"
            disabled={isCapturing}
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
