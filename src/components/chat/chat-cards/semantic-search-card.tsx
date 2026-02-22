import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, ExternalLink, GitPullRequest, MessageSquare } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { SemanticSearchData, SemanticSearchItemData } from '../types';

const typeColors: Record<string, string> = {
  PR: 'border-purple-500/50 bg-purple-500/5',
  issue: 'border-green-500/50 bg-green-500/5',
  discussion: 'border-blue-500/50 bg-blue-500/5',
};

function getTypeIcon(type: string) {
  switch (type) {
    case 'PR':
      return <GitPullRequest className="h-4 w-4 text-purple-500" />;
    case 'issue':
      return <MessageSquare className="h-4 w-4 text-green-500" />;
    default:
      return <MessageSquare className="h-4 w-4 text-blue-500" />;
  }
}

function getStateColor(state: string): string {
  if (state === 'open') return 'bg-green-100 text-green-700 border-green-200';
  if (state === 'merged') return 'bg-purple-100 text-purple-700 border-purple-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

function getSimilarityColor(pct: number): string {
  if (pct >= 70) return 'bg-green-100 text-green-700 border-green-200';
  if (pct >= 50) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

function SimilarityBadge({ similarity }: { similarity: number }) {
  const pct = Math.round(similarity * 100);

  return (
    <Badge variant="outline" className={cn('text-xs', getSimilarityColor(pct))}>
      {pct}% match
    </Badge>
  );
}

function SearchResultItem({ item }: { item: SemanticSearchItemData }) {
  return (
    <Card
      className={cn(
        'p-3 cursor-pointer hover:shadow-md transition-all',
        typeColors[item.type] ?? 'border-gray-500/50 bg-gray-500/5'
      )}
      onClick={() => window.open(item.url, '_blank')}
    >
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          {getTypeIcon(item.type)}
          <span className="text-sm font-medium">
            {item.type} #{item.number}
          </span>
          <SimilarityBadge similarity={item.similarity} />
          <Badge variant="outline" className={cn('text-xs', getStateColor(item.state))}>
            {item.state}
          </Badge>
        </div>
        <h4 className="text-sm font-medium line-clamp-1">{item.title}</h4>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {item.author && <span>by @{item.author}</span>}
          {item.age && <span>{item.age}</span>}
          <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
        </div>
        {item.bodyPreview && (
          <p className="text-xs text-muted-foreground line-clamp-2 italic">{item.bodyPreview}</p>
        )}
      </div>
    </Card>
  );
}

interface SemanticSearchCardProps {
  data: SemanticSearchData;
}

export function SemanticSearchCard({ data }: SemanticSearchCardProps) {
  if (!data.items || data.items.length === 0) {
    return (
      <Card className="p-3 bg-muted/50 border-muted">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No related items found.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Search className="h-3 w-3" />
        <span>
          {data.items.length} related {data.items.length === 1 ? 'item' : 'items'} found
        </span>
      </div>
      {data.items.map((item) => (
        <SearchResultItem key={`${item.type}-${item.number}`} item={item} />
      ))}
    </div>
  );
}
