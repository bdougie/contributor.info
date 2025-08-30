import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Crown, 
  Trophy, 
  Brain, 
  Sparkles, 
  Target,
  Activity,
  Users,
  Star,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { AIEnhancedContributorProfile } from '@/lib/analytics/ai-contributor-analyzer';
import type { AIContributorInsight } from '@/lib/llm/analytics-openai-service';

export interface ChampionContributorListProps {
  profiles: AIEnhancedContributorProfile[];
  showInsights?: boolean;
  maxChampions?: number;
  className?: string;
}

export function ChampionContributorList({ 
  profiles, 
  showInsights = true, 
  maxChampions = 5,
  className 
}: ChampionContributorListProps) {
  const [expandedChampion, setExpandedChampion] = useState<string | null>(null);

  // Filter and sort champions by overall score and AI confidence
  const champions = profiles
    .filter(profile => profile.impactLevel === 'champion')
    .sort((a, b) => {
      // Primary sort: overall score
      if (b.overallScore !== a.overallScore) {
        return b.overallScore - a.overallScore;
      }
      // Secondary sort: AI confidence
      return b.aiConfidence - a.aiConfidence;
    })
    .slice(0, maxChampions);

  if (champions.length === 0) {
    return (
      <Card className={cn('', className)}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            <span>Champion Contributors</span>
          </CardTitle>
          <CardDescription>Top-performing contributors with exceptional impact</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Crown className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No champions yet</p>
            <p className="text-sm">Champions emerge as contributors demonstrate sustained excellence</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleToggleExpanded = (login: string) => {
    setExpandedChampion(expandedChampion === login ? null : login);
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              <span>Champion Contributors</span>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                <Trophy className="h-3 w-3 mr-1" />
                {champions.length} champions
              </Badge>
            </CardTitle>
            <CardDescription>
              Top-performing contributors with exceptional impact and sustained excellence
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Champions List */}
        <div className="space-y-4">
          {champions.map((profile, index) => (
            <ChampionCard
              key={profile.login}
              profile={profile}
              rank={index + 1}
              isExpanded={expandedChampion === profile.login}
              onToggleExpanded={() => handleToggleExpanded(profile.login)}
              showInsights={showInsights}
            />
          ))}
        </div>

        {/* Summary Statistics */}
        {champions.length > 1 && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Activity className="h-4 w-4 mr-2" />
              Champion Excellence Metrics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryMetric
                icon={Trophy}
                label="Avg Score"
                value={Math.round(champions.reduce((sum, p) => sum + p.overallScore, 0) / champions.length)}
                suffix=""
                color="yellow"
              />
              <SummaryMetric
                icon={Brain}
                label="AI Confidence"
                value={Math.round(champions.reduce((sum, p) => sum + p.aiConfidence * 100, 0) / champions.length)}
                suffix="%"
                color="blue"
              />
              <SummaryMetric
                icon={Target}
                label="Avg Consistency"
                value={Math.round(champions.reduce((sum, p) => sum + p.consistency.consistencyScore, 0) / champions.length)}
                suffix="%"
                color="green"
              />
              <SummaryMetric
                icon={Users}
                label="High Priority"
                value={champions.filter(p => p.celebrationPriority === 'high').length}
                suffix=""
                color="purple"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ChampionCardProps {
  profile: AIEnhancedContributorProfile;
  rank: number;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  showInsights: boolean;
}

function ChampionCard({ profile, rank, isExpanded, onToggleExpanded, showInsights }: ChampionCardProps) {
  const impactNarrative = profile.aiInsights.impactNarrative;
  const achievementStory = profile.aiInsights.achievementStory;
  const confidencePercentage = Math.round(profile.aiConfidence * 100);

  // Determine crown color based on rank
  const getCrownColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-yellow-500';
      case 2: return 'text-gray-400';
      case 3: return 'text-orange-500';
      default: return 'text-purple-500';
    }
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-yellow-100 text-yellow-900 border-yellow-300';
      case 2: return 'bg-gray-100 text-gray-900 border-gray-300';
      case 3: return 'bg-orange-100 text-orange-900 border-orange-300';
      default: return 'bg-purple-100 text-purple-900 border-purple-300';
    }
  };

  return (
    <div className="border rounded-lg bg-gradient-to-r from-yellow-50 via-white to-orange-50">
      {/* Main Champion Info */}
      <div className="p-4">
        <div className="flex items-start space-x-4">
          {/* Rank Badge */}
          <div className="flex-shrink-0">
            <Badge 
              variant="outline" 
              className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg border-2',
                getRankBadgeColor(rank)
              )}
            >
              {rank}
            </Badge>
          </div>

          {/* Avatar */}
          <Avatar className="h-16 w-16 border-2 border-yellow-200">
            <AvatarImage src={profile.avatar_url} alt={profile.login} />
            <AvatarFallback className="bg-yellow-100 text-yellow-800 font-bold">
              {profile.login.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {/* Champion Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-bold text-gray-900">{profile.login}</h3>
                <Crown className={cn('h-5 w-5', getCrownColor(rank))} />
                {rank === 1 && <Sparkles className="h-4 w-4 text-yellow-500" />}
              </div>
              
              <div className="flex items-center space-x-2">
                <Badge 
                  variant={profile.celebrationPriority === 'high' ? 'default' : 'secondary'}
                  className={cn(
                    profile.celebrationPriority === 'high' && 'bg-green-100 text-green-800'
                  )}
                >
                  {profile.celebrationPriority} priority
                </Badge>
                
                {showInsights && (impactNarrative || achievementStory) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleExpanded}
                    className="h-8 w-8 p-0"
                  >
                    {isExpanded ? 
                      <ChevronUp className="h-4 w-4" /> : 
                      <ChevronDown className="h-4 w-4" />
                    }
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <div className="text-2xl font-bold text-yellow-600">{profile.overallScore}</div>
                <div className="text-sm text-gray-600">Impact Score</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{confidencePercentage}%</div>
                <div className="text-sm text-gray-600">AI Confidence</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{profile.consistency.consistencyScore}</div>
                <div className="text-sm text-gray-600">Consistency</div>
              </div>
            </div>

            {/* Key Achievements */}
            <div className="flex flex-wrap gap-2">
              <AchievementBadge
                icon={Activity}
                label={`${profile.classification.trustLevel} trust`}
                color="blue"
              />
              <AchievementBadge
                icon={Target}
                label={`${profile.classification.trustIndicators.codeReviewParticipation}% reviews`}
                color="green"
              />
              <AchievementBadge
                icon={Star}
                label={`${profile.consistency.activityPattern.longestActiveStreak}d streak`}
                color="purple"
              />
              <AchievementBadge
                icon={Users}
                label={profile.classification.contributorType}
                color="orange"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Expanded AI Insights */}
      {isExpanded && showInsights && (
        <div className="border-t bg-gradient-to-r from-blue-50 to-purple-50 p-4 space-y-4">
          {impactNarrative && (
            <AIInsightCard 
              title="Impact Analysis"
              narrative={impactNarrative}
              icon={Target}
              color="blue"
            />
          )}
          
          {achievementStory && (
            <AIInsightCard 
              title="Achievement Story"
              narrative={achievementStory}
              icon={Trophy}
              color="yellow"
            />
          )}
          
          {/* Quick Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-blue-200">
            <div className="text-sm text-gray-600">
              Analyzed by {impactNarrative?.aiModel} • Updated {profile.lastAnalyzed.toLocaleDateString()}
            </div>
            <Button variant="outline" size="sm" className="h-8">
              <ExternalLink className="h-3 w-3 mr-2" />
              View Profile
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface AIInsightCardProps {
  title: string;
  narrative: AIContributorInsight;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'yellow' | 'green' | 'purple';
}

function AIInsightCard({ title, narrative, icon: Icon, color }: AIInsightCardProps) {
  const colorClasses = {
    blue: 'border-blue-200 bg-blue-50',
    yellow: 'border-yellow-200 bg-yellow-50',
    green: 'border-green-200 bg-green-50',
    purple: 'border-purple-200 bg-purple-50'
  };

  const textColorClasses = {
    blue: 'text-blue-900',
    yellow: 'text-yellow-900',
    green: 'text-green-900',
    purple: 'text-purple-900'
  };

  return (
    <div className={cn('p-3 rounded border', colorClasses[color])}>
      <div className="flex items-center space-x-2 mb-2">
        <Icon className={cn('h-4 w-4', textColorClasses[color])} />
        <span className={cn('font-medium text-sm', textColorClasses[color])}>{title}</span>
        <Badge variant="outline" className="text-xs">
          {Math.round(narrative.confidence * 100)}% confident
        </Badge>
      </div>
      
      <p className={cn('text-sm leading-relaxed mb-2', textColorClasses[color])}>
        {narrative.narrative}
      </p>
      
      {narrative.evidence.length > 0 && (
        <div className="space-y-1">
          <div className={cn('text-xs font-medium', textColorClasses[color])}>Key Evidence:</div>
          <ul className="space-y-1">
            {narrative.evidence.slice(0, 2).map((evidence, index) => (
              <li key={index} className={cn('text-xs flex items-start', textColorClasses[color])}>
                <Sparkles className={cn('h-3 w-3 mr-1 mt-0.5 flex-shrink-0', textColorClasses[color])} />
                {evidence}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface AchievementBadgeProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function AchievementBadge({ icon: Icon, label, color }: AchievementBadgeProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    purple: 'bg-purple-100 text-purple-800',
    orange: 'bg-orange-100 text-orange-800'
  };

  return (
    <Badge variant="secondary" className={cn('text-xs', colorClasses[color])}>
      <Icon className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}

interface SummaryMetricProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  suffix: string;
  color: 'yellow' | 'blue' | 'green' | 'purple';
}

function SummaryMetric({ icon: Icon, label, value, suffix, color }: SummaryMetricProps) {
  const colorClasses = {
    yellow: 'text-yellow-600',
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600'
  };

  return (
    <div className="text-center">
      <div className="flex items-center justify-center mb-2">
        <Icon className={cn('h-5 w-5', colorClasses[color])} />
      </div>
      <div className={cn('text-2xl font-bold', colorClasses[color])}>
        {value}{suffix}
      </div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}