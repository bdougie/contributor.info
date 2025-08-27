import React, { useState, useCallback, useRef, useEffect } from 'react';
import { File, GitPullRequest } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { PullRequest } from '@/lib/types';

// Same interfaces as in file-hover-card.tsx
interface FileTouched {
  name: string;
  additions: number;
  deletions: number;
}

interface FileHoverInfoProps {
  pullRequest: PullRequest;
  filesTouched: FileTouched[];
  children: React.ReactNode;
}

// Reuse the same badge styling function
const getFileBadgeStyle = (extension: string) => {
  const extensionColorMap: Record<string, string> = {
    ts: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    tsx: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    js: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
    jsx: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
    py: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    go: 'bg-teal-100 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400',
    rs: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    java: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
    kt: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
    swift: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    md: 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400',
    json: 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400',
    yml: 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400',
    yaml: 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400',
    css: 'bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400',
    scss: 'bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400',
    html: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  };

  return (
    extensionColorMap[extension] ||
    'bg-slate-100 text-slate-700 dark:bg-slate-900/20 dark:text-slate-400'
  );
};

export function FileHoverInfo({ pullRequest, filesTouched, children }: FileHoverInfoProps) {
  const [hover, setHover] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // Sort files by total changes (additions + deletions)
  const sortedFiles = [...filesTouched].sort((a, b) => {
    const totalChangesA = a.additions + a.deletions;
    const totalChangesB = b.additions + b.deletions;
    return totalChangesB - totalChangesA;
  });

  // Controlled show/hide with timeouts to avoid flicker
  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHover(true);
    }, 200);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHover(false);
    }, 200);
  }, []);

  // Only update position when first opening the tooltip
  const handleTriggerMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Only update position if it's significantly different from last position
      const x = e.clientX;
      const y = e.clientY;

      // Don't update position if tooltip is already shown and mouse only moved a little
      // This prevents the infinite re-render loop
      if (
        hover &&
        Math.abs(x - lastPosRef.current.x) < 5 &&
        Math.abs(y - lastPosRef.current.y) < 5
      ) {
        return;
      }

      lastPosRef.current = { x, y };
      setPosition({ x, y: y - 10 });
    },
    [hover]
  );

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Stop event propagation in tooltip
  const handleTooltipMouseMove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Handle document clicks to close the tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        triggerRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setHover(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Don't enter infinite render loop when tooltip is visible
  const tooltipPositionStyle = hover
    ? {
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -100%)',
      }
    : {};

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleTriggerMouseMove}
        className="inline-block"
        style={{ pointerEvents: 'auto' }}
      >
        {children}
      </div>

      {hover && (
        <div
          ref={tooltipRef}
          className={cn(
            'fixed z-[100] w-96 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=top]:slide-in-from-bottom-2'
          )}
          data-state="open"
          data-side="top"
          style={tooltipPositionStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleTooltipMouseMove}
        >
          <div className="space-y-2">
            <div className="font-medium">{pullRequest.title}</div>
            <div className="text-xs text-muted-foreground">
              #{pullRequest.number} by{' '}
              {pullRequest.author?.login || pullRequest.user?.login || 'Unknown'} ·
              {pullRequest.createdAt
                ? ` ${new Date(pullRequest.createdAt).toLocaleDateString()}`
                : pullRequest.created_at
                  ? ` ${new Date(pullRequest.created_at).toLocaleDateString()}`
                  : ' Unknown date'}
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
              <GitPullRequest className="h-4 w-4" />
              <a
                href={pullRequest.url || pullRequest.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                View Pull Request
              </a>
            </div>
          </div>

          <Separator className="my-3" />

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <File className="h-4 w-4" />
              <div className="text-sm font-medium">Files Touched</div>
              <Badge variant="outline" className="ml-auto text-xs">
                {filesTouched.length} {filesTouched.length === 1 ? 'file' : 'files'}
              </Badge>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {sortedFiles.slice(0, 10).map((file, index) => {
                const repoUrl = `https://github.com/${pullRequest.repository_owner}/${pullRequest.repository_name}`;
                const fileUrl = `${repoUrl}/pull/${pullRequest.number}/files#diff-${index}`;

                return (
                  <a
                    key={`${file.name}-${index}`}
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm hover:bg-muted/50 rounded p-1 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 ${getFileBadgeStyle(file.name)}`}
                      >
                        {file.name}
                      </Badge>
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-green-500 text-xs">+{file.additions}</span>
                        <span className="text-red-500 text-xs">-{file.deletions}</span>
                      </div>
                    </div>
                  </a>
                );
              })}

              {sortedFiles.length > 10 && (
                <div className="text-xs text-muted-foreground text-center">
                  +{sortedFiles.length - 10} more files modified
                </div>
              )}
            </div>
          </div>

          {/* Add a little arrow at the bottom of the tooltip */}
          <div
            className="absolute w-3 h-3 bg-popover rotate-45 border-r border-b"
            style={{
              bottom: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          />
        </div>
      )}
    </>
  );
}
