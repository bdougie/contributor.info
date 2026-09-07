import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ReviewHunk as Hunk } from '@/types/review-labels';

export function ReviewHunk({ hunk }: { hunk: Hunk }) {
  let oldLine = 0,
    newLine = 0;
  return (
    <Card className="min-w-0 overflow-hidden" aria-label={`Code hunk in ${hunk.path}`}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 border-b bg-muted/50 p-4">
        <code className="break-all text-sm">{hunk.path}</code>
        <Badge variant="outline">{hunk.language}</Badge>
      </CardHeader>
      <CardContent
        className="overflow-x-auto p-0"
        tabIndex={0}
        aria-label="Scrollable original code diff"
      >
        <div className="w-max min-w-full py-2 font-mono text-xs leading-6">
          {hunk.diff.split('\n').map((line, index) => {
            const header = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)/);
            if (header) {
              oldLine = Number(header[1]);
              newLine = Number(header[2]);
              return (
                <div key={index} className="bg-muted/50 px-4 py-2 text-muted-foreground">
                  {line}
                </div>
              );
            }
            const added = line.startsWith('+'),
              removed = line.startsWith('-');
            const metadata = line.startsWith('\\') || line === '';
            return (
              <div
                key={index}
                className={cn(
                  'flex pr-4',
                  added && 'bg-green-500/10 text-green-700 dark:text-green-300',
                  removed && 'bg-red-500/10 text-red-700 dark:text-red-300'
                )}
              >
                <span className="w-10 shrink-0 select-none pr-2 text-right text-muted-foreground">
                  {added || metadata ? '' : oldLine++}
                </span>
                <span className="w-10 shrink-0 select-none pr-2 text-right text-muted-foreground">
                  {removed || metadata ? '' : newLine++}
                </span>
                <code className="whitespace-pre">{line}</code>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
