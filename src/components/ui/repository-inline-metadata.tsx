import { RepositorySizeBadge } from './repository-size-badge';
import { DataFreshnessIndicator } from './data-freshness-indicator';
import { useRepositoryMetadata } from '@/hooks/use-repository-metadata';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface RepositoryInlineMetadataProps {
  owner?: string;
  repo?: string;
  className?: string;
}

export function RepositoryInlineMetadata({
  owner,
  repo,
  className,
}: RepositoryInlineMetadataProps) {
  const { metadata, loading } = useRepositoryMetadata(owner, repo);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-6 h-5 bg-muted animate-pulse rounded flex items-center"></div>
        <div className="w-2 h-2 bg-muted animate-pulse rounded-full"></div>
      </div>
    );
  }

  if (!meta_data) {
    return null;
  }

  const getSizeTooltip = () => {
    switch (meta_data.size) {
      case 'xl':
        return 'Extra Large Repository\n\n• High activity level\n• Uses aggressive rate limiting\n• Chunked processing (3-day windows)\n• Background capture prioritized';
      case 'large':
        return 'Large Repository\n\n• Significant activity level\n• Chunked processing (7-day windows)\n• Balanced rate limiting\n• Background processing optimized';
      case 'medium':
        return 'Medium Repository\n\n• Moderate activity level\n• Standard processing approach\n• 14-day data windows\n• Balanced resource usage';
      case 'small':
        return 'Small Repository\n\n• Lower activity level\n• Comprehensive processing\n• 30-day data windows\n• Real-time updates available';
      default:
        return 'Repository Size Unknown\n\nClassification pending...\nWill be determined on next data fetch.';
    }
  };

  const getFreshnessTooltip = () => {
    const timeInfo = metadata.lastDataUpdate
      ? `\n\nLast updated: ${new Date(meta_data.lastDataUpdate).toLocaleString()}`
      : '\n\nNo recent updates found';

    switch (metadata._dataFreshness) {
      case 'fresh':
        return `Fresh Data\n\n• Updated within 24 hours\n• Data is current and reliable\n• No refresh needed${timeInfo}`;
      case 'stale':
        return `Stale Data\n\n• 1-7 days old\n• Consider refreshing for latest activity\n• Still generally reliable${timeInfo}`;
      case 'old':
        return `Old Data\n\n• More than 7 days old\n• Refresh recommended\n• May miss recent activity${timeInfo}`;
      default:
        return `Data Age Unknown${timeInfo}`;
    }
  };

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-2 ${className || ''}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              <RepositorySizeBadge size={metadata.size} />
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs whitespace-pre-line">
            {getSizeTooltip()}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center h-5">
              <DataFreshnessIndicator
                freshness={metadata.dataFreshness}
                lastUpdate={metadata.lastDataUpdate}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs whitespace-pre-line">
            {getFreshnessTooltip()}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
