import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { inngest } from '@/lib/inngest/client'
import { ProgressiveCaptureNotifications } from '@/lib/progressive-capture/ui-notifications'
import { toast } from 'sonner'

interface TrackRepositoryWithNotificationOptions {
  owner: string | undefined
  repo: string | undefined
  enabled?: boolean
}

interface TrackingState {
  isNewRepository: boolean
  isTracking: boolean
  hasData: boolean
}

export function useTrackRepositoryWithNotification({
  owner,
  repo,
  enabled = true
}: TrackRepositoryWithNotificationOptions): TrackingState {
  const [state, setState] = useState<TrackingState>({
    isNewRepository: false,
    isTracking: false,
    hasData: false
  })
  const hasCheckedRef = useRef(false)
  const notificationShownRef = useRef(false)

  useEffect(() => {
    if (!enabled || !owner || !repo || hasCheckedRef.current) {
      return
    }

    const checkAndTrackRepository = async () => {
      try {
        // Check if repository exists in our database
        const { data: repoData, error: repoError } = await supabase
          .from('repositories')
          .select('id')
          .eq('owner', owner)
          .eq('name', repo)
          .single()

        if (repoError && repoError.code === 'PGRST116') {
          // Repository not found - this is a new repository
          setState(prev => ({ ...prev, isNewRepository: true }))
          
          // Show user-friendly notification only once
          if (!notificationShownRef.current) {
            notificationShownRef.current = true
            toast.info(`Setting up ${owner}/${repo}...`, {
              description: "This is a new repository! We're gathering contributor data for you. This usually takes 1-2 minutes.",
              duration: 8000,
              action: {
                label: 'Learn More',
                onClick: () => {
                  toast.info('How it works', {
                    description: 'We analyze pull requests, reviews, and contributions to show you insights about this repository.',
                    duration: 6000
                  })
                }
              }
            })
          }

          // Check if repository is already being tracked
          const { data: existing, error: checkError } = await supabase
            .from('tracked_repositories')
            .select('id, repository_id, size, size_calculated_at')
            .eq('organization_name', owner)
            .eq('repository_name', repo)
            .single()

          if (checkError && checkError.code !== 'PGRST116') {
            console.error('Error checking tracked repositories:', checkError)
            return
          }

          // If repository is not tracked, add it
          if (!existing) {
            setState(prev => ({ ...prev, isTracking: true }))
            
            const { data: newRepo, error: insertError } = await supabase
              .from('tracked_repositories')
              .insert({
                organization_name: owner,
                repository_name: repo,
                tracking_enabled: true,
                priority: 'medium', // Higher priority for user-initiated searches
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select()
              .single()

            if (insertError) {
              console.error('Failed to track repository:', insertError)
              toast.error('Failed to set up repository', {
                description: 'Please try refreshing the page.',
                duration: 6000
              })
              return
            }

            if (newRepo) {
              hasCheckedRef.current = true
              
              // Trigger initial data sync with higher priority
              try {
                // Send multiple events for comprehensive initial sync
                await Promise.all([
                  // Size classification
                  inngest.send({
                    name: 'classify/repository.single',
                    data: {
                      repositoryId: newRepo.id,
                      owner,
                      repo
                    }
                  }),
                  // Initial data capture
                  inngest.send({
                    name: 'capture/repository.sync',
                    data: {
                      owner,
                      repo,
                      priority: 'high',
                      source: 'user-search'
                    }
                  })
                ])

                // Show processing notification
                ProgressiveCaptureNotifications.showProcessingStarted(
                  `${owner}/${repo}`,
                  'inngest',
                  60000 // 1 minute estimate
                )
              } catch (error) {
                console.error('Failed to trigger repository sync:', error)
              }
            }
          } else {
            // Repository is tracked but no data yet
            hasCheckedRef.current = true
            setState(prev => ({ ...prev, isTracking: true }))
            
            // Trigger data sync
            try {
              await inngest.send({
                name: 'capture/repository.sync',
                data: {
                  owner,
                  repo,
                  priority: 'high',
                  source: 'user-search-retry'
                }
              })
            } catch (error) {
              console.error('Failed to trigger repository sync:', error)
            }
          }
        } else if (repoData) {
          // Repository exists in our database
          hasCheckedRef.current = true
          setState(prev => ({ ...prev, hasData: true }))
          
          // Check if we have recent PR data
          const { data: prData, error: prError } = await supabase
            .from('pull_requests')
            .select('id')
            .eq('repository_id', repoData.id)
            .order('created_at', { ascending: false })
            .limit(1)

          if (!prError && (!prData || prData.length === 0)) {
            // Repository exists but has no data - trigger sync
            toast.info(`Refreshing ${owner}/${repo}...`, {
              description: "We're updating this repository with the latest data.",
              duration: 6000
            })
            
            try {
              await inngest.send({
                name: 'capture/repository.sync',
                data: {
                  owner,
                  repo,
                  priority: 'high',
                  source: 'user-search-empty'
                }
              })
            } catch (error) {
              console.error('Failed to trigger repository sync:', error)
            }
          }
        }
      } catch (error) {
        console.error('Error in repository tracking:', error)
      }
    }

    checkAndTrackRepository()
  }, [owner, repo, enabled])

  // Reset tracking flag when repository changes
  useEffect(() => {
    hasCheckedRef.current = false
    notificationShownRef.current = false
  }, [owner, repo])

  return state
}