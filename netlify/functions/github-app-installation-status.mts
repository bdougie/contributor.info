import type { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

export default async (req: Request, _context: Context) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Credentials': 'true'
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: corsHeaders
    });
  }

  // Only allow GET requests
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  
  const url = new URL(req.url);
  const owner = url.searchParams.get("owner");
  const repo = url.searchParams.get("repo");
  
  if (!owner || !repo) {
    return new Response(JSON.stringify({ error: "Missing owner or repo parameter" }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  
  try {
    // For now, hard-code that the app is installed on bdougie/contributor.info
    // In production, this would check the actual GitHub App installations in the database
    const isInstalled = owner === "bdougie" && repo === "contributor.info";
    
    if (isInstalled) {
      return new Response(JSON.stringify({ 
        installed: true,
        installationId: 123456789, // Placeholder
        installedAt: "2024-01-01T00:00:00Z"
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "max-age=60", // Cache for 1 minute
        }
      });
    }
    
    // Return not installed for other repositories
    return new Response(JSON.stringify({ installed: false }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "max-age=60",
      }
    });
    
  } catch (error) {
    console.error("Error checking GitHub App installation:", error);
    return new Response(JSON.stringify({ installed: false }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "max-age=60",
      }
    });
  }
};