import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SpamFilterOptions } from '@/lib/api/spam-filtered-feed';
import { useSpamTolerancePresets } from '@/hooks/use-spam-filtered-feed';

interface SpamFilterControlsProps {
  filterOptions: SpamFilterOptions;
  onFilterChange: (options: SpamFilterOptions) => void;
  spamStats?: {
    totalAnalyzed: number;
    spamCount: number;
    spamPercentage: number;
    distribution: {
      legitimate: number;
      warning: number;
      likelySpam: number;
      definiteSpam: number;
    };
  };
  className?: string;
}

export function SpamFilterControls({
  filterOptions,
  onFilterChange,
  spamStats,
  className,
}: SpamFilterControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const presets = useSpamTolerancePresets();

  // Determine current preset based on filter options
  const currentPreset = Object.entries(presets).find(([_, preset]) => {
    return (
      preset.options.maxSpamScore === filterOptions.maxSpamScore &&
      preset.options.includeSpam === filterOptions.includeSpam &&
      preset.options.includeUnreviewed === filterOptions.includeUnreviewed
    );
  })?.[1];

  const handlePresetSelect = (preset: typeof presets.strict) => {
    onFilterChange(preset.options);
  };

  const handleSliderChange = (value: number[]) => {
    onFilterChange({
      ...filterOptions,
      maxSpamScore: value[0],
    });
  };

  const getFilteredCount = () => {
    if (!spamStats) return null;
    
    const { distribution } = spamStats;
    let included = 0;
    
    if (filterOptions.maxSpamScore !== undefined) {
      if (filterOptions.maxSpamScore >= 76) included += distribution.definiteSpam;
      if (filterOptions.maxSpamScore >= 51) included += distribution.likelySpam;
      if (filterOptions.maxSpamScore >= 26) included += distribution.warning;
      included += distribution.legitimate;
    }
    
    return included;
  };

  const filteredCount = getFilteredCount();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Shield className="h-4 w-4" />
            <span>Spam Filter</span>
            {currentPreset && (
              <Badge variant="secondary" className="ml-1">
                {currentPreset.name}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96" align="end">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Spam Filter Settings
              </h4>
              <p className="text-sm text-muted-foreground">
                Control which pull requests appear in your feed
              </p>
            </div>

            {/* Spam Stats */}
            {spamStats && spamStats.totalAnalyzed > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Repository Statistics</p>
                    <p className="text-xs">
                      {spamStats.spamCount} of {spamStats.totalAnalyzed} PRs flagged as spam
                      ({spamStats.spamPercentage.toFixed(1)}%)
                    </p>
                    {filteredCount !== null && (
                      <p className="text-xs">
                        Current filter shows {filteredCount} of {spamStats.totalAnalyzed} analyzed PRs
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Preset Options */}
            <div className="space-y-2">
              <Label>Quick Settings</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(presets).map(([key, preset]) => (
                  <Button
                    key={key}
                    variant={currentPreset === preset ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePresetSelect(preset)}
                    className="justify-start"
                  >
                    <span className="text-xs">{preset.name}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Settings */}
            <div className="space-y-4 pt-2 border-t">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Max Spam Score</Label>
                  <span className="text-sm text-muted-foreground">
                    {filterOptions.maxSpamScore || 0}
                  </span>
                </div>
                <Slider
                  value={[filterOptions.maxSpamScore || 50]}
                  onValueChange={handleSliderChange}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Strict</span>
                  <span>Permissive</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="include-spam">Include Spam</Label>
                    <p className="text-xs text-muted-foreground">
                      Show PRs marked as definite spam
                    </p>
                  </div>
                  <Switch
                    id="include-spam"
                    checked={filterOptions.includeSpam || false}
                    onCheckedChange={(checked) =>
                      onFilterChange({ ...filterOptions, includeSpam: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="include-unreviewed">Include Unanalyzed</Label>
                    <p className="text-xs text-muted-foreground">
                      Show PRs not yet analyzed for spam
                    </p>
                  </div>
                  <Switch
                    id="include-unreviewed"
                    checked={filterOptions.includeUnreviewed !== false}
                    onCheckedChange={(checked) =>
                      onFilterChange({ ...filterOptions, includeUnreviewed: checked })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Score Guide */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs">Spam Score Guide</Label>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>0-25: Legitimate PRs</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span>26-50: Warning (possibly low quality)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span>51-75: Likely spam</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>76-100: Definite spam</span>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Current filter indicator */}
      {filterOptions.maxSpamScore !== undefined && filterOptions.maxSpamScore < 100 && (
        <Badge variant="outline" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Filtering active
        </Badge>
      )}
    </div>
  );
}