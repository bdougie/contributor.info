import { Octokit } from '@octokit/rest';
import { supabase } from '../../src/lib/supabase';
import { Repository } from '../types/github';

interface FileContributor {
  file_path: string;
  contributor_id: string;
  commit_count: number;
  last_commit_at: string;
}


/**
 * Index git history for a repository
 */
export async function indexGitHistory(
  repository: Repository,
  octokit: Octokit,
  since?: Date
): Promise<void> {
  console.log(`Starting git history indexing for ${repository.full_name}`);
  
  try {
    // Get or create repository record
    const { data: dbRepo, error } = await supabase
      .from('repositories')
      .select('id')
      .eq('github_id', repository.id)
      .maybeSingle();
    
    if (error || !dbRepo) {
      console.error('Error fetching repository from database:', error?.message || 'Repository not found');
      return;
    }
    
    // Determine the date to start indexing from
    const sinceDate = since || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000); // 6 months ago
    
    // Configuration for chunked processing
    const CHUNK_SIZE = 50; // Process and flush every 50 commits
    const MAX_COMMITS = 1000; // Overall limit
    
    // Track file contributors - will be flushed periodically
    const fileContributors = new Map<string, Map<string, FileContributor>>();
    
    let page = 1;
    let hasMoreCommits = true;
    let processedCommits = 0;
    let totalFlushedRecords = 0;
    
    // Helper function to flush file contributors to database
    const flushFileContributors = async () => {
      if (fileContributors.size === 0) return;
      
      const allFileContributors: Array<{
        repository_id: string;
        file_path: string;
        contributor_id: string;
        commit_count: number;
        last_commit_at: string;
      }> = [];
      
      for (const [, contributors] of fileContributors.entries()) {
        for (const [, data] of contributors.entries()) {
          allFileContributors.push({
            repository_id: dbRepo.id,
            file_path: data.file_path,
            contributor_id: data.contributor_id,
            commit_count: data.commit_count,
            last_commit_at: data.last_commit_at,
          });
        }
      }
      
      // Insert in batches of 100
      for (let i = 0; i < allFileContributors.length; i += 100) {
        const batch = allFileContributors.slice(i, i + 100);
        
        const { error } = await supabase
          .from('file_contributors')
          .upsert(batch, {
            onConflict: 'repository_id,file_path,contributor_id',
          });
        
        if (error) {
          console.error('Error inserting file contributors:', error);
        } else {
          totalFlushedRecords += batch.length;
        }
      }
      
      console.log(`Flushed ${allFileContributors.length} file contributor records`);
      
      // Clear the map to free memory
      fileContributors.clear();
    };
    
    while (hasMoreCommits && processedCommits < MAX_COMMITS) {
      try {
        const { data: commits } = await octokit.repos.listCommits({
          owner: repository.owner.login,
          repo: repository.name,
          since: sinceDate.toISOString(),
          per_page: 100,
          page,
        });
        
        if (commits.length === 0) {
          hasMoreCommits = false;
          break;
        }
        
        // Process each commit
        for (const commit of commits) {
          if (!commit.author?.login) continue;
          
          // Get detailed commit info with files
          try {
            const { data: detailedCommit } = await octokit.repos.getCommit({
              owner: repository.owner.login,
              repo: repository.name,
              ref: commit.sha,
            });
            
            // Get or create contributor
            let contributorId: string;
            
            const { data: existingContributor, error: fetchError } = await supabase
              .from('contributors')
              .select('id')
              .eq('github_login', commit.author.login)
              .maybeSingle();
            
            if (fetchError) {
              console.error(`Error fetching contributor ${commit.author.login}:`, fetchError);
              continue;
            }
            
            if (!existingContributor) {
              // Create contributor if doesn't exist
              const { data: newContributor, error: insertError } = await supabase
                .from('contributors')
                .insert({
                  github_id: commit.author.id,
                  github_login: commit.author.login,
                  name: commit.commit.author?.name || commit.author.login,
                  avatar_url: commit.author.avatar_url,
                })
                .select('id')
                .maybeSingle();
              
              if (insertError) {
                console.error(`Error creating contributor ${commit.author.login}:`, insertError);
                continue;
              }
              
              if (!newContributor) continue;
              contributorId = newContributor.id;
            } else {
              contributorId = existingContributor.id;
            }
            
            // Process files in the commit
            if (detailedCommit.files) {
              for (const file of detailedCommit.files) {
                if (!file.filename) continue;
                
                // Initialize file map if needed
                if (!fileContributors.has(file.filename)) {
                  fileContributors.set(file.filename, new Map());
                }
                
                const fileMap = fileContributors.get(file.filename)!;
                
                // Update or create contributor entry for this file
                const existing = fileMap.get(contributorId) || {
                  file_path: file.filename,
                  contributor_id: contributorId,
                  commit_count: 0,
                  last_commit_at: commit.commit.author?.date || new Date().toISOString(),
                };
                
                existing.commit_count++;
                existing.last_commit_at = commit.commit.author?.date || existing.last_commit_at;
                
                fileMap.set(contributorId, existing);
              }
            }
            
            processedCommits++;
            
            // Flush data periodically to avoid memory buildup
            if (processedCommits % CHUNK_SIZE === 0) {
              await flushFileContributors();
            }
            
            // Add small delay to avoid rate limiting
            if (processedCommits % 10 === 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } catch (error) {
            console.error(`Error processing commit ${commit.sha}:`, error);
          }
        }
        
        hasMoreCommits = commits.length === 100;
        page++;
      } catch (error) {
        console.error(`Error fetching commits page ${page}:`, error);
        hasMoreCommits = false;
      }
    }
    
    // Final flush for any remaining data
    await flushFileContributors();
    
    console.log(`Git history indexing completed for ${repository.full_name}`);
    console.log(`Processed ${processedCommits} commits, flushed ${totalFlushedRecords} file contributor records`);
    
  } catch (error) {
    console.error('Error indexing git history:', error);
    throw error;
  }
}

/**
 * Update git history incrementally for new commits
 */
export async function updateGitHistoryIncremental(
  repository: Repository,
  octokit: Octokit,
  lastSyncedAt: Date
): Promise<void> {
  // Use the same logic as indexGitHistory but with a more recent since date
  await indexGitHistory(repository, octokit, lastSyncedAt);
}

/**
 * Find contributors who have worked on similar files
 */
export async function findFileContributors(
  repositoryId: string,
  filePaths: string[]
): Promise<Map<string, { login: string; name: string; avatarUrl: string; fileCount: number; totalCommits: number }>> {
  try {
    // Query file contributors for the given files
    const { data: fileContributors, error } = await supabase
      .from('file_contributors')
      .select(`
        contributor_id,
        commit_count,
        contributors!inner (
          id,
          github_login,
          name,
          avatar_url
        )
      `)
      .eq('repository_id', repositoryId)
      .in('file_path', filePaths);
    
    if (error) {
      console.error('Error fetching file contributors:', error);
      return new Map();
    }
    
    if (!fileContributors || fileContributors.length === 0) {
      return new Map();
    }
    
    // Define the return type for contributor map entries
    type ContributorMapEntry = {
      login: string;
      name: string;
      avatarUrl: string;
      fileCount: number;
      totalCommits: number;
    };
    
    // Aggregate by contributor
    const contributorMap = new Map<string, ContributorMapEntry>();
    
    // Type the query result
    type FileContributorResult = {
      contributor_id: string;
      commit_count: number;
      contributors: {
        id: string;
        github_login: string;
        name: string | null;
        avatar_url: string;
      };
    };
    
    for (const fc of fileContributors as FileContributorResult[]) {
      const contributor = fc.contributors;
      if (!contributor) continue;
      
      const existing = contributorMap.get(contributor.github_login) || {
        login: contributor.github_login,
        name: contributor.name || contributor.github_login,
        avatarUrl: contributor.avatar_url,
        fileCount: 0,
        totalCommits: 0,
      };
      
      existing.fileCount++;
      existing.totalCommits += fc.commit_count;
      
      contributorMap.set(contributor.github_login, existing);
    }
    
    return contributorMap;
  } catch (error) {
    console.error('Error finding file contributors:', error);
    return new Map();
  }
}

/**
 * Get expertise areas based on file paths
 */
export function getExpertiseFromFiles(filePaths: string[]): string[] {
  const expertise = new Set<string>();
  
  for (const path of filePaths) {
    // Frontend
    if (path.match(/\.(tsx?|jsx?|vue|svelte)$/)) {
      expertise.add('frontend');
    }
    
    // Backend/API
    if (path.includes('/api/') || path.includes('/server/') || path.match(/^api\//) || path.match(/\.(py|rb|java|go)$/)) {
      expertise.add('backend');
    }
    
    // Database
    if (path.match(/\.(sql|migration)/) || path.includes('/migrations/')) {
      expertise.add('database');
    }
    
    // Testing
    if (path.includes('test') || path.includes('spec') || path.match(/\.(test|spec)\./)) {
      expertise.add('testing');
    }
    
    // Auth/Security
    if (path.includes('auth') || path.includes('security') || path.includes('permission')) {
      expertise.add('security');
    }
    
    // DevOps
    if (path.match(/\.(yml|yaml)$/) || path.includes('.github/') || path.includes('docker')) {
      expertise.add('devops');
    }
    
    // Documentation
    if (path.match(/\.(md|mdx|rst)$/) || path.includes('/docs/')) {
      expertise.add('documentation');
    }
    
    // Styles
    if (path.match(/\.(css|scss|sass|less)$/)) {
      expertise.add('styling');
    }
  }
  
  return Array.from(expertise);
}