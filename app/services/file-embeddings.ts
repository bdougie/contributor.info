import { Octokit } from '@octokit/rest';
import { supabase } from '../../src/lib/supabase';
import { Repository } from '../types/github';
import { createHash } from 'crypto';

// Import the existing embedding service
import { generateEmbedding } from '../services/embeddings';

// Constants
const FILE_PROCESSING_BATCH_SIZE = 10;
const EMBEDDING_INSERT_BATCH_SIZE = 50;
const RATE_LIMIT_DELAY_MS = 1000;

interface FileEmbedding {
  repository_id: string;
  file_path: string;
  embedding: number[];
  content_hash: string;
  last_indexed_at: string;
}

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
};

/**
 * Sleep utility for retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with exponential backoff retry
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  operation: string,
  config = RETRY_CONFIG
): Promise<T> {
  let lastError: Error | unknown;
  let delay = config.initialDelay;
  
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`${operation} failed (attempt ${attempt}/${config.maxRetries}):`, error);
      
      if (attempt < config.maxRetries) {
        // Check if error is retryable
        if (isRetryableError(error)) {
          console.log("Retrying %s in %sms...", operation, delay);
          await sleep(delay);
          delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
        } else {
          // Non-retryable error, fail immediately
          throw error;
        }
      }
    }
  }
  
  console.error(`${operation} failed after ${config.maxRetries} attempts`);
  throw lastError;
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Network errors
    if (message.includes('network') || 
        message.includes('timeout') ||
        message.includes('econnrefused') ||
        message.includes('etimedout')) {
      return true;
    }
    
    // Rate limit errors
    if (message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('429')) {
      return true;
    }
    
    // Temporary server errors
    if (message.includes('502') ||
        message.includes('503') ||
        message.includes('504')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Process a single file to generate its embedding
 */
async function processFileEmbedding(
  filePath: string,
  repository: Repository,
  octokit: Octokit,
  repositoryId: string
): Promise<FileEmbedding | null> {
  try {
    // Skip non-code files
    if (!isCodeFile(filePath)) {
      return null;
    }
    
    // Fetch file content with retry
    const fileData = await withRetry(
      async () => {
        const { data } = await octokit.repos.getContent({
          owner: repository.owner.login,
          repo: repository.name,
          path: filePath,
        });
        return data;
      },
      `Fetching content for ${filePath}`
    );
    
    if ('content' in fileData && fileData.type === 'file') {
      // Decode base64 content
      const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
      
      // Generate content hash
      const contentHash = createHash('sha256')
        .update(content)
        .digest('hex');
      
      // Check if we already have an embedding for this exact content
      const existing = await withRetry(
        async () => {
          const { data, error } = await supabase
            .from('file_embeddings')
            .select('id')
            .eq('repository_id', repositoryId)
            .eq('file_path', filePath)
            .eq('content_hash', contentHash)
            .maybeSingle();
          
          // Supabase returns an error for no rows found, which is expected
          if (error && error.code !== 'PGRST116') {
            throw error;
          }
          
          return data;
        },
        `Checking existing embedding for ${filePath}`
      );
      
      if (existing) {
        console.log("Skipping %s - embedding already exists", filePath);
        return null;
      }
      
      // Prepare content for embedding (truncate if too long)
      const embeddingContent = prepareContentForEmbedding(filePath, content);
      
      // Generate embedding with retry
      const embedding = await withRetry(
        async () => generateEmbedding(embeddingContent),
        `Generating embedding for ${filePath}`
      );
      
      return {
        repository_id: repositoryId,
        file_path: filePath,
        embedding,
        content_hash: contentHash,
        last_indexed_at: new Date().toISOString(),
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    // Return null to continue processing other files
    return null;
  }
}

export async function generateFileEmbeddings(
  repository: Repository,
  octokit: Octokit,
  filePaths: string[]
): Promise<void> {
  console.log("Generating embeddings for %s files in %s", filePaths.length, repository.full_name);
  
  try {
    // Get repository record
    const { data: dbRepo, error: repoError } = await supabase
      .from('repositories')
      .select('id')
      .eq('github_id', repository.id)
      .maybeSingle();
    
    if (repoError) {
      console.error('Error fetching repository:', repoError);
      return;
    }
    
    if (!dbRepo) {
      console.error('Repository not found in database');
      return;
    }
    
    // Process files in batches
    for (let i = 0; i < filePaths.length; i += FILE_PROCESSING_BATCH_SIZE) {
      const batch = filePaths.slice(i, i + FILE_PROCESSING_BATCH_SIZE);
      const batchEmbeddings: FileEmbedding[] = [];
      
      // Process batch and collect embeddings
      const results = await Promise.all(
        batch.map(filePath => processFileEmbedding(filePath, repository, octokit, dbRepo.id))
      );
      
      // Filter out null results
      for (const embedding of results) {
        if (embedding) {
          batchEmbeddings.push(embedding);
        }
      }
      
      // Insert batch embeddings immediately to avoid memory buildup
      if (batchEmbeddings.length > 0) {
        await withRetry(
          async () => {
            const { error } = await supabase
              .from('file_embeddings')
              .upsert(batchEmbeddings, {
                onConflict: 'repository_id,file_path',
              });
            
            if (error) {
              throw error;
            }
            
            console.log("Inserted %s embeddings", batchEmbeddings.length);
          },
          `Inserting ${batchEmbeddings.length} embeddings`
        ).catch(error => {
          console.error('Error inserting file embeddings:', error);
          // Continue processing even if this batch fails
        });
      }
      
      // Add delay to avoid rate limiting
      if (i + FILE_PROCESSING_BATCH_SIZE < filePaths.length) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      }
    }
    
    console.log("Completed embedding generation for %s", repository.full_name);
    
  } catch (error) {
    console.error('Error generating file embeddings:', error);
    throw error;
  }
}


/**
 * Find similar files using vector similarity
 */
export async function findSimilarFiles(
  repositoryId: string,
  filePaths: string[],
  threshold: number = 0.8
): Promise<Map<string, { path: string; similarity: number }[]>> {
  try {
    const similarFiles = new Map<string, { path: string; similarity: number }[]>();
    
    // Get embeddings for the input files
    const { data: inputEmbeddings, error: embeddingsError } = await supabase
      .from('file_embeddings')
      .select('file_path, embedding')
      .eq('repository_id', repositoryId)
      .in('file_path', filePaths);
    
    if (embeddingsError) {
      console.error('Error fetching file embeddings:', embeddingsError);
      return similarFiles;
    }
    
    if (!inputEmbeddings || inputEmbeddings.length === 0) {
      return similarFiles;
    }
    
    // For each input file, find similar files
    for (const inputFile of inputEmbeddings) {
      // Use Supabase's vector similarity search
      const { data: similar, error: rpcError } = await supabase.rpc('match_file_embeddings', {
        query_embedding: inputFile.embedding,
        repository_id: repositoryId,
        match_threshold: threshold,
        match_count: 10,
      });
      
      if (rpcError) {
        console.error('Error finding similar files via RPC:', rpcError);
        continue;
      }
      
      if (similar && similar.length > 0) {
        similarFiles.set(
          inputFile.file_path,
          similar
            .filter((s: { file_path: string; similarity: number }) => s.file_path !== inputFile.file_path)
            .map((s: { file_path: string; similarity: number }) => ({
              path: s.file_path,
              similarity: s.similarity,
            }))
        );
      }
    }
    
    return similarFiles;
  } catch (error) {
    console.error('Error finding similar files:', error);
    return new Map();
  }
}

/**
 * Prepare file content for embedding generation
 */
function prepareContentForEmbedding(filePath: string, content: string): string {
  const maxLength = 8000; // Maximum characters for embedding
  
  // Extract the most important parts of the file
  let prepared = `File: ${filePath}\n\n`;
  
  // Add file extension context
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  prepared += `Type: ${getFileType(ext)}\n\n`;
  
  // For code files, try to extract important sections
  if (isCodeFile(filePath)) {
    // Extract imports/includes
    const imports = extractImports(content);
    if (imports) {
      prepared += `Imports:\n${imports}\n\n`;
    }
    
    // Extract function/class signatures
    const signatures = extractSignatures(content);
    if (signatures) {
      prepared += `Functions/Classes:\n${signatures}\n\n`;
    }
    
    // Add remaining content (truncated)
    const remainingSpace = maxLength - prepared.length - 100;
    if (remainingSpace > 0) {
      const truncatedContent = content.substring(0, remainingSpace);
      prepared += `Content:\n${truncatedContent}`;
    }
  } else {
    // For non-code files, just include the content
    prepared += content.substring(0, maxLength - prepared.length);
  }
  
  return prepared;
}

/**
 * Set of file extensions that are considered code files
 */
const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'java', 'go', 'rs',
  'cpp', 'c', 'h', 'hpp', 'cs', 'php', 'swift', 'kt', 'scala',
  'r', 'vue', 'svelte', 'sql', 'sh', 'bash', 'ps1', 'yaml', 'yml',
  'json', 'xml', 'html', 'css', 'scss', 'sass', 'less'
]);

/**
 * Check if a file is a code file
 */
function isCodeFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase();
  return ext ? CODE_EXTENSIONS.has(ext) : false;
}

/**
 * Map of file extensions to their descriptions
 */
const FILE_TYPE_MAP: Record<string, string> = {
  js: 'JavaScript',
  jsx: 'React JavaScript',
  ts: 'TypeScript',
  tsx: 'React TypeScript',
  py: 'Python',
  rb: 'Ruby',
  java: 'Java',
  go: 'Go',
  rs: 'Rust',
  cpp: 'C++',
  c: 'C',
  cs: 'C#',
  php: 'PHP',
  swift: 'Swift',
  kt: 'Kotlin',
  scala: 'Scala',
  r: 'R',
  vue: 'Vue.js',
  svelte: 'Svelte',
  sql: 'SQL',
  sh: 'Shell Script',
  bash: 'Bash Script',
  yaml: 'YAML Configuration',
  yml: 'YAML Configuration',
  json: 'JSON',
  xml: 'XML',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sass: 'Sass',
  less: 'Less',
};

/**
 * Get file type description
 */
function getFileType(ext: string): string {
  return FILE_TYPE_MAP[ext] || 'Unknown';
}

/**
 * Extract import statements from code
 */
function extractImports(content: string): string {
  const lines = content.split('\n');
  const imports: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // JavaScript/TypeScript imports
    if (trimmed.startsWith('import ') || trimmed.startsWith('export ') || trimmed.startsWith('require(')) {
      imports.push(trimmed);
    }
    // Python imports
    else if (trimmed.startsWith('from ') || trimmed.startsWith('import ')) {
      imports.push(trimmed);
    }
    // Java/C++ includes
    else if (trimmed.startsWith('#include') || trimmed.startsWith('using ')) {
      imports.push(trimmed);
    }
    
    // Stop after finding main code
    if (imports.length > 0 && trimmed === '') {
      break;
    }
  }
  
  return imports.slice(0, 20).join('\n');
}

/**
 * Extract function and class signatures
 */
function extractSignatures(content: string): string {
  const signatures: string[] = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // JavaScript/TypeScript functions and classes
    if (
      trimmed.match(/^(export\s+)?(async\s+)?function\s+\w+/) ||
      trimmed.match(/^(export\s+)?class\s+\w+/) ||
      trimmed.match(/^(export\s+)?const\s+\w+\s*=\s*(async\s*)?\(/) ||
      trimmed.match(/^\w+\s*:\s*(async\s*)?\([^)]*\)\s*=>/)
    ) {
      signatures.push(line);
    }
    // Python functions and classes
    else if (trimmed.match(/^def\s+\w+/) || trimmed.match(/^class\s+\w+/)) {
      signatures.push(line);
    }
    // Java/C++ methods and classes
    else if (
      trimmed.match(/^(public|private|protected)\s+/) &&
      (trimmed.includes('(') || trimmed.includes('class'))
    ) {
      signatures.push(line);
    }
  }
  
  return signatures.slice(0, 30).join('\n');
}

/**
 * Create the match_file_embeddings function in the database
 */
export async function createMatchFileEmbeddingsFunction(): Promise<void> {
  const sql = `
    CREATE OR REPLACE FUNCTION match_file_embeddings(
      query_embedding vector(384),
      repository_id uuid,
      match_threshold float,
      match_count int
    )
    RETURNS TABLE (
      file_path text,
      similarity float
    )
    LANGUAGE sql
    AS $$
      SELECT
        file_path,
        1 - (embedding <=> query_embedding) as similarity
      FROM file_embeddings
      WHERE 
        file_embeddings.repository_id = match_file_embeddings.repository_id
        AND 1 - (embedding <=> query_embedding) > match_threshold
      ORDER BY similarity DESC
      LIMIT match_count;
    $$;
  `;
  
  const { error } = await supabase.rpc('exec_sql', { sql });
  
  if (error) {
    console.error('Error creating match_file_embeddings function:', error);
  }
}