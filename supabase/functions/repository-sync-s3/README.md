# Repository Sync with Persistent S3 Storage

This function implements a Proof of Concept (PoC) for using Deno 2.1 persistent file storage (S3-compatible mounts) in Supabase Edge Functions.

## Purpose

To explore how persistent file storage can enable "Large PR Data Processing" by offloading memory to disk (S3 mount) during execution. This allows handling large repositories without hitting memory limits of the Edge Runtime.

## How it works

1.  **Fetch Phase**: The function fetches Pull Requests from GitHub page by page.
2.  **Buffer to Disk**: Instead of storing all PRs in an in-memory array (which can crash the function for large repos), it streams/appends them to a file on the mounted S3 volume (e.g., `/s3/temp/...`).
3.  **Process Phase**: Once fetching is complete (or a limit is reached), it reads the file line-by-line (or in chunks) and processes the data, upserting it to the database.
4.  **Cleanup**: The temporary file is deleted after processing.

## Configuration

This function expects a standard Supabase Edge Function environment with:
-   `GITHUB_TOKEN`: For accessing GitHub API.
-   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: For database access.
-   **S3 Mount**: The environment must have the S3 mount configured at `/s3` (or the function needs to be updated to the correct mount point).

## Usage

Invoke via Supabase Client:

```typescript
const { data, error } = await supabase.functions.invoke('repository-sync-s3', {
  body: {
    owner: 'bdougie',
    name: 'contributor.info',
    fullSync: false
  }
})
```
