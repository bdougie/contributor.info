import { Handler } from '@netlify/functions';
import fs from 'fs/promises';
import path from 'path';

/**
 * Netlify function to serve documentation content dynamically
 * This allows us to keep markdown files out of the JavaScript bundle
 */
export const handler: Handler = async (event) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Extract the doc filename from query parameters
  const filename = event.queryStringParameters?.file;
  
  if (!filename) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing file parameter' }),
    };
  }

  // Validate filename to prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.md')) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid file parameter' }),
    };
  }

  try {
    // Read the markdown file from the public/docs directory
    const docPath = path.join(process.cwd(), 'public', 'docs', filename);
    const content = await fs.readFile(docPath, 'utf-8');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/markdown',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
      body: content,
    };
  } catch (error) {
    console.error(`Error reading doc file ${filename}:`, error);
    
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Documentation file not found' }),
    };
  }
};