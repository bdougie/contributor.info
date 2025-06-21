import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface AutoTrackOptions {
  owner: string
  repo: string
  enabled?: boolean
}

export function useAutoTrackRepository({
  owner,
  repo,
  enabled = true
}: AutoTrackOptions) {
  const hasTrackedRef = useRef(false)

  useEffect(() => {
    if (!enabled || !owner || !repo || hasTrackedRef.current) {
      return
    }

    const trackRepository = async () => {
      try {
        console.log(`[AutoTrack] Attempting to track repository: ${owner}/${repo}`)
        
        // Check if repository is already being tracked
        const { data: existing, error: checkError } = await supabase
          .from('tracked_repositories')
          .select('id, repository_id')
          .eq('organization_name', owner)
          .eq('repository_name', repo)
          .single()

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('[AutoTrack] Error checking tracked repository:', checkError)
          return
        }

        // If repository is not tracked, add it
        if (!existing) {
          console.log(`[AutoTrack] Repository not tracked yet, adding: ${owner}/${repo}`)
          
          const { data, error: insertError } = await supabase
            .from('tracked_repositories')
            .insert({
              organization_name: owner,
              repository_name: repo,
              tracking_enabled: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single()

          if (insertError) {
            console.error('[AutoTrack] Error tracking repository:', insertError)
            console.error('[AutoTrack] Insert details:', { owner, repo, error: insertError })
          } else {
            console.log(`[AutoTrack] Successfully tracked repository: ${owner}/${repo}`, data)
            hasTrackedRef.current = true
          }
        } else {
          console.log(`[AutoTrack] Repository already tracked: ${owner}/${repo}`)
          hasTrackedRef.current = true
        }
      } catch (error) {
        console.error('[AutoTrack] Unexpected error in auto-track repository:', error)
      }
    }

    // Track repository on first load
    trackRepository()
  }, [owner, repo, enabled])

  // Reset tracking flag when repository changes
  useEffect(() => {
    hasTrackedRef.current = false
  }, [owner, repo])
}