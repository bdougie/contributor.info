/**
 * React hook for cached GitHub API access with performance monitoring
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createCachedGitHubClient, ApiCallOptions, ApiResponse } from '@/lib/cache/github-api-wrapper'
import { supabase } from '@/lib/supabase'

export interface CachedApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  fromCache: boolean
  responseTime: number
  refetch: () => Promise<void>
  clearCache: () => Promise<void>
}

export interface UseCachedGitHubApiOptions extends ApiCallOptions {
  enabled?: boolean
  onSuccess?: (data: any) => void
  onError?: (error: string) => void
  refreshInterval?: number
}

/**
 * Hook for cached GitHub API calls
 */
export function useCachedGitHubApi<T>(
  endpoint: string,
  params: Record<string, any> = {},
  options: UseCachedGitHubApiOptions = {}
): CachedApiState<T> {
  const [session, setSession] = useState<any>(null)
  const [state, setState] = useState<{
    data: T | null
    loading: boolean
    error: string | null
    fromCache: boolean
    responseTime: number
  }>({
    data: null,
    loading: false,
    error: null,
    fromCache: false,
    responseTime: 0
  })

  const clientRef = useRef(createCachedGitHubClient(session?.provider_token))
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const {
    enabled = true,
    onSuccess,
    onError,
    refreshInterval,
    ...apiOptions
  } = options

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled) return

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const result: ApiResponse<T> = await clientRef.current.makeRequest<T>(
        endpoint,
        params,
        { ...apiOptions, forceRefresh }
      )

      if (result.success) {
        setState({
          data: result.data,
          loading: false,
          error: null,
          fromCache: result.fromCache,
          responseTime: result.responseTime
        })
        onSuccess?.(result.data)
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: result.error || 'Unknown error occurred'
        }))
        onError?.(result.error || 'Unknown error occurred')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))
      onError?.(errorMessage)
    }
  }, [endpoint, params, enabled, apiOptions, onSuccess, onError])

  const refetch = useCallback(async () => {
    await fetchData(true)
  }, [fetchData])

  const clearCache = useCallback(async () => {
    await clientRef.current.clearCache()
    await fetchData(true)
  }, [fetchData])

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchData()
    }
  }, [fetchData, enabled])

  // Setup refresh interval
  useEffect(() => {
    if (refreshInterval && enabled) {
      refreshIntervalRef.current = setInterval(() => {
        fetchData()
      }, refreshInterval)

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current)
        }
      }
    }
  }, [refreshInterval, enabled, fetchData])

  // Get session on mount
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
    }
    getSession()
  }, [])

  // Update client token when session changes
  useEffect(() => {
    clientRef.current = createCachedGitHubClient(session?.provider_token)
  }, [session?.provider_token])

  return {
    ...state,
    refetch,
    clearCache
  }
}

/**
 * Hook for repository data with specialized caching
 */
export function useCachedRepository(owner: string, repo: string, options: UseCachedGitHubApiOptions = {}) {

  return useCachedGitHubApi(
    `/repos/${owner}/${repo}`,
    {},
    {
      cacheTtl: 15 * 60 * 1000, // 15 minutes
      ...options
    }
  )
}

/**
 * Hook for user data with specialized caching
 */
export function useCachedUser(username: string, options: UseCachedGitHubApiOptions = {}) {
  return useCachedGitHubApi(
    `/users/${username}`,
    {},
    {
      cacheTtl: 30 * 60 * 1000, // 30 minutes
      ...options
    }
  )
}

/**
 * Hook for pull requests with caching
 */
export function useCachedPullRequests(
  owner: string,
  repo: string,
  queryParams: Record<string, any> = {},
  options: UseCachedGitHubApiOptions = {}
) {
  return useCachedGitHubApi(
    `/repos/${owner}/${repo}/pulls`,
    queryParams,
    {
      cacheTtl: 5 * 60 * 1000, // 5 minutes
      ...options
    }
  )
}

/**
 * Hook for repository events with caching
 */
export function useCachedRepositoryEvents(
  owner: string,
  repo: string,
  queryParams: Record<string, any> = {},
  options: UseCachedGitHubApiOptions = {}
) {
  return useCachedGitHubApi(
    `/repos/${owner}/${repo}/events`,
    queryParams,
    {
      cacheTtl: 2 * 60 * 1000, // 2 minutes for events
      ...options
    }
  )
}

/**
 * Hook for batch API requests
 */
export function useCachedBatchRequests<T>(
  requests: Array<{ endpoint: string; params?: Record<string, any>; options?: ApiCallOptions }>,
  options: UseCachedGitHubApiOptions = {}
) {
  const [state, setState] = useState<{
    data: ApiResponse<T>[] | null
    loading: boolean
    error: string | null
  }>({
    data: null,
    loading: false,
    error: null
  })

  const clientRef = useRef(createCachedGitHubClient())

  const fetchBatch = useCallback(async () => {
    if (!options.enabled || requests.length === 0) return

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const results = await clientRef.current.batchRequest<T>(requests)
      setState({
        data: results,
        loading: false,
        error: null
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch request failed'
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))
    }
  }, [requests, options.enabled])

  useEffect(() => {
    fetchBatch()
  }, [fetchBatch])

  return {
    ...state,
    refetch: fetchBatch
  }
}

/**
 * Hook for monitoring cache performance
 */
export function useCacheStats() {
  const [stats, setStats] = useState<any>(null)
  const clientRef = useRef(createCachedGitHubClient())

  const refreshStats = useCallback(() => {
    const currentStats = clientRef.current.getCacheStats()
    setStats(currentStats)
  }, [])

  useEffect(() => {
    refreshStats()
    
    // Refresh stats every 30 seconds
    const interval = setInterval(refreshStats, 30000)
    return () => clearInterval(interval)
  }, [refreshStats])

  return {
    stats,
    refresh: refreshStats
  }
}