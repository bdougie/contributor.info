import { Calendar, Info } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface IssueVolumeData {
  current: number;
  previous: number;
  change: number;
  dailyIssues?: { date: string; count: number }[]; // Daily breakdown for calendar
}

interface IssueVolumeCalendarCardProps {
  volumeData: IssueVolumeData;
  loading?: boolean;
}

export function IssueVolumeCalendarCard({ volumeData, loading }: IssueVolumeCalendarCardProps) {
  if (loading) {
    return (
      <Card className="p-3 min-w-0">
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  }

  // Generate last 14 days of data (2 weeks), arranged Sunday to Saturday
  const days = [];
  const today = new Date();

  // Get the most recent Sunday (start of current week)
  const currentSunday = new Date(today);
  currentSunday.setDate(today.getDate() - today.getDay());

  // Generate 14 days starting from Sunday two weeks ago
  for (let i = 13; i >= 0; i--) {
    const date = new Date(currentSunday);
    date.setDate(currentSunday.getDate() - i);

    // Find count for this date
    const dateStr = date.toISOString().split('T')[0];
    const dayData = volumeData.dailyIssues?.find((d) => d.date.startsWith(dateStr));
    const count = dayData?.count || 0;

    days.push({
      date,
      count,
      dayName: date.toLocaleDateString('en-US', { weekday: 'narrow' }),
    });
  }

  // Calculate max count for opacity scaling
  const maxCount = Math.max(...days.map((d) => d.count));

  return (
    <TooltipProvider>
      <Card className="p-3 min-w-0">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium truncate">Weekly Issue Volume</h4>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex">
                <Info className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-pointer" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                Shows the last 2 weeks. Top row is last week, bottom row is this week. Deeper orange
                indicates more issues created that day.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Calendar grid - 2 rows of 7 days */}
        <div className="space-y-1 mb-3">
          {/* First week */}
          <div className="flex gap-1">
            {days.slice(0, 7).map((day, index) => {
              // Calculate opacity based on issue count (deeper orange = more issues)
              let opacity = 0.1;
              if (maxCount > 0) {
                opacity = 0.1 + (day.count / maxCount) * 0.8; // Range from 0.1 to 0.9
              }

              return (
                <div
                  key={index}
                  className="w-4 h-4 rounded-sm border border-gray-200 flex items-center justify-center"
                  style={{
                    backgroundColor: `rgba(251, 146, 60, ${opacity})`, // Orange-400
                  }}
                  title={`${day.date.toLocaleDateString()}: ${day.count} issues`}
                />
              );
            })}
          </div>

          {/* Second week */}
          <div className="flex gap-1">
            {days.slice(7, 14).map((day, index) => {
              // Calculate opacity based on issue count (deeper orange = more issues)
              let opacity = 0.1;
              if (maxCount > 0) {
                opacity = 0.1 + (day.count / maxCount) * 0.8; // Range from 0.1 to 0.9
              }

              return (
                <div
                  key={index + 7}
                  className="w-4 h-4 rounded-sm border border-gray-200 flex items-center justify-center"
                  style={{
                    backgroundColor: `rgba(251, 146, 60, ${opacity})`, // Orange-400
                  }}
                  title={`${day.date.toLocaleDateString()}: ${day.count} issues`}
                />
              );
            })}
          </div>
        </div>

        {/* Week day labels */}
        <div className="flex gap-1 mb-3">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
            <div key={index} className="w-4 text-xs text-muted-foreground text-center">
              {label}
            </div>
          ))}
        </div>

        {/* Current week count and change percentage at bottom */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">This week</span>
            <span className="text-sm font-medium">{volumeData.current} issues</span>
          </div>
          {volumeData.change !== 0 && (
            <div className="flex items-center justify-center">
              <p
                className={cn(
                  'text-xs font-medium',
                  volumeData.change > 0 ? 'text-green-500' : 'text-red-500'
                )}
              >
                {volumeData.change > 0 ? '+' : ''}
                {Math.round(volumeData.change)}% change
              </p>
            </div>
          )}
        </div>
      </Card>
    </TooltipProvider>
  );
}
