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
    
    // Fetch file content
    const { data: fileData } = await octokit.repos.getContent({
      owner: repository.owner.login,
      repo: repository.name,
      path: filePath,
    });
    
    if ('content' in fileData && fileData.type === 'file') {
      // Decode base64 content
      const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
      
      // Generate content hash
      const contentHash = createHash('sha256')
        .update(content)
        .digest('hex');
      
      // Check if we already have an embedding for this exact content
      const { data: existing } = await supabase
        .from('file_embeddings')
        .select('id')
        .eq('repository_id', repositoryId)
        .eq('file_path', filePath)
        .eq('content_hash', contentHash)
        .single();
      
      if (existing) {
        console.log(`Skipping ${filePath} - embedding already exists`);
        return null;
      }
      
      // Prepare content for embedding (truncate if too long)
      const embeddingContent = prepareContentForEmbedding(filePath, content);
      
      // Generate embedding
      const embedding = await generateEmbedding(embeddingContent);
      
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
    return null;
  }
}

export async function generateFileEmbeddings(
  repository: Repository,
  octokit: Octokit,
  filePaths: string[]
): Promise<void> {
  console.log(`Generating embeddings for ${filePaths.length} files in ${repository.full_name}`);
  
  try {
    // Get repository record
    const { data: dbRepo } = await supabase
      .from('repositories')
      .select('id')
      .eq('github_id', repository.id)
      .single();
    
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
        const { error } = await supabase
          .from('file_embeddings')
          .upsert(batchEmbeddings, {
            onConflict: 'repository_id,file_path',
          });
        
        if (error) {
          console.error('Error inserting file embeddings:', error);
        } else {
          console.log(`Inserted ${batchEmbeddings.length} embeddings`);
        }
      }
      
      // Add delay to avoid rate limiting
      if (i + FILE_PROCESSING_BATCH_SIZE < filePaths.length) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      }
    }
    
    console.log(`Completed embedding generation for ${repository.full_name}`);
    
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
    const { data: inputEmbeddings } = await supabase
      .from('file_embeddings')
      .select('file_path, embedding')
      .eq('repository_id', repositoryId)
      .in('file_path', filePaths);
    
    if (!inputEmbeddings || inputEmbeddings.length === 0) {
      return similarFiles;
    }
    
    // For each input file, find similar files
    for (const inputFile of inputEmbeddings) {
      // Use Supabase's vector similarity search
      const { data: similar } = await supabase.rpc('match_file_embeddings', {
        query_embedding: inputFile.embedding,
        repository_id: repositoryId,
        match_threshold: threshold,
        match_count: 10,
      });
      
      if (similar && similar.length > 0) {
        similarFiles.set(
          inputFile.file_path,
          similar
            .filter((s: any) => s.file_path !== inputFile.file_path)
            .map((s: any) => ({
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
 * Check if a file is a code file
 */
function isCodeFile(filePath: string): boolean {
  const codeExtensions = new Set([
    'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'java', 'go', 'rs',
    'cpp', 'c', 'h', 'hpp', 'cs', 'php', 'swift', 'kt', 'scala',
    'r', 'vue', 'svelte', 'sql', 'sh', 'bash', 'ps1', 'yaml', 'yml',
    'json', 'xml', 'html', 'css', 'scss', 'sass', 'less'
  ]);
  
  const ext = filePath.split('.').pop()?.toLowerCase();
  return ext ? codeExtensions.has(ext) : false;
}

/**
 * Get file type description
 */
function getFileType(ext: string): string {
  const typeMap: Record<string, string> = {
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
  
  return typeMap[ext] || 'Unknown';
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