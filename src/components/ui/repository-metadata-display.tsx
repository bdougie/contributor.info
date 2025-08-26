import { RepositorySizeBadge } from './repository-size-badge';
import { DataFreshnessIndicator } from './data-freshness-indicator';
import { useRepositoryMetadata } from '@/hooks/use-repository-metadata';
import { cn } from '@/lib/utils';

interface RepositoryMetadataDisplayProps {
  owner?: string;
  repo?: string;
  className?: string;
  showLabels?: boolean;
}

export function RepositoryMetadataDisplay({
  owner,
  repo,
  className,
  showLabels = false,
}: RepositoryMetadataDisplayProps) {
  const { metadata, loading } = useRepositoryMetadata(owner, repo);

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="w-6 h-4 bg-muted animate-pulse rounded"></div>
        <div className="w-3 h-3 bg-muted animate-pulse rounded-full"></div>
      </div>
    );
  }

  if (!meta_data) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <RepositorySizeBadge size={metadata.size} />
      <DataFreshnessIndicator
        freshness={metadata.dataFreshness}
        lastUpdate={metadata.lastDataUpdate}
        showLabel={showLabels}
      />
    </div>
  );
}
