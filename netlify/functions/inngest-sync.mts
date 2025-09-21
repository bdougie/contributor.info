// Inngest sync endpoint that enables hybrid routing from PR #754
// This endpoint allows Inngest to sync/discover functions while also
// routing long-running jobs to Supabase to avoid timeouts

import { serve } from "inngest/lambda";
import type { Handler } from "@netlify/functions";

// Re-export the main handler from inngest-prod
// This provides all the Inngest SDK functionality
import inngestProdHandler from "./inngest-prod.mjs";

// For now, we simply alias inngest-prod to provide the /inngest-sync path
// The actual hybrid routing happens via inngest-hybrid.ts
//
// Configuration in Inngest Dashboard:
// 1. Sync URL: https://contributor.info/.netlify/functions/inngest-sync (this file)
// 2. Webhook URL: https://contributor.info/.netlify/functions/inngest-hybrid (for routing)
//
// This separation allows:
// - Inngest to discover functions via this SDK endpoint
// - Webhooks to be routed through inngest-hybrid for timeout management

const handler: Handler = inngestProdHandler;

export default handler;