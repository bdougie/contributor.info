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
        // First, check if repository exists in repositories table
        const { data: repository, error: repoError } = await supabase
          .from('repositories')
          .select('id')
          .eq('owner', owner)
          .eq('name', repo)
          .single()

        if (repoError) {
          if (repoError.code === 'PGRST116') {
            // Repository doesn't exist in the database yet
            console.log(`Repository ${owner}/${repo} not yet synced to database`)
          } else {
            console.error('Error checking repository:', repoError)
          }
          return
        }

        // Check if repository is already being tracked
        const { data: existing, error: checkError } = await supabase
          .from('tracked_repositories')
          .select('id')
          .eq('repository_id', repository.id)
          .single()

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('Error checking tracked repository:', checkError)
          return
        }

        // If repository is not tracked, add it
        if (!existing) {
          const { error: insertError } = await supabase
            .from('tracked_repositories')
            .insert({
              repository_id: repository.id,
              tracking_enabled: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })

          if (insertError) {
            console.error('Error tracking repository:', insertError)
          } else {
            console.log(`Auto-tracked repository: ${owner}/${repo}`)
            hasTrackedRef.current = true
          }
        } else {
          hasTrackedRef.current = true
        }
      } catch (error) {
        console.error('Error in auto-track repository:', error)
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