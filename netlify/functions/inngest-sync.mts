// Alias endpoint for Inngest sync operations
// Provides /inngest-sync path by re-exporting inngest-prod

import mainHandler from "./inngest-prod.mjs";

// Simply re-export the inngest-prod handler
// Inngest will use the path from the URL, not from servePath
export default mainHandler;