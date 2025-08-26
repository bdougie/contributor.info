import { useState } from 'react'
import { RefreshCw, Database, CheckCircle, XCircle, Info } from '@/components/ui/icon';
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useGitHubAuth } from '@/hooks/use-github-auth'

export function GitHubSyncDebug() {
  const [owner, setOwner] = useState('continuedev')
  const [repo, setRepo] = useState('continue')
  const [syncResponse, setSyncResponse] = useState<Record<string, unknown> | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  
  const { isLoggedIn, login } = useGitHubAuth()

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const checkGitHubToken = async () => {
    addLog('Checking GitHub token configuration...')
    
    try {
      // Check if user has provider token
      const { data: { session } } = await supabase.auth.getSession()
      addLog(`User authenticated: ${!!session}`)
      addLog(`Provider token available: ${!!session?.provider_token}`)
      
      // Try to call the edge function to check system token
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          owner: 'test',
          repository: 'test',
          debug: true // Add debug flag
        })
      })
      
      const result = await response.json()
      addLog(`Edge Function response: ${JSON.stringify(result, null, 2)}`)
      
      return {
        userToken: !!session?.provider_token,
        systemToken: result.hasSystemToken || false,
        error: result.error
      }
    } catch (error) {
      addLog(`Error checking tokens: ${error}`)
      return { userToken: false, systemToken: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  const checkDatabaseState = async () => {
    addLog(`Checking database state for ${owner}/${repo}...`)
    
    try {
      // Check repositories table
      const { data: repoData, error: repoError } = await supabase
        .from('repositories')
        .select('*')
        .eq('owner', owner)
        .eq('name', repo)
        .maybeSingle()
      
      if (repoError && repoError.code !== 'PGRST116') {
        addLog(`Error checking repositories: ${repoError.message}`)
      } else {
        addLog(`Repository exists: ${!!repoData}`)
        if (repoData) {
          addLog(`Repository ID: ${repoData.id}`)
        }
      }
      
      // Check tracked_repositories
      const { data: trackedData, error: trackedError } = await supabase
        .from('tracked_repositories')
        .select('*')
        .eq('organization_name', owner)
        .eq('repository_name', repo)
        .maybeSingle()
      
      if (trackedError && trackedError.code !== 'PGRST116') {
        addLog(`Error checking tracked_repositories: ${trackedError.message}`)
      } else {
        addLog(`Repository tracked: ${!!trackedData}`)
        if (trackedData) {
          addLog(`Tracked details: ${JSON.stringify(trackedData, null, 2)}`)
        }
      }
      
      // Check sync status
      const { data: syncStatus, error: syncError } = await supabase
        .from('github_sync_status')
        .select('*')
        .eq('repository_owner', owner)
        .eq('repository_name', repo)
        .maybeSingle()
      
      if (syncError && syncError.code !== 'PGRST116') {
        addLog(`Error checking sync status: ${syncError.message}`)
      } else {
        addLog(`Sync status exists: ${!!syncStatus}`)
        if (syncStatus) {
          addLog(`Sync status: ${JSON.stringify(syncStatus, null, 2)}`)
        }
      }
      
      // Check contributor roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('contributor_roles')
        .select('*')
        .eq('repository_owner', owner)
        .eq('repository_name', repo)
        .limit(5)
      
      if (rolesError) {
        addLog(`Error checking contributor roles: ${rolesError.message}`)
      } else {
        addLog(`Contributor roles found: ${rolesData?.length || 0}`)
      }
      
      return {
        repository: repoData,
        tracked: trackedData,
        syncStatus,
        rolesCount: rolesData?.length || 0
      }
    } catch (error) {
      addLog(`Error checking database: ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  }

  const triggerSync = async () => {
    setIsLoading(true)
    setSyncResponse(null)
    setSyncError(null)
    setLogs([])
    
    try {
      addLog(`Starting sync for ${owner}/${repo}`)
      
      // First check tokens
      const tokenStatus = await checkGitHubToken()
      addLog(`Token status: User=${tokenStatus.userToken}, System=${tokenStatus.systemToken}`)
      
      // Check database state before sync
      addLog('=== Database state before sync ===')
      await checkDatabaseState()
      
      // Get session for user token
      const { data: { session } } = await supabase.auth.getSession()
      
      // Trigger sync
      addLog('Calling github-sync edge function...')
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          owner,
          repository: repo,
          github_token: session?.provider_token
        })
      })
      
      const result = await response.json()
      addLog(`Response status: ${response.status}`)
      addLog(`Response: ${JSON.stringify(result, null, 2)}`)
      
      if (!response.ok) {
        setSyncError(result.error || `HTTP ${response.status}`)
      } else {
        setSyncResponse(result)
        
        // Wait a bit then check database state after sync
        addLog('Waiting 3 seconds before checking post-sync state...')
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        addLog('=== Database state after sync ===')
        await checkDatabaseState()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setSyncError(errorMessage)
      addLog(`Error: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const trackRepository = async () => {
    addLog(`Attempting to track repository ${owner}/${repo}...`)
    
    try {
      const { data, error } = await supabase
        .from('tracked_repositories')
        .insert({
          organization_name: owner,
          repository_name: repo,
          tracking_enabled: true
        })
        .select()
        .maybeSingle()
      
      if (error) {
        addLog(`Error tracking repository: ${error.message}`)
        addLog(`Error details: ${JSON.stringify(error, null, 2)}`)
      } else {
        addLog(`Successfully tracked repository: ${JSON.stringify(data, null, 2)}`)
      }
    } catch (error) {
      addLog(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>GitHub Sync Debug Tool</CardTitle>
          <CardDescription>
            Test and debug the GitHub sync functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Authentication Status */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {isLoggedIn
? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )
: (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span>
                    Authentication: {isLoggedIn ? 'Logged in' : 'Not logged in'}
                  </span>
                </div>
                {!isLoggedIn && (
                  <Button size="sm" onClick={login} className="mt-2">
                    Login with GitHub
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>

          {/* Repository Input */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="owner">Owner</Label>
              <Input
                id="owner"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="e.g., continuedev"
              />
            </div>
            <div>
              <Label htmlFor="repo">Repository</Label>
              <Input
                id="repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="e.g., continue"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={triggerSync}
              disabled={isLoading || !owner || !repo}
              className="flex items-center gap-2"
            >
              {isLoading
? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              )
: (
                <Database className="h-4 w-4" />
              )}
              Trigger Sync
            </Button>
            <Button 
              onClick={trackRepository}
              variant="outline"
              disabled={!owner || !repo}
            >
              Track Repository
            </Button>
            <Button 
              onClick={() => checkDatabaseState()}
              variant="outline"
            >
              Check Database
            </Button>
          </div>

          {/* Results */}
          <Tabs defaultValue="logs" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="response">Response</TabsTrigger>
              <TabsTrigger value="error">Errors</TabsTrigger>
            </TabsList>
            
            <TabsContent value="logs" className="space-y-2">
              <div className="bg-muted p-3 rounded-md max-h-96 overflow-y-auto">
                <pre className="text-xs font-mono">
                  {logs.length > 0 ? logs.join('\n') : 'No logs yet. Click "Trigger Sync" to start.'}
                </pre>
              </div>
            </TabsContent>
            
            <TabsContent value="response">
              {syncResponse && (
                <div className="bg-muted p-3 rounded-md">
                  <pre className="text-xs font-mono">
                    {JSON.stringify(syncResponse, null, 2)}
                  </pre>
                </div>
              )}
              {!syncResponse && !isLoading && (
                <Alert>
                  <AlertDescription>
                    No sync response yet. Trigger a sync to see the response.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
            
            <TabsContent value="error">
              {syncError && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <pre className="text-xs font-mono">{syncError}</pre>
                  </AlertDescription>
                </Alert>
              )}
              {!syncError && !isLoading && (
                <Alert>
                  <AlertDescription>
                    No errors detected.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}