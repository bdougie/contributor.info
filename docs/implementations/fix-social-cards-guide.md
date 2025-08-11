# Social Cards Setup Fix Guide

## Quick Fix for Social Card Generation

The social card system is well-implemented but blocked by a simple environment configuration issue.

### Issue
The `SUPABASE_TOKEN` environment variable contains a placeholder value instead of the actual service role key, preventing the storage bucket from being created.

### Solution

1. **Get the correct service role key**:
   - Visit https://supabase.com/dashboard/project/egcxzonpmmcirmgqdrla
   - Go to Settings → API
   - Copy the **service_role** key (starts with `eyJ`, ~500+ characters)

2. **Update your `.env` file**:
   ```bash
   # Replace the placeholder with the real service role key:
   SUPABASE_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS...
   ```

3. **Test and setup storage**:
   ```bash
   # Create the storage bucket
   npm run setup-storage
   
   # Generate social cards  
   npm run generate-social-cards
   ```

### Verification
After completing these steps:
- ✅ The `social-cards` bucket will exist in Supabase Storage
- ✅ Social cards will be generated during builds
- ✅ Cards will be accessible via CDN URLs
- ✅ Build process will include social card generation

### Alternative: Skip Storage Setup
If you want to use social cards without Supabase storage, the Netlify function at `/api/social-cards` already works and generates SVG cards on-demand with <100ms performance.

The storage system is just for caching pre-generated PNG cards during builds.