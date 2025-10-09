import type { Context, Config } from "@netlify/functions";
import { promises as fs } from 'fs';
import * as path from 'path';

export default async (req: Request, context: Context) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      }
    });
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }

  // Extract the doc filename from URL
  const url = new URL(req.url);
  const filename = url.searchParams.get('file');
  
  if (!filename) {
    return new Response(JSON.stringify({ error: 'Missing file parameter' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }

  // Validate filename to prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.md')) {
    return new Response(JSON.stringify({ error: 'Invalid file parameter' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }

  try {
    // Try multiple potential paths where docs might be located
    const possiblePaths = [
      // In Netlify production, the docs should be in dist folder
      path.join(process.cwd(), 'dist', 'docs', filename),
      path.join(process.cwd(), 'docs', filename),
      path.join(process.cwd(), 'public', 'docs', filename),
      // Try relative paths from function location
      path.join(process.cwd(), '..', 'dist', 'docs', filename),
      path.join(process.cwd(), '..', 'public', 'docs', filename),
    ];

    let content: string | null = null;
    let successPath: string | null = null;
    const errors: string[] = [];

    for (const docPath of possiblePaths) {
      try {
        content = await fs.readFile(docPath, 'utf-8');
        successPath = docPath;
        break;
      } catch (e: any) {
        errors.push(`${docPath}: ${e.message}`);
        continue;
      }
    }

    if (!content) {
      console.error(`Doc file ${filename} not found. Tried paths:`, errors);
      console.error('Current directory:', process.cwd());
      console.error('Environment:', {
        NETLIFY: process.env.NETLIFY,
        NODE_ENV: process.env.NODE_ENV,
      });
      
      // Try to list what's actually in the directories for debugging
      try {
        const contents = await fs.readdir(process.cwd());
        console.error('Current directory contents:', contents);
        
        // Check if dist folder exists
        try {
          const distPath = path.join(process.cwd(), 'dist');
          const distContents = await fs.readdir(distPath);
          console.error('Dist folder contents:', distContents);
          
          // Check if dist/docs exists
          try {
            const distDocsPath = path.join(distPath, 'docs');
            const distDocsContents = await fs.readdir(distDocsPath);
            console.error('Dist/docs folder contents:', distDocsContents);
          } catch {
            console.error('No docs folder in dist directory');
          }
        } catch {
          console.error('No dist folder in current directory');
        }

        // Check if docs folder exists at root
        try {
          const docsPath = path.join(process.cwd(), 'docs');
          const docsContents = await fs.readdir(docsPath);
          console.error('Root docs folder contents:', docsContents);
        } catch {
          console.error('No docs folder in root directory');
        }
      } catch (e) {
        console.error('Could not list directory contents:', e);
      }
      
      return new Response(JSON.stringify({ 
        error: 'Documentation file not found',
        filename,
        triedPaths: errors,
        cwd: process.cwd()
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    console.log(`Successfully read doc from: ${successPath}`);
    
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error: any) {
    console.error(`Error in docs-content function for ${filename}:`, error);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
};

// Export configuration
export const config: Config = {
  path: "/.netlify/functions/docs-content"
};