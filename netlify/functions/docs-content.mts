import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Extract the doc filename from URL
  const url = new URL(req.url);
  const filename = url.searchParams.get('file');
  
  if (!filename) {
    return new Response(JSON.stringify({ error: 'Missing file parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Validate filename to prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.md')) {
    return new Response(JSON.stringify({ error: 'Invalid file parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Import fs dynamically to avoid bundling issues
    const { promises: fs } = await import('fs');
    const path = await import('path');
    
    // Try multiple potential paths where docs might be located
    const possiblePaths = [
      // In production, try the included path first
      path.join(process.cwd(), 'docs', filename),
      // Try dist folder
      path.join(process.cwd(), 'dist', 'docs', filename),
      // Try public folder
      path.join(process.cwd(), 'public', 'docs', filename),
      // Try relative to function
      path.join(process.cwd(), '..', '..', 'docs', filename),
      path.join(process.cwd(), '..', '..', 'dist', 'docs', filename),
      path.join(process.cwd(), '..', '..', 'public', 'docs', filename),
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
      
      // Try to list what's actually in the current directory
      try {
        const contents = await fs.readdir(process.cwd());
        console.error('Current directory contents:', contents);
        
        // Check if docs folder exists
        try {
          const docsContents = await fs.readdir(path.join(process.cwd(), 'docs'));
          console.error('Docs folder contents:', docsContents);
        } catch {
          console.error('No docs folder in current directory');
        }
        
        // Check if dist folder exists
        try {
          const distContents = await fs.readdir(path.join(process.cwd(), 'dist'));
          console.error('Dist folder contents:', distContents);
        } catch {
          console.error('No dist folder in current directory');
        }
      } catch (e) {
        console.error('Could not list directory contents');
      }
      
      return new Response(JSON.stringify({ 
        error: 'Documentation file not found',
        filename,
        triedPaths: errors,
        cwd: process.cwd()
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Successfully read doc from: ${successPath}`);
    
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
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
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config: Config = {
  path: "/.netlify/functions/docs-content"
};