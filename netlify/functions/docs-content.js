const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event, context) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Extract the doc filename from query parameters
  const filename = event.queryStringParameters?.file;
  
  if (!filename) {
    return {
      statusCode: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Missing file parameter' })
    };
  }

  // Validate filename to prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.md')) {
    return {
      statusCode: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Invalid file parameter' })
    };
  }

  try {
    // Try multiple potential paths where docs might be located
    const possiblePaths = [
      // In Netlify, the dist folder is the root
      path.join(process.cwd(), 'docs', filename),
      path.join(process.cwd(), 'dist', 'docs', filename),
      path.join(process.cwd(), 'public', 'docs', filename),
      // Try relative paths
      path.join(__dirname, '..', '..', 'docs', filename),
      path.join(__dirname, '..', '..', 'dist', 'docs', filename),
      path.join(__dirname, '..', '..', 'public', 'docs', filename),
    ];

    let content = null;
    let successPath = null;
    const errors = [];

    for (const docPath of possiblePaths) {
      try {
        content = await fs.readFile(docPath, 'utf-8');
        successPath = docPath;
        break;
      } catch (e) {
        errors.push(`${docPath}: ${e.message}`);
        continue;
      }
    }

    if (!content) {
      console.error(`Doc file ${filename} not found. Tried paths:`, errors);
      console.error('Current directory:', process.cwd());
      console.error('__dirname:', __dirname);
      console.error('Environment:', {
        NETLIFY: process.env.NETLIFY,
        NODE_ENV: process.env.NODE_ENV,
      });
      
      // Try to list what's actually in the directories
      try {
        const contents = await fs.readdir(process.cwd());
        console.error('Current directory contents:', contents);
        
        // Check if docs folder exists
        try {
          const docsPath = path.join(process.cwd(), 'docs');
          const docsContents = await fs.readdir(docsPath);
          console.error('Docs folder contents:', docsContents);
        } catch {
          console.error('No docs folder in current directory');
        }
        
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
      } catch (e) {
        console.error('Could not list directory contents:', e.message);
      }
      
      return {
        statusCode: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Documentation file not found',
          filename,
          triedPaths: errors,
          cwd: process.cwd(),
          dirname: __dirname
        })
      };
    }

    console.log(`Successfully read doc from: ${successPath}`);
    
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/markdown',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
      body: content
    };
  } catch (error) {
    console.error(`Error in docs-content function for ${filename}:`, error);
    
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};