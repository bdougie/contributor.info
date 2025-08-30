import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Trophy as Award,
  Trophy,
  Star,
  Target,
  TrendingUp,
  Users,
  Clock,
  Sparkles,
  Crown,
  Trophy as Medal,
  Zap
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { AIEnhancedContributorProfile } from '@/lib/analytics/ai-contributor-analyzer';

interface AchievementMatrixProps {
  profiles: AIEnhancedContributorProfile[];
  onCelebrate?: (login: string, achievement: string) => void;
  className?: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
  category: 'impact' | 'consistency' | 'collaboration' | 'growth' | 'special';
  threshold: number;
  getValue: (profile: AIEnhancedContributorProfile) => number;
  isSpecial?: boolean;
}

// Define achievement criteria
const ACHIEVEMENTS: Achievement[] = [
  // Impact achievements
  {
    id: 'champion-contributor',
    title: 'Champion Contributor',
    description: 'Achieved champion impact level with exceptional contributions',
    icon: Crown,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    category: 'impact',
    threshold: 90,
    getValue: (profile) => profile.overallScore,
    isSpecial: true
  },
  {
    id: 'rising-star',
    title: 'Rising Star',
    description: 'Identified as a rising talent with high growth potential',
    icon: Star,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    category: 'growth',
    threshold: 70,
    getValue: (profile) => profile.impactLevel === 'rising-star' ? 100 : profile.overallScore
  },
  {
    id: 'trusted-veteran',
    title: 'Trusted Veteran',
    description: 'Reached trusted contributor status with proven reliability',
    icon: Medal,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    category: 'impact',
    threshold: 80,
    getValue: (profile) => profile.classification.trustLevel === 'trusted' || profile.classification.trustLevel === 'core' ? 100 : 0
  },
  
  // Consistency achievements
  {
    id: 'consistency-master',
    title: 'Consistency Master',
    description: 'Maintained exceptional consistency in contributions',
    icon: Target,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    category: 'consistency',
    threshold: 85,
    getValue: (profile) => profile.consistency.consistencyScore
  },
  {
    id: 'reliable-contributor',
    title: 'Reliable Contributor',
    description: 'Demonstrated strong reliability and commitment keeping',
    icon: Clock,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    category: 'consistency',
    threshold: 90,
    getValue: (profile) => profile.consistency.reliabilityMetrics.commitmentKeepingRate
  },
  {
    id: 'quality-champion',
    title: 'Quality Champion',
    description: 'Maintained consistently high code quality standards',
    icon: Zap,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    category: 'consistency',
    threshold: 85,
    getValue: (profile) => profile.consistency.reliabilityMetrics.codeQualityConsistency
  },

  // Collaboration achievements
  {
    id: 'community-builder',
    title: 'Community Builder',
    description: 'Actively engaged in building and supporting the community',
    icon: Users,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
    category: 'collaboration',
    threshold: 75,
    getValue: (profile) => profile.classification.trustIndicators.codeReviewParticipation
  },
  {
    id: 'mentor',
    title: 'Mentor',
    description: 'Demonstrated leadership through mentoring other contributors',
    icon: Award,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
    category: 'collaboration',
    threshold: 2,
    getValue: (profile) => profile.classification.trustIndicators.maintainerNominations
  },
  {
    id: 'high-reputation',
    title: 'Community Favorite',
    description: 'Earned high reputation through positive community interactions',
    icon: Trophy,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    category: 'collaboration',
    threshold: 85,
    getValue: (profile) => profile.classification.trustIndicators.communityReputation
  },

  // Growth achievements  
  {
    id: 'rapid-learner',
    title: 'Rapid Learner',
    description: 'Showed exceptional growth and learning velocity',
    icon: TrendingUp,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    category: 'growth',
    threshold: 80,
    getValue: (profile) => profile.aiInsights.growthPotential?.confidence ? profile.aiInsights.growthPotential.confidence * 100 : 0
  },
  {
    id: 'ai-recognized',
    title: 'AI Recognized',
    description: 'Received high-confidence AI recognition for exceptional contributions',
    icon: Sparkles,
    color: 'text-violet-600',
    bgColor: 'bg-violet-100',
    category: 'special',
    threshold: 85,
    getValue: (profile) => profile.aiConfidence * 100,
    isSpecial: true
  }
];

export function AchievementMatrix({ profiles, onCelebrate, className }: AchievementMatrixProps) {
  // Calculate achievements for each profile
  const profileAchievements = React.useMemo(() => {
    return profiles.map(profile => {
      const achievements = ACHIEVEMENTS.filter(achievement => {
        const value = achievement.getValue(profile);
        return value >= achievement.threshold;
      });

      const achievementsByCategory = achievements.reduce((acc, achievement) => {
        if (!acc[achievement.category]) acc[achievement.category] = [];
        acc[achievement.category].push(achievement);
        return acc;
      }, {} as Record<string, Achievement[]>);

      return {
        profile,
        achievements,
        achievementsByCategory,
        totalCount: achievements.length,
        specialCount: achievements.filter(a => a.isSpecial).length
      };
    });
  }, [profiles]);

  // Sort by achievement count and overall score
  const sortedProfiles = React.useMemo(() => {
    return [...profileAchievements].sort((a, b) => {
      // First by special achievements
      if (a.specialCount !== b.specialCount) {
        return b.specialCount - a.specialCount;
      }
      // Then by total achievements
      if (a.totalCount !== b.totalCount) {
        return b.totalCount - a.totalCount;
      }
      // Finally by overall score
      return b.profile.overallScore - a.profile.overallScore;
    });
  }, [profileAchievements]);

  // Get achievement statistics
  const achievementStats = React.useMemo(() => {
    const stats = ACHIEVEMENTS.map(achievement => {
      const achievers = profileAchievements.filter(p => 
        p.achievements.some(a => a.id === achievement.id)
      );
      
      return {
        achievement,
        count: achievers.length,
        percentage: Math.round((achievers.length / profiles.length) * 100),
        achievers: achievers.map(a => a.profile)
      };
    }).sort((a, b) => b.count - a.count);

    return stats;
  }, [profileAchievements, profiles]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span>Achievement Matrix</span>
            <Badge variant="secondary" className="ml-auto">
              {profiles.length} Contributors
            </Badge>
          </CardTitle>
          <CardDescription>
            Celebrating contributor achievements and milestones across impact, consistency, collaboration, and growth
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Achievement Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Achievement Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievementStats.slice(0, 6).map((stat) => {
              const Icon = stat.achievement.icon;
              return (
                <div key={stat.achievement.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className={cn('p-2 rounded-full', stat.achievement.bgColor)}>
                    <Icon className={cn('h-4 w-4', stat.achievement.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {stat.achievement.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {stat.count} contributors ({stat.percentage}%)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Achievers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sortedProfiles.slice(0, 8).map((profileData, index) => (
          <AchievementProfileCard
            key={profileData.profile.login}
            profileData={profileData}
            rank={index + 1}
            onCelebrate={onCelebrate}
          />
        ))}
      </div>

      {/* Full Achievement Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Achievement Overview</CardTitle>
          <CardDescription>
            Detailed view of all contributors and their achievements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Contributor</th>
                  <th className="text-center p-2 font-medium">Score</th>
                  <th className="text-center p-2 font-medium">Achievements</th>
                  <th className="text-left p-2 font-medium">Latest Recognition</th>
                </tr>
              </thead>
              <tbody>
                {sortedProfiles.map((profileData) => (
                  <tr key={profileData.profile.login} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={profileData.profile.avatar_url} />
                          <AvatarFallback className="text-xs">
                            {profileData.profile.login.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">@{profileData.profile.login}</div>
                          <div className="text-xs text-gray-500">
                            {profileData.profile.impactLevel.replace('-', ' ')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-center p-2">
                      <div className="font-bold">{profileData.profile.overallScore}</div>
                    </td>
                    <td className="text-center p-2">
                      <div className="flex justify-center space-x-1">
                        {profileData.achievements.slice(0, 4).map((achievement) => {
                          const Icon = achievement.icon;
                          return (
                            <div
                              key={achievement.id}
                              className={cn('p-1 rounded-full', achievement.bgColor)}
                              title={achievement.title}
                            >
                              <Icon className={cn('h-3 w-3', achievement.color)} />
                            </div>
                          );
                        })}
                        {profileData.achievements.length > 4 && (
                          <div className="text-xs text-gray-500 self-center">
                            +{profileData.achievements.length - 4}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      {profileData.achievements.length > 0 ? (
                        <div className="text-sm">
                          <div className="font-medium">{profileData.achievements[0].title}</div>
                          <div className="text-xs text-gray-500">
                            {profileData.profile.lastAnalyzed.toLocaleDateString()}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">No achievements yet</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Individual achievement profile card
interface AchievementProfileCardProps {
  profileData: {
    profile: AIEnhancedContributorProfile;
    achievements: Achievement[];
    achievementsByCategory: Record<string, Achievement[]>;
    totalCount: number;
    specialCount: number;
  };
  rank: number;
  onCelebrate?: (login: string, achievement: string) => void;
}

function AchievementProfileCard({ profileData, rank, onCelebrate }: AchievementProfileCardProps) {
  const { profile, achievements, achievementsByCategory, totalCount, specialCount } = profileData;
  
  const getImpactColor = (level: string) => {
    switch (level) {
      case 'champion': return 'text-yellow-600 bg-yellow-100';
      case 'rising-star': return 'text-blue-600 bg-blue-100';
      case 'solid-contributor': return 'text-green-600 bg-green-100';
      case 'newcomer': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <Card className={cn(
      'transition-all duration-200 hover:shadow-md',
      specialCount > 0 && 'ring-2 ring-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full text-sm font-bold text-gray-600">
              {rank}
            </div>
            
            <Avatar className="h-10 w-10">
              <AvatarImage src={profile.avatar_url} alt={`${profile.login}'s avatar`} />
              <AvatarFallback>{profile.login.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            
            <div>
              <CardTitle className="text-base">@{profile.login}</CardTitle>
              <Badge variant="secondary" className={getImpactColor(profile.impactLevel)}>
                {profile.impactLevel.replace('-', ' ')}
              </Badge>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xl font-bold text-gray-900">{profile.overallScore}</div>
            <div className="text-xs text-gray-500">Impact Score</div>
            {specialCount > 0 && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-300 mt-1">
                <Crown className="h-3 w-3 mr-1" />
                Special
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Achievement Summary */}
        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{totalCount}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-purple-600">{specialCount}</div>
            <div className="text-xs text-gray-500">Special</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">
              {achievementsByCategory.consistency?.length || 0}
            </div>
            <div className="text-xs text-gray-500">Consistency</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orange-600">
              {achievementsByCategory.collaboration?.length || 0}
            </div>
            <div className="text-xs text-gray-500">Social</div>
          </div>
        </div>

        {/* Recent Achievements */}
        {achievements.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Recent Achievements</h4>
            <div className="grid grid-cols-2 gap-2">
              {achievements.slice(0, 4).map((achievement) => {
                const Icon = achievement.icon;
                return (
                  <div
                    key={achievement.id}
                    className={cn('flex items-center space-x-2 p-2 rounded-lg', achievement.bgColor)}
                  >
                    <Icon className={cn('h-4 w-4', achievement.color)} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{achievement.title}</div>
                      <div className="text-xs text-gray-600 truncate">{achievement.category}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {achievements.length > 4 && (
              <div className="text-xs text-gray-500 text-center">
                +{achievements.length - 4} more achievements
              </div>
            )}
          </div>
        )}

        {/* AI Recognition */}
        {profile.aiInsights.impactNarrative && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-1 flex items-center">
              <Sparkles className="h-3 w-3 mr-1" />
              AI Recognition
            </h4>
            <p className="text-sm text-blue-800 leading-relaxed line-clamp-2">
              {profile.aiInsights.impactNarrative.narrative.slice(0, 100)}...
            </p>
          </div>
        )}

        {/* Action Buttons */}
        {onCelebrate && achievements.length > 0 && (
          <div className="flex justify-between items-center pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCelebrate(profile.login, achievements[0].title)}
              className="flex items-center"
            >
              <Trophy className="h-3 w-3 mr-1" />
              Celebrate
            </Button>
            <div className="text-xs text-gray-400">
              {profile.lastAnalyzed.toLocaleDateString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}