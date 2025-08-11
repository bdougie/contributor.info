import type { Context, Config } from "@netlify/functions";
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    // Try multiple potential paths where docs might be located
    const possiblePaths = [
      // In production, files are in the dist folder
      path.join(__dirname, '..', '..', 'dist', 'docs', filename),
      // Alternative production path
      path.join(__dirname, '..', '..', 'public', 'docs', filename),
      // Local development path
      path.join(process.cwd(), 'public', 'docs', filename),
      // Another possible production path
      path.join(process.cwd(), 'dist', 'docs', filename),
    ];

    let content: string | null = null;
    let successPath: string | null = null;

    for (const docPath of possiblePaths) {
      try {
        content = await fs.readFile(docPath, 'utf-8');
        successPath = docPath;
        break;
      } catch (e) {
        // Try next path
        continue;
      }
    }

    if (!content) {
      console.error(`Doc file ${filename} not found in any of the following paths:`, possiblePaths);
      console.error('Current directory:', process.cwd());
      console.error('__dirname:', __dirname);
      console.error('Environment:', {
        NETLIFY: process.env.NETLIFY,
        NODE_ENV: process.env.NODE_ENV,
      });
      
      // Try to list what's actually in the directories for debugging
      try {
        const baseDir = path.join(__dirname, '..', '..');
        const contents = await fs.readdir(baseDir);
        console.error('Base directory contents:', contents);
      } catch (e) {
        console.error('Could not list base directory contents');
      }
      
      return new Response(JSON.stringify({ error: 'Documentation file not found' }), {
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
  } catch (error) {
    console.error(`Error reading doc file ${filename}:`, error);
    
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config: Config = {
  path: "/.netlify/functions/docs-content"
};