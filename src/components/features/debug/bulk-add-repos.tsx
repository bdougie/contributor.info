import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Database, Upload, CheckCircle, XCircle, Info } from "lucide-react";

interface ProcessResult {
  added: string[];
  skipped: string[];
  errors: string[];
  total: number;
}

export function BulkAddRepos() {
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const { toast } = useToast();

  const parseRepoList = (text: string): string[] => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#')) // Allow comments
      .filter(line => {
        // Validate owner/repo format
        const parts = line.split('/');
        return parts.length === 2 && parts[0] && parts[1];
      });
  };

  const checkExistingRepos = async (repos: string[]): Promise<Set<string>> => {
    const repoChecks = repos.map(repo => {
      const [owner, name] = repo.split('/');
      return { organization_name: owner, repository_name: name };
    });

    const { data: existing, error } = await supabase
      .from('tracked_repositories')
      .select('organization_name, repository_name')
      .in('organization_name', repoChecks.map(r => r.organization_name))
      .in('repository_name', repoChecks.map(r => r.repository_name));

    if (error) {
      throw new Error(`Failed to check existing repos: ${error.message}`);
    }

    const existingSet = new Set<string>();
    existing?.forEach(repo => {
      existingSet.add(`${repo.organization_name}/${repo.repository_name}`);
    });

    return existingSet;
  };

  const insertReposInBatches = async (
    repos: string[],
    batchSize: number = 15
  ): Promise<ProcessResult> => {
    const result: ProcessResult = {
      added: [],
      skipped: [],
      errors: [],
      total: repos.length
    };

    // Check existing repos first
    const existingRepos = await checkExistingRepos(repos);
    
    const newRepos = repos.filter(repo => !existingRepos.has(repo));
    result.skipped = repos.filter(repo => existingRepos.has(repo));

    if (newRepos.length === 0) {
      setProgress(100);
      return result;
    }

    // Process in batches
    for (let i = 0; i < newRepos.length; i += batchSize) {
      const batch = newRepos.slice(i, i + batchSize);
      
      const insertData = batch.map(repo => {
        const [owner, name] = repo.split('/');
        return {
          organization_name: owner,
          repository_name: name,
          tracking_enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });

      try {
        const { error } = await supabase
          .from('tracked_repositories')
          .insert(insertData);

        if (error) {
          // Handle individual repo failures
          batch.forEach(repo => result.errors.push(repo));
        } else {
          result.added.push(...batch);
        }
      } catch (error) {
        batch.forEach(repo => result.errors.push(repo));
      }

      // Update progress
      const processed = Math.min(i + batchSize, newRepos.length) + result.skipped.length;
      setProgress((processed / repos.length) * 100);
      
      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return result;
  };

  const handleProcess = async () => {
    if (!input.trim()) {
      toast({
        title: "No input provided",
        description: "Please paste a list of repositories to add.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResult(null);

    try {
      const repos = parseRepoList(input);
      
      if (repos.length === 0) {
        toast({
          title: "No valid repositories found",
          description: "Please ensure repositories are in 'owner/repo' format.",
          variant: "destructive"
        });
        return;
      }

      const result = await insertReposInBatches(repos);
      setResult(result);

      const successMessage = `${result.added.length} repos added, ${result.skipped.length} already tracked`;
      
      toast({
        title: "Bulk add completed",
        description: successMessage,
        variant: result.errors.length > 0 ? "destructive" : "default"
      });

    } catch (error) {
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setInput("");
    setResult(null);
    setProgress(0);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Database className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Bulk Add Repositories</h1>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Repository Input
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Textarea
                placeholder={`Paste repository list (one per line):
vue/vue
vitejs/vite
shadcn/ui
nestjs/nest
# Comments starting with # are ignored`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                disabled={isProcessing}
              />
            </div>
            
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Processing repositories...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={handleProcess} 
                disabled={isProcessing || !input.trim()}
                className="flex items-center gap-2"
              >
                <Database className="h-4 w-4" />
                {isProcessing ? "Processing..." : "Add Repositories"}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleClear}
                disabled={isProcessing}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Results Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Added:</span>
                  <Badge variant="secondary">{result.added.length}</Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Skipped:</span>
                  <Badge variant="outline">{result.skipped.length}</Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="font-medium">Errors:</span>
                  <Badge variant="destructive">{result.errors.length}</Badge>
                </div>
              </div>

              {result.skipped.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Already tracked repositories:</p>
                  <div className="text-xs text-muted-foreground bg-muted p-2 rounded max-h-32 overflow-y-auto">
                    {result.skipped.join(', ')}
                  </div>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2 text-red-600">Failed to add:</p>
                  <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/20 p-2 rounded max-h-32 overflow-y-auto">
                    {result.errors.join(', ')}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}