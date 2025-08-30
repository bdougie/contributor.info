import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  Star, 
  Brain, 
  Sparkles, 
  Target,
  Activity,
  Trophy,
  Users,
  Zap
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { AIEnhancedContributorProfile } from '@/lib/analytics/ai-contributor-analyzer';
import type { AIContributorInsight } from '@/lib/llm/analytics-openai-service';

export interface RisingStarIndicatorProps {
  profiles: AIEnhancedContributorProfile[];
  showDetails?: boolean;
  className?: string;
  maxStars?: number;
}

export function RisingStarIndicator({ 
  profiles, 
  showDetails = true, 
  className,
  maxStars = 3 
}: RisingStarIndicatorProps) {
  // Filter and sort rising stars by their overall score and AI confidence
  const risingStars = profiles
    .filter(profile => profile.impactLevel === 'rising-star')
    .sort((a, b) => {
      // Primary sort: overall score
      if (b.overallScore !== a.overallScore) {
        return b.overallScore - a.overallScore;
      }
      // Secondary sort: AI confidence
      return b.aiConfidence - a.aiConfidence;
    })
    .slice(0, maxStars);

  if (risingStars.length === 0) {
    return (
      <Card className={cn('', className)}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Star className="h-5 w-5 text-yellow-500" />
            <span>Rising Stars</span>
          </CardTitle>
          <CardDescription>Contributors showing exceptional growth potential</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-gray-500">
            <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No rising stars identified yet</p>
            <p className="text-sm">Check back as your community grows!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <span>Rising Stars</span>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                <Sparkles className="h-3 w-3 mr-1" />
                {risingStars.length} identified
              </Badge>
            </CardTitle>
            <CardDescription>Contributors showing exceptional growth potential</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Rising Stars List */}
        <div className="space-y-4">
          {risingStars.map((profile, index) => (
            <RisingStarCard 
              key={profile.login}
              profile={profile}
              rank={index + 1}
              showDetails={showDetails}
            />
          ))}
        </div>

        {/* Summary Metrics */}
        {risingStars.length > 1 && (
          <div className="border-t pt-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {Math.round(risingStars.reduce((sum, p) => sum + p.overallScore, 0) / risingStars.length)}
                </div>
                <div className="text-sm text-gray-600">Avg Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(risingStars.reduce((sum, p) => sum + p.aiConfidence * 100, 0) / risingStars.length)}%
                </div>
                <div className="text-sm text-gray-600">AI Confidence</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {risingStars.filter(p => p.celebrationPriority === 'high').length}
                </div>
                <div className="text-sm text-gray-600">High Priority</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RisingStarCardProps {
  profile: AIEnhancedContributorProfile;
  rank: number;
  showDetails: boolean;
}

function RisingStarCard({ profile, rank, showDetails }: RisingStarCardProps) {
  const impactNarrative = profile.aiInsights.impactNarrative;
  const consistencyScore = profile.consistency.consistencyScore;
  const confidencePercentage = Math.round(profile.aiConfidence * 100);

  return (
    <div className="flex items-start space-x-4 p-4 bg-gradient-to-r from-yellow-50 to-blue-50 rounded-lg border">
      {/* Rank Badge */}
      <div className="flex-shrink-0">
        <Badge 
          variant="secondary" 
          className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center font-bold',
            rank === 1 && 'bg-yellow-200 text-yellow-900',
            rank === 2 && 'bg-gray-200 text-gray-900', 
            rank === 3 && 'bg-orange-200 text-orange-900'
          )}
        >
          {rank}
        </Badge>
      </div>

      {/* Avatar */}
      <Avatar className="h-12 w-12">
        <AvatarImage src={profile.avatar_url} alt={profile.login} />
        <AvatarFallback>{profile.login.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold text-gray-900">{profile.login}</h3>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Trophy className="h-3 w-3" />
              <span>Score: {profile.overallScore}</span>
              <span>•</span>
              <Brain className="h-3 w-3" />
              <span>{confidencePercentage}% AI confidence</span>
            </div>
          </div>
          
          <Badge 
            variant={profile.celebrationPriority === 'high' ? 'default' : 'secondary'}
            className={cn(
              profile.celebrationPriority === 'high' && 'bg-green-100 text-green-800'
            )}
          >
            {profile.celebrationPriority} priority
          </Badge>
        </div>

        {/* Progress Indicators */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Overall Impact</span>
            <span className="font-medium">{profile.overallScore}%</span>
          </div>
          <Progress value={profile.overallScore} className="h-2" />
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Consistency</span>
            <span className="font-medium">{consistencyScore}%</span>
          </div>
          <Progress value={consistencyScore} className="h-2" />
        </div>

        {/* AI Insights */}
        {showDetails && impactNarrative && (
          <AIInsightSection narrative={impactNarrative} />
        )}

        {/* Key Metrics Row */}
        <div className="grid grid-cols-4 gap-3 mt-3 pt-3 border-t border-yellow-200">
          <MetricBadge
            icon={Activity}
            label="Trust"
            value={profile.classification.trustLevel}
            color="blue"
          />
          <MetricBadge
            icon={Users}
            label="Type"
            value={profile.classification.contributorType}
            color="green"
          />
          <MetricBadge
            icon={Zap}
            label="Streak"
            value={`${profile.consistency.activityPattern.longestActiveStreak}d`}
            color="purple"
          />
          <MetricBadge
            icon={Target}
            label="Reviews"
            value={`${profile.classification.trustIndicators.codeReviewParticipation}%`}
            color="orange"
          />
        </div>
      </div>
    </div>
  );
}

interface AIInsightSectionProps {
  narrative: AIContributorInsight;
}

function AIInsightSection({ narrative }: AIInsightSectionProps) {
  return (
    <div className="bg-white bg-opacity-50 p-3 rounded border border-blue-200">
      <div className="flex items-center space-x-2 mb-2">
        <Brain className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-900">AI Growth Analysis</span>
        <Badge variant="outline" className="text-xs">
          {Math.round(narrative.confidence * 100)}% confident
        </Badge>
      </div>
      
      <p className="text-sm text-blue-800 leading-relaxed mb-2">
        {narrative.narrative}
      </p>
      
      {narrative.recommendations.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-blue-900">Growth Recommendations:</div>
          <ul className="space-y-1">
            {narrative.recommendations.slice(0, 2).map((rec, index) => (
              <li key={index} className="text-xs text-blue-700 flex items-start">
                <Sparkles className="h-3 w-3 mr-1 mt-0.5 text-blue-500 flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface MetricBadgeProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function MetricBadge({ icon: Icon, label, value, color }: MetricBadgeProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200'
  };

  return (
    <div className={cn(
      'flex flex-col items-center p-2 rounded border text-center',
      colorClasses[color]
    )}>
      <Icon className="h-3 w-3 mb-1" />
      <div className="text-xs font-medium">{value}</div>
      <div className="text-xs opacity-75">{label}</div>
    </div>
  );
}