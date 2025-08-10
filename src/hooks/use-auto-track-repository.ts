import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { sendInngestEvent } from '@/lib/inngest/client-safe'

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
          .select('id, repository_id, size, size_calculated_at')
          .eq('organization_name', owner)
          .eq('repository_name', repo)
          .maybeSingle()

        if (checkError) {
          return
        }

        // If repository is not tracked, add it
        if (!existing) {
          
          const { data: newRepo, error: insertError } = await supabase
            .from('tracked_repositories')
            .insert({
              organization_name: owner,
              repository_name: repo,
              tracking_enabled: true,
              priority: 'low', // Default priority
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .maybeSingle()

          if (insertError) {
            console.error('Failed to track repository %s/%s:', owner, repo, insertError)
            return
          }

          if (newRepo) {
            hasTrackedRef.current = true
            
            // Trigger size classification for newly tracked repository
            // This will happen in the background
            try {
              await sendInngestEvent({
                name: 'classify/repository.single',
                data: {
                  repositoryId: newRepo.id,
                  owner,
                  repo
                }
              })
            } catch (error) {
              console.error('Failed to trigger repository classification for %s/%s:', owner, repo, error)
              // Classification failure is non-critical, repository is still tracked
              // The classification can be retried later via manual trigger
            }
          }
        } else {
          hasTrackedRef.current = true
          
          // Check if the repository needs classification or reclassification
          if (!existing.size || !existing.size_calculated_at) {
            // Repository has never been classified
            try {
              await sendInngestEvent({
                name: 'classify/repository.single',
                data: {
                  repositoryId: existing.id,
                  owner,
                  repo
                }
              })
            } catch (error) {
              console.error('Failed to trigger repository classification for %s/%s:', owner, repo, error)
              // Classification failure is non-critical, can be retried later
            }
          } else {
            // Check if classification is older than 30 days
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
            
            if (new Date(existing.size_calculated_at) < thirtyDaysAgo) {
              // Trigger reclassification
              try {
                await sendInngestEvent({
                  name: 'classify/repository.single',
                  data: {
                    repositoryId: existing.id,
                    owner,
                    repo
                  }
                })
              } catch (error) {
                console.error('Failed to trigger repository reclassification for %s/%s:', owner, repo, error)
                // Reclassification failure is non-critical, existing data is still valid
              }
            }
          }
        }
      } catch (error) {
        console.error('Error in auto-track repository %s/%s:', owner, repo, error)
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