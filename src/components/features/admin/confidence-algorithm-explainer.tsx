import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  X, 
  Calculator,
  Shield, 
  Activity, 
  Clock,
  AlertTriangle
} from 'lucide-react';

interface AlgorithmWeights {
  privileged_events_weight: number;
  activity_patterns_weight: number;
  temporal_consistency_weight: number;
}

interface ConfidenceAlgorithmExplainerProps {
  weights?: AlgorithmWeights;
  onClose: () => void;
}

interface MockContributorInputs {
  privilegedEventCount: number;
  totalEventCount: number;
  uniqueEventTypes: number;
  detectionMethods: number;
  daysSinceLastSeen: number;
  daysSinceFirstSeen: number;
  activitySpreadDays: number;
}

export function ConfidenceAlgorithmExplainer({ weights, onClose }: ConfidenceAlgorithmExplainerProps) {
  const [inputs, setInputs] = useState<MockContributorInputs>({
    privilegedEventCount: 5,
    totalEventCount: 50,
    uniqueEventTypes: 4,
    detectionMethods: 2,
    daysSinceLastSeen: 7,
    daysSinceFirstSeen: 90,
    activitySpreadDays: 25
  });

  const currentWeights = weights || {
    privileged_events_weight: 0.4,
    activity_patterns_weight: 0.35,
    temporal_consistency_weight: 0.25
  };

  // Calculate confidence score using the inputs
  const calculateMockScore = () => {
    // Privileged Events Component
    const privilegedRatio = inputs.totalEventCount > 0 ? inputs.privilegedEventCount / inputs.totalEventCount : 0;
    const privilegedBoost = Math.min(1, inputs.privilegedEventCount / 10);
    const privilegedEventsScore = (privilegedRatio * 0.7 + privilegedBoost * 0.3);

    // Activity Patterns Component
    const eventDiversity = Math.min(1, inputs.uniqueEventTypes / 8);
    const methodDiversity = Math.min(1, inputs.detectionMethods / 5);
    const activityVolume = Math.min(1, Math.log10(inputs.totalEventCount + 1) / 2);
    const activityPatternsScore = (eventDiversity * 0.4 + methodDiversity * 0.4 + activityVolume * 0.2);

    // Temporal Consistency Component
    const recencyScore = inputs.daysSinceLastSeen <= 7 ? 1 :
                        inputs.daysSinceLastSeen <= 30 ? 0.8 :
                        inputs.daysSinceLastSeen <= 90 ? 0.6 : 0.4;
    
    const expectedDays = Math.min(inputs.daysSinceFirstSeen, 90);
    const consistencyRatio = expectedDays > 0 ? inputs.activitySpreadDays / expectedDays : 0;
    const consistencyScore = Math.min(1, consistencyRatio * 2);
    
    const longevityScore = Math.min(1, inputs.daysSinceFirstSeen / 180);
    const temporalConsistencyScore = (recencyScore * 0.4 + consistencyScore * 0.4 + longevityScore * 0.2);

    // Overall score
    const overall = (
      privilegedEventsScore * currentWeights.privileged_events_weight +
      activityPatternsScore * currentWeights.activity_patterns_weight +
      temporalConsistencyScore * currentWeights.temporal_consistency_weight
    );

    return {
      overall: Math.min(0.5, overall), // Capped at 50% as per existing algorithm
      components: {
        privilegedEvents: privilegedEventsScore,
        activityPatterns: activityPatternsScore,
        temporalConsistency: temporalConsistencyScore
      },
      factors: {
        eventDiversity,
        activityRecency: recencyScore,
        consistencyScore,
        privilegedRatio,
        privilegedBoost,
        methodDiversity,
        activityVolume,
        longevityScore
      }
    };
  };

  const score = calculateMockScore();

  const updateInput = (field: keyof MockContributorInputs, value: number) => {
    setInputs(prev => ({ ...prev, [field]: Math.max(0, value) }));
  };

  const getScoreColor = (value: number) => {
    const percentage = value * 100;
    if (percentage <= 5) return 'text-red-600';
    if (percentage <= 15) return 'text-orange-600';
    if (percentage <= 35) return 'text-blue-600';
    return 'text-green-600';
  };


  return (
    <Card className="border-2 border-blue-200 bg-blue-50/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Confidence Algorithm Explainer
            </CardTitle>
            <CardDescription>
              Interactive calculator showing how contributor confidence scores are calculated
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Algorithm Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How the Algorithm Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Privileged Events</span>
                  <Badge variant="secondary">{(currentWeights.privileged_events_weight * 100).toFixed(0)}%</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Admin actions, merge permissions, and high-privilege activities
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Activity Patterns</span>
                  <Badge variant="secondary">{(currentWeights.activity_patterns_weight * 100).toFixed(0)}%</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Event diversity, detection methods, and activity volume
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-600" />
                  <span className="font-medium">Temporal Consistency</span>
                  <Badge variant="secondary">{(currentWeights.temporal_consistency_weight * 100).toFixed(0)}%</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Activity recency, consistency over time, and contribution longevity
                </p>
              </div>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div>
                  <div className="font-medium text-amber-800">Important Note</div>
                  <p className="text-sm text-amber-700">
                    This algorithm measures the likelihood of outsider "self-selection" for contributions. 
                    It deliberately <strong>excludes maintainers</strong> from calculations and is capped at 50% to reflect realistic conversion rates.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interactive Calculator */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Try Different Values</CardTitle>
              <CardDescription>
                Adjust these parameters to see how they affect the confidence score
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="privileged-events">Privileged Events</Label>
                  <Input
                    id="privileged-events"
                    type="number"
                    value={inputs.privilegedEventCount}
                    onChange={(e) => updateInput('privilegedEventCount', parseInt(e.target.value) || 0)}
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Admin actions, merges, releases
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="total-events">Total Events</Label>
                  <Input
                    id="total-events"
                    type="number"
                    value={inputs.totalEventCount}
                    onChange={(e) => updateInput('totalEventCount', parseInt(e.target.value) || 0)}
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    All GitHub events (PRs, issues, comments, etc.)
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="event-types">Unique Event Types</Label>
                  <Input
                    id="event-types"
                    type="number"
                    value={inputs.uniqueEventTypes}
                    onChange={(e) => updateInput('uniqueEventTypes', parseInt(e.target.value) || 0)}
                    min="0"
                    max="10"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Diversity of activity types (max 8 for full score)
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="detection-methods">Detection Methods</Label>
                  <Input
                    id="detection-methods"
                    type="number"
                    value={inputs.detectionMethods}
                    onChange={(e) => updateInput('detectionMethods', parseInt(e.target.value) || 0)}
                    min="0"
                    max="5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Different ways privileged access was detected
                  </p>
                </div>
                
                <Separator />
                
                <div>
                  <Label htmlFor="days-since-last">Days Since Last Activity</Label>
                  <Input
                    id="days-since-last"
                    type="number"
                    value={inputs.daysSinceLastSeen}
                    onChange={(e) => updateInput('daysSinceLastSeen', parseInt(e.target.value) || 0)}
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Recent activity is weighted higher
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="days-since-first">Days Since First Activity</Label>
                  <Input
                    id="days-since-first"
                    type="number"
                    value={inputs.daysSinceFirstSeen}
                    onChange={(e) => updateInput('daysSinceFirstSeen', parseInt(e.target.value) || 0)}
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Longer history shows commitment (180 days = full score)
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="activity-spread">Activity Spread (Days)</Label>
                  <Input
                    id="activity-spread"
                    type="number"
                    value={inputs.activitySpreadDays}
                    onChange={(e) => updateInput('activitySpreadDays', parseInt(e.target.value) || 0)}
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    How many unique days the contributor was active
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Display */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Calculated Score</CardTitle>
              <CardDescription>
                Live calculation based on your inputs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Overall Score */}
              <div className="text-center">
                <div className={`text-4xl font-bold ${getScoreColor(score.overall)}`}>
                  {(score.overall * 100).toFixed(1)}%
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Overall Confidence Score
                </p>
                <div className="mt-2">
                  <Progress 
                    value={score.overall * 100} 
                    className="h-3"
                  />
                </div>
              </div>

              {/* Component Breakdown */}
              <div className="space-y-4">
                <h4 className="font-medium">Component Breakdown</h4>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2">
                        <Shield className="h-3 w-3" />
                        Privileged Events
                      </span>
                      <span className="font-medium">{(score.components.privilegedEvents * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={score.components.privilegedEvents * 100} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Ratio: {(score.factors.privilegedRatio * 100).toFixed(1)}% + Boost: {(score.factors.privilegedBoost * 100).toFixed(1)}%
                    </p>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2">
                        <Activity className="h-3 w-3" />
                        Activity Patterns
                      </span>
                      <span className="font-medium">{(score.components.activityPatterns * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={score.components.activityPatterns * 100} className="h-2" />
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <div>Event Diversity: {(score.factors.eventDiversity * 100).toFixed(1)}%</div>
                      <div>Method Diversity: {(score.factors.methodDiversity * 100).toFixed(1)}%</div>
                      <div>Activity Volume: {(score.factors.activityVolume * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        Temporal Consistency
                      </span>
                      <span className="font-medium">{(score.components.temporalConsistency * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={score.components.temporalConsistency * 100} className="h-2" />
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <div>Recency: {(score.factors.activityRecency * 100).toFixed(1)}%</div>
                      <div>Consistency: {(score.factors.consistencyScore * 100).toFixed(1)}%</div>
                      <div>Longevity: {(score.factors.longevityScore * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Score Interpretation */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm">
                  <div className="font-medium mb-2">Score Interpretation:</div>
                  {score.overall * 100 <= 5 && (
                    <p className="text-red-600">Critical - Very low likelihood of external contribution</p>
                  )}
                  {score.overall * 100 > 5 && score.overall * 100 <= 15 && (
                    <p className="text-orange-600">Low - Few external contributors are likely to contribute</p>
                  )}
                  {score.overall * 100 > 15 && score.overall * 100 <= 35 && (
                    <p className="text-blue-600">Medium - Some external contributors may contribute</p>
                  )}
                  {score.overall * 100 > 35 && (
                    <p className="text-green-600">Good - External contributors are more likely to contribute</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}