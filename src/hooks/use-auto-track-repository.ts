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
        
        // Check if repository is already being tracked
        const { data: existing, error: checkError } = await supabase
          .from('tracked_repositories')
          .select('id, repository_id')
          .eq('organization_name', owner)
          .eq('repository_name', repo)
          .single()

        if (checkError && checkError.code !== 'PGRST116') {
          return
        }

        // If repository is not tracked, add it
        if (!existing) {
          
          const { error: insertError } = await supabase
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
          } else {
            hasTrackedRef.current = true
          }
        } else {
          hasTrackedRef.current = true
        }
      } catch (error) {
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