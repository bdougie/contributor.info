# Fix Social Cards Setup

## Current Issue
The social-cards bucket is empty because the service role key in `.env` is incorrect.

## Steps to Fix

### 1. Get the Correct Service Role Key

Go to your Supabase project dashboard:
1. Visit https://supabase.com/dashboard/project/egcxzonpmmcirmgqdrla
2. Go to Settings → API
3. Copy the **service_role** key (not the anon key)
4. The service role key should start with `eyJ` and be very long (500+ characters)

### 2. Update Environment Variables

Replace the `SUPABASE_TOKEN` in your `.env` file:

```bash
# Replace this line in .env:
SUPABASE_TOKEN=sbp_c40e1097d128c690e0bd5457c3b7b5fdecfa05b9

# With the real service role key:
SUPABASE_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnY3h6...
```

### 3. Test the Connection

```bash
# Load environment and test
export $(cat .env | xargs) && node scripts/check-bucket-status.js
```

### 4. Create the Storage Bucket

```bash
# This should work once you have the right service key
export $(cat .env | xargs) && npm run setup-storage
```

### 5. Generate Social Cards

```bash
# Start dev server in one terminal
npm run dev

# In another terminal, generate cards
export $(cat .env | xargs) && npm run generate-social-cards
```

## Expected Result

After following these steps:
- The `social-cards` bucket will be created in Supabase Storage
- Social cards will be generated and uploaded
- Cards will be accessible via CDN URLs
- The bucket will show files in your Supabase dashboard

## Verification

You can verify success by:
1. Checking the Supabase dashboard → Storage → social-cards bucket
2. Testing a social card URL in your browser
3. Running `npm run monitor-cdn` to check performance

## Troubleshooting

If you still have issues:
1. Verify the service role key is copied correctly (no extra spaces/newlines)
2. Check that the Supabase project ID matches: `egcxzonpmmcirmgqdrla`
3. Ensure you have proper permissions in the Supabase project