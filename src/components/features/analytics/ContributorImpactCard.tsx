import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  Star, 
  Trophy as Award, 
  MessageCircle, 
  ExternalLink,
  Sparkles,
  Brain
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { AIEnhancedContributorProfile } from '@/lib/analytics/ai-contributor-analyzer';

interface ContributorImpactCardProps {
  profile: AIEnhancedContributorProfile;
  rank?: number;
  showFullInsights?: boolean;
  onViewProfile?: (login: string) => void;
  className?: string;
}

export function ContributorImpactCard({
  profile,
  rank,
  showFullInsights = false,
  onViewProfile,
  className
}: ContributorImpactCardProps) {
  const impactNarrative = profile.aiInsights.impactNarrative;
  const achievementStory = profile.aiInsights.achievementStory;
  const hasAIInsights = impactNarrative || achievementStory;

  // Format impact level for display
  const getImpactLevelDisplay = (level: string) => {
    switch (level) {
      case 'champion': return { label: 'Champion', color: 'bg-yellow-500', icon: Award };
      case 'rising-star': return { label: 'Rising Star', color: 'bg-blue-500', icon: Star };
      case 'solid-contributor': return { label: 'Contributor', color: 'bg-green-500', icon: TrendingUp };
      case 'newcomer': return { label: 'Newcomer', color: 'bg-gray-500', icon: MessageCircle };
      default: return { label: 'Contributor', color: 'bg-gray-500', icon: MessageCircle };
    }
  };

  // Get celebration priority styling
  const getCelebrationStyling = (priority: string) => {
    switch (priority) {
      case 'high': return 'ring-2 ring-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50';
      case 'medium': return 'ring-1 ring-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50';
      default: return 'bg-white';
    }
  };

  const impactDisplay = getImpactLevelDisplay(profile.impactLevel);
  const ImpactIcon = impactDisplay.icon;

  return (
    <Card className={cn(
      'transition-all duration-200 hover:shadow-md',
      getCelebrationStyling(profile.celebrationPriority),
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {rank && (
              <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full text-sm font-bold text-gray-600">
                {rank}
              </div>
            )}
            
            <Avatar className="h-12 w-12">
              <AvatarImage 
                src={profile.avatar_url} 
                alt={`${profile.login}'s avatar`}
              />
              <AvatarFallback>
                {profile.login.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-semibold truncate">
                @{profile.login}
              </CardTitle>
              <div className="flex items-center space-x-2 mt-1">
                <Badge 
                  variant="secondary" 
                  className={cn('text-white', impactDisplay.color)}
                >
                  <ImpactIcon className="h-3 w-3 mr-1" />
                  {impactDisplay.label}
                </Badge>
                
                {profile.celebrationPriority === 'high' && (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Celebrate
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {profile.overallScore}
            </div>
            <div className="text-xs text-gray-500">
              Impact Score
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-600">
              {profile.consistency.consistencyScore}%
            </div>
            <div className="text-xs text-gray-500">
              Consistency
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-semibold text-green-600">
              {profile.classification.trustLevel}
            </div>
            <div className="text-xs text-gray-500">
              Trust Level
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-semibold text-purple-600">
              {Math.round(profile.classification.classificationConfidence * 100)}%
            </div>
            <div className="text-xs text-gray-500">
              Confidence
            </div>
          </div>
        </div>

        {/* AI Insights Section */}
        {hasAIInsights && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Brain className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-700">AI Insights</span>
              {profile.aiConfidence > 0 && (
                <Badge variant="outline" className="text-xs">
                  {Math.round(profile.aiConfidence * 100)}% confidence
                </Badge>
              )}
            </div>

            {/* Impact Narrative */}
            {impactNarrative && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Impact Story</h4>
                <p className="text-sm text-blue-800 leading-relaxed">
                  {showFullInsights 
                    ? impactNarrative.narrative 
                    : `${impactNarrative.narrative.slice(0, 120)}${impactNarrative.narrative.length > 120 ? '...' : ''}`
                  }
                </p>
                
                {impactNarrative.evidence.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-blue-700 mb-1">Key Evidence:</div>
                    <ul className="text-xs text-blue-700 space-y-1">
                      {impactNarrative.evidence.slice(0, 2).map((evidence, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-blue-400 mr-1">•</span>
                          {evidence}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Achievement Story */}
            {achievementStory && showFullInsights && (
              <div className="bg-green-50 p-3 rounded-lg">
                <h4 className="font-medium text-green-900 mb-2">Achievements</h4>
                <p className="text-sm text-green-800 leading-relaxed">
                  {achievementStory.narrative}
                </p>
              </div>
            )}

            {/* Recommendations */}
            {impactNarrative?.recommendations.length > 0 && showFullInsights && (
              <div className="bg-yellow-50 p-3 rounded-lg">
                <h4 className="font-medium text-yellow-900 mb-2">Recognition Opportunities</h4>
                <ul className="text-sm text-yellow-800 space-y-1">
                  {impactNarrative.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start">
                      <Sparkles className="h-3 w-3 mr-2 mt-0.5 text-yellow-500" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Classification Details */}
        <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
          <div>
            <span className="font-medium">Type:</span> {profile.classification.contributorType}
          </div>
          <div>
            <span className="font-medium">Active:</span> {profile.classification.trustIndicators.monthsActive}mo
          </div>
          <div>
            <span className="font-medium">Reviews:</span> {profile.classification.trustIndicators.codeReviewParticipation}%
          </div>
          <div>
            <span className="font-medium">Reputation:</span> {profile.classification.trustIndicators.communityReputation}%
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-2 border-t">
          {onViewProfile && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onViewProfile(profile.login)}
              className="flex items-center"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View Profile
            </Button>
          )}

          {!showFullInsights && hasAIInsights && (
            <Button 
              variant="ghost" 
              size="sm"
              className="text-blue-600 hover:text-blue-700"
            >
              <Brain className="h-3 w-3 mr-1" />
              View Full Insights
            </Button>
          )}

          <div className="text-xs text-gray-400">
            Updated {profile.lastAnalyzed.toLocaleDateString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Simplified version for lists and grids
export function ContributorImpactCardCompact({
  profile,
  rank,
  onViewProfile,
  className
}: ContributorImpactCardProps) {
  const impactDisplay = getImpactLevelDisplay(profile.impactLevel);
  const ImpactIcon = impactDisplay.icon;

  return (
    <Card className={cn(
      'transition-all duration-200 hover:shadow-md cursor-pointer',
      profile.celebrationPriority === 'high' && 'ring-1 ring-yellow-200 bg-yellow-50',
      className
    )}
    onClick={() => onViewProfile?.(profile.login)}>
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          {rank && (
            <div className="flex items-center justify-center w-6 h-6 bg-gray-100 rounded-full text-xs font-bold text-gray-600">
              {rank}
            </div>
          )}
          
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile.avatar_url} alt={`${profile.login}'s avatar`} />
            <AvatarFallback className="text-xs">
              {profile.login.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">@{profile.login}</div>
            <div className="flex items-center space-x-1 mt-1">
              <Badge 
                variant="secondary" 
                className={cn('text-white text-xs', impactDisplay.color)}
              >
                <ImpactIcon className="h-2 w-2 mr-1" />
                {impactDisplay.label}
              </Badge>
            </div>
          </div>

          <div className="text-right">
            <div className="font-bold text-gray-900">{profile.overallScore}</div>
            <div className="text-xs text-gray-500">Score</div>
          </div>
        </div>

        {profile.aiInsights.impactNarrative && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
              {profile.aiInsights.impactNarrative.narrative.slice(0, 100)}...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function (moved outside component for reuse)
function getImpactLevelDisplay(level: string) {
  switch (level) {
    case 'champion': return { label: 'Champion', color: 'bg-yellow-500', icon: Award };
    case 'rising-star': return { label: 'Rising Star', color: 'bg-blue-500', icon: Star };
    case 'solid-contributor': return { label: 'Contributor', color: 'bg-green-500', icon: TrendingUp };
    case 'newcomer': return { label: 'Newcomer', color: 'bg-gray-500', icon: MessageCircle };
    default: return { label: 'Contributor', color: 'bg-gray-500', icon: MessageCircle };
  }
}