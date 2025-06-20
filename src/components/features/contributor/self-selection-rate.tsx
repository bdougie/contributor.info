import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Users, UserCheck, TrendingUp, TrendingDown, RefreshCw, Database, LogIn } from 'lucide-react'
import { useOnDemandSync } from '@/hooks/use-on-demand-sync'
import { useGitHubAuth } from '@/hooks/use-github-auth'

interface SelfSelectionStats {
  external_contribution_rate: number
  internal_contribution_rate: number
  external_contributors: number
  internal_contributors: number
  total_contributors: number
  external_prs: number
  internal_prs: number
  total_prs: number
  analysis_period_days: number
}

interface SelfSelectionRateProps {
  owner: string
  repo: string
  daysBack?: number
  className?: string
}

export function SelfSelectionRate({ 
  owner, 
  repo, 
  daysBack = 30,
  className 
}: SelfSelectionRateProps) {
  const [stats, setStats] = useState<SelfSelectionStats | null>(null)
  const [previousStats, setPreviousStats] = useState<SelfSelectionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Authentication hook
  const { isLoggedIn, login } = useGitHubAuth()

  // On-demand sync hook
  const { hasData, syncStatus, triggerSync } = useOnDemandSync({
    owner,
    repo,
    enabled: true,
    autoTriggerOnEmpty: true
  })

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch current period stats
      const { data: currentData, error: currentError } = await supabase
        .rpc('calculate_self_selection_rate', {
          p_repository_owner: owner,
          p_repository_name: repo,
          p_days_back: daysBack
        })
        .single()

      if (currentError) throw currentError

      // Check if we got meaningful data
      const hasRealData = currentData && (
        (currentData as any).total_contributors > 0 || 
        (currentData as any).total_prs > 0
      )

      if (hasRealData) {
        // Fetch previous period stats for comparison
        const { data: previousData } = await supabase
          .rpc('calculate_self_selection_rate', {
            p_repository_owner: owner,
            p_repository_name: repo,
            p_days_back: daysBack * 2
          })
          .single()

        setStats(currentData as SelfSelectionStats)
        setPreviousStats(previousData as SelfSelectionStats)
      } else {
        setStats(null)
        setPreviousStats(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch statistics')
      console.error('Error fetching self-selection stats:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [owner, repo, daysBack])

  // Refetch when sync completes
  useEffect(() => {
    if (syncStatus.isComplete && !syncStatus.error) {
      fetchStats()
    }
  }, [syncStatus.isComplete, syncStatus.error])

  // Show sync progress if data is being collected
  if (syncStatus.isTriggering || syncStatus.isInProgress) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Self-Selection Rate
            <RefreshCw className="h-4 w-4 animate-spin" />
          </CardTitle>
          <CardDescription>
            {syncStatus.isTriggering 
              ? 'Starting data collection from GitHub...'
              : 'Analyzing repository events and contributor roles...'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-muted-foreground">•••</div>
            <p className="text-sm text-muted-foreground mt-1">
              Collecting data for {owner}/{repo}
            </p>
            {syncStatus.eventsProcessed !== null && (
              <p className="text-xs text-muted-foreground mt-1">
                {syncStatus.eventsProcessed} events processed
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show loading skeleton during normal loading
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  // Show no data state with option to manually trigger sync
  if (!stats || (stats.total_contributors === 0 && stats.total_prs === 0)) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Self-Selection Rate</CardTitle>
          <CardDescription>
            {error || hasData === false 
              ? 'No contributor data available for this repository'
              : 'Unable to calculate statistics'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="text-4xl font-bold">0.0%</div>
            <p className="text-sm text-muted-foreground mt-1">
              of contributions from external contributors
            </p>
            {error && (
              <p className="text-xs text-red-500 mt-2">{error}</p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>External</span>
              <span>Internal</span>
            </div>
            <Progress value={0} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0 PRs</span>
              <span>0 PRs</span>
            </div>
          </div>
          
          {/* Authentication and sync trigger */}
          {hasData === false && !syncStatus.error && (
            <div className="flex flex-col items-center gap-2 pt-4 border-t">
              {!isLoggedIn ? (
                <>
                  <p className="text-sm text-muted-foreground text-center">
                    Log in with GitHub to analyze this repository's contributor data.
                  </p>
                  <Button 
                    onClick={login}
                    variant="outline" 
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <LogIn className="h-4 w-4" />
                    Log in with GitHub
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground text-center">
                    This repository hasn't been analyzed yet.
                  </p>
                  <Button 
                    onClick={triggerSync}
                    variant="outline" 
                    size="sm"
                    disabled={syncStatus.isTriggering || syncStatus.isInProgress}
                    className="flex items-center gap-2"
                  >
                    <Database className="h-4 w-4" />
                    Analyze Repository
                  </Button>
                </>
              )}
            </div>
          )}
          
          {/* Sync error state */}
          {syncStatus.error && (
            <div className="flex flex-col items-center gap-2 pt-4 border-t">
              <p className="text-sm text-red-500 text-center">
                {syncStatus.error}
              </p>
              <Button 
                onClick={triggerSync}
                variant="outline" 
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry Analysis
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Calculate trend
  const trend = previousStats && stats.external_contribution_rate !== null && previousStats.external_contribution_rate !== null
    ? stats.external_contribution_rate - 
      (previousStats.external_contribution_rate - stats.external_contribution_rate)
    : null

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            Self-Selection Rate
            {(syncStatus.isTriggering || syncStatus.isInProgress) && (
              <RefreshCw className="h-4 w-4 animate-spin" />
            )}
          </span>
          <div className="flex items-center gap-2">
            {trend !== null && (
              <span className="flex items-center text-sm font-normal">
                {trend > 0 ? (
                  <>
                    <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                    <span className="text-green-600">+{trend.toFixed(1)}%</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                    <span className="text-red-600">{trend.toFixed(1)}%</span>
                  </>
                )}
              </span>
            )}
            <Button
              onClick={triggerSync}
              variant="ghost"
              size="sm"
              disabled={syncStatus.isTriggering || syncStatus.isInProgress}
              className="h-8 w-8 p-0"
              title="Refresh data"
            >
              <RefreshCw className={`h-4 w-4 ${(syncStatus.isTriggering || syncStatus.isInProgress) ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          External vs internal contributions over the last {daysBack} days
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main metric */}
        <div className="text-center">
          <div className="text-4xl font-bold">
            {stats.external_contribution_rate !== null ? stats.external_contribution_rate.toFixed(1) : '0.0'}%
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            of contributions from external contributors
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>External</span>
            <span>Internal</span>
          </div>
          <Progress 
            value={stats.external_contribution_rate || 0} 
            className="h-3"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{stats.external_prs || 0} PRs</span>
            <span>{stats.internal_prs || 0} PRs</span>
          </div>
        </div>

        {/* Contributor breakdown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">External</span>
            </div>
            <div className="text-2xl font-semibold">
              {stats.external_contributors || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              contributors
            </p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Internal</span>
            </div>
            <div className="text-2xl font-semibold">
              {stats.internal_contributors || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              maintainers/owners
            </p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="pt-4 border-t">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total PRs</span>
            <span className="font-medium">{stats.total_prs || 0}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-muted-foreground">Total Contributors</span>
            <span className="font-medium">{stats.total_contributors || 0}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Hook for accessing self-selection stats
export function useSelfSelectionRate(owner: string, repo: string, daysBack: number = 30) {
  const [stats, setStats] = useState<SelfSelectionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const { data, error: err } = await supabase
          .rpc('calculate_self_selection_rate', {
            p_repository_owner: owner,
            p_repository_name: repo,
            p_days_back: daysBack
          })
          .single()

        if (err) throw err
        setStats(data as SelfSelectionStats)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch statistics')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [owner, repo, daysBack])

  return { stats, loading, error }
}