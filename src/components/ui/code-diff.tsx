import React from 'react';
import { cn } from '@/lib/utils';

interface CodeDiffProps {
  before: string;
  after: string;
  additions?: number;
  deletions?: number;
  className?: string;
}

export const CodeDiff(CodeDiffProps): JSX.Element = ({
  before,
  after,
  additions = 0,
  deletions = 0,
  className
}) => {
  return (
    <div className={cn("font-mono text-sm", className)}>
      {/* Diff Header with stats */}
      <div className="flex items-center gap-4 mb-3 text-xs">
        <span className="text-green-600 dark:text-green-400 font-medium">
          +{additions}
        </span>
        <span className="text-red-600 dark:text-red-400 font-medium">
          -{deletions}
        </span>
        
        {/* Visual diff bar */}
        <div className="flex items-center h-2">
          {additions > 0 && (
            <div 
              className="bg-green-500 h-full"
              style={{ width: `${Math.min(additions * 2, 40)}px` }}
            />
          )}
          {deletions > 0 && (
            <div 
              className="bg-red-500 h-full"
              style={{ width: `${Math.min(deletions * 2, 40)}px` }}
            />
          )}
          <div className="bg-gray-300 dark:bg-gray-600 h-full w-2 ml-1" />
        </div>
      </div>

      {/* Code diff display */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
        {/* Before (deletion) */}
        <div className="bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500 p-3">
          <div className="flex items-start gap-3">
            <span className="text-red-600 dark:text-red-400 select-none">-</span>
            <code className="text-gray-800 dark:text-gray-200 flex-1 break-all">
              {before}
            </code>
          </div>
        </div>

        {/* After (addition) */}
        <div className="bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 p-3">
          <div className="flex items-start gap-3">
            <span className="text-green-600 dark:text-green-400 select-none">+</span>
            <code className="text-gray-800 dark:text-gray-200 flex-1 break-all">
              {after}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * InlineCodeDiff - Compact visualization of code changes
 * 
 * Displays a 5-box visual representation of the ratio of lines added vs deleted.
 * The boxes show the weighting of changes in a pull request:
 * - Green boxes: Proportion of lines added
 * - Red boxes: Proportion of lines deleted  
 * - Gray boxes: Remaining ratio (represents unchanged context)
 * 
 * The visualization uses exactly 5 boxes to show the ratio, making it easy to
 * quickly understand if a PR is mostly additions, deletions, or balanced.
 * Uses Math.floor for calculating box distribution based on the ratio.
 * 
 * @example
 * // PR with 36 additions and 10 deletions
 * <InlineCodeDiff additions={36} deletions={10} />
 * // Results in ~4 green boxes, 1 red box (78% additions, 22% deletions)
 */
interface InlineCodeDiffProps {
  additions?: number;
  deletions?: number;
  className?: string;
}

export const InlineCodeDiff(InlineCodeDiffProps): JSX.Element = ({
  additions = 0,
  deletions = 0,
  className
}) => {
  // Calculate the total lines changed (additions + deletions)
  const totalChanged = additions + deletions;
  
  // Always use exactly 5 boxes for consistent visualization
  const totalSquares = 5;
  let addedSquares = 0;
  let deletedSquares = 0;
  let unchangedSquares = 0;
  
  if (totalChanged > 0) {
    // Calculate the ratio-based boxes using Math.floor
    // This ensures boxes represent the proportion of changes, not absolute numbers
    addedSquares = Math.floor((additions / totalChanged) * totalSquares);
    deletedSquares = Math.floor((deletions / totalChanged) * totalSquares);
    
    // Gray boxes represent the remaining ratio after rounding
    // This helps show when there's a high ratio of unchanged lines in the context
    const usedSquares = addedSquares + deletedSquares;
    unchangedSquares = totalSquares - usedSquares;
    
    // Handle edge case: very small changes that round to 0
    // Ensure at least 1 box shows for any non-zero change
    if (usedSquares === 0 && totalChanged > 0) {
      if (additions > 0) addedSquares = 1;
      if (deletions > 0) deletedSquares = 1;
      unchangedSquares = totalSquares - addedSquares - deletedSquares;
    }
  } else {
    // No changes: show all gray boxes
    unchangedSquares = totalSquares;
  }
  
  return (
    <div className={cn("inline-flex items-center gap-2 font-mono text-xs", className)}>
      <span className="text-green-600 dark:text-green-400 font-semibold">
        +{additions}
      </span>
      <span className="text-red-600 dark:text-red-400 font-semibold">
        -{deletions}
      </span>
      
      {/* Visual diff bar with exactly 5 boxes */}
      <div className="inline-flex items-center">
        {/* Green boxes for additions */}
        {[...Array(addedSquares)].map((_, i) => (
          <div 
            key={`add-${i}`} 
            className="bg-green-500 w-2 h-2 mr-0.5" 
            aria-label="Added lines"
          />
        ))}
        
        {/* Red boxes for deletions */}
        {[...Array(deletedSquares)].map((_, i) => (
          <div 
            key={`del-${i}`} 
            className="bg-red-500 w-2 h-2 mr-0.5" 
            aria-label="Deleted lines"
          />
        ))}
        
        {/* Gray boxes for unchanged/remaining */}
        {[...Array(unchangedSquares)].map((_, i) => (
          <div 
            key={`unchanged-${i}`} 
            className="bg-gray-300 dark:bg-gray-600 w-2 h-2 mr-0.5" 
            aria-label="Unchanged ratio"
          />
        ))}
      </div>
    </div>
  );
};

// Multi-line diff component for larger code blocks
interface MultiLineDiffProps {
  lines: Array<{
    type: 'addition' | 'deletion' | 'unchanged';
    content: string;
    lineNumber?: number;
  }>;
  className?: string;
  showLineNumbers?: boolean;
}

export const MultiLineDiff(MultiLineDiffProps): JSX.Element = ({
  lines,
  className,
  showLineNumbers = false
}) => {
  return (
    <div className={cn("font-mono text-sm border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden", className)}>
      {lines.map((line, index) => {
        const bgColor = line.type === 'addition' 
          ? 'bg-green-50 dark:bg-green-950/20' 
          : line.type === 'deletion'
          ? 'bg-red-50 dark:bg-red-950/20'
          : 'bg-white dark:bg-gray-900';
        
        const borderColor = line.type === 'addition'
          ? 'border-green-500'
          : line.type === 'deletion'
          ? 'border-red-500'
          : 'border-transparent';
        
        const symbol = line.type === 'addition'
          ? '+'
          : line.type === 'deletion'
          ? '-'
          : ' ';
        
        const symbolColor = line.type === 'addition'
          ? 'text-green-600 dark:text-green-400'
          : line.type === 'deletion'
          ? 'text-red-600 dark:text-red-400'
          : 'text-gray-400';

        return (
          <div
            key={index}
            className={cn(
              "border-l-4 px-3 py-1 flex items-start gap-3",
              bgColor,
              borderColor
            )}
          >
            {showLineNumbers && (
              <span className="text-gray-500 dark:text-gray-400 select-none min-w-[3ch] text-right">
                {line.lineNumber || index + 1}
              </span>
            )}
            <span className={cn("select-none", symbolColor)}>
              {symbol}
            </span>
            <code className="text-gray-800 dark:text-gray-200 flex-1 whitespace-pre">
              {line.content}
            </code>
          </div>
        );
      })}
    </div>
  );
};