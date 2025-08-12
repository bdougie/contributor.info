# Troubleshooting Repository Tracking Issues

## Common Issues and Solutions

### Issue: "Function not found" error when clicking Track Repository

**Symptoms:**
- Clicking "Track This Repository" returns a 404 error
- Console shows "Function not found" for api-track-repository

**Solution:**
The tracking API uses a custom path. Ensure the frontend is calling `/api/track-repository` (not `/.netlify/functions/api-track-repository`).

### Issue: Events going to production Inngest in local development

**Symptoms:**
- Local events appear in production Inngest dashboard
- Local testing affects production data

**Solutions:**
1. Set `INNGEST_EVENT_KEY=local_development_only` in your `.env` file
2. Restart the development server with `npm start`
3. Verify events appear at `http://localhost:8288/events`

### Issue: Module format errors with Netlify Functions

**Symptoms:**
- Errors about CommonJS vs ES modules
- "exports is not defined" or "require is not defined" errors

**Solution:**
Netlify functions must use the `.mts` extension for ES modules when package.json has `"type": "module"`. Convert any `.js` functions to `.mts` format.

### Issue: Repository tracking not persisting to database

**Symptoms:**
- Tracking appears successful but data doesn't appear
- Repository remains untracked after refresh

**Possible Causes:**
1. **Inngest function not registered**: Check that `discoverNewRepository` is in the functions array in `inngest.mts`
2. **Database permissions**: Verify RLS policies allow inserting tracked repositories
3. **Event routing**: Ensure events are reaching the correct Inngest instance

**Debugging Steps:**
```bash
# Check Inngest functions are registered
curl http://localhost:8888/.netlify/functions/inngest-local-full

# Monitor Inngest events
open http://localhost:8288/events

# Check Supabase logs
npx supabase logs --project-ref <your-project-ref>
```

## Local Development Setup

### Required Services
1. **Vite** (port 5174): Frontend development server
2. **Netlify Dev** (port 8888): Serves functions and handles routing
3. **Inngest Dev** (port 8288): Processes background jobs locally

### Starting Development Environment
```bash
# Start all services
npm start

# Or start individually:
# Terminal 1: Frontend
npm run dev

# Terminal 2: Netlify functions
netlify dev

# Terminal 3: Inngest
npx inngest-cli@latest dev -u http://127.0.0.1:8888/.netlify/functions/inngest-local-full
```

### Environment Variables for Local Development
```env
# Force local Inngest routing
INNGEST_EVENT_KEY=local_development_only

# Local Inngest configuration
INNGEST_SERVE_HOST=http://127.0.0.1:8888
INNGEST_SERVE_PATH=/.netlify/functions/inngest-local
```

## Debugging Tools

### Check Function Registration
```javascript
// In browser console
fetch('/.netlify/functions/inngest-local-full')
  .then(r => r.json())
  .then(data => console.log('Registered functions:', data.functions))
```

### Monitor Network Requests
1. Open browser DevTools → Network tab
2. Click "Track Repository"
3. Look for `/api/track-repository` request
4. Check response status and payload

### Verify Inngest Event Processing
1. Navigate to `http://localhost:8288/events`
2. Look for `discover/repository.new` events
3. Click on event to see processing status
4. Check for any error messages in function runs

## Production Deployment

### Pre-deployment Checklist
- [ ] Remove all `console.log` statements from functions
- [ ] Set production environment variables in Netlify
- [ ] Ensure `INNGEST_PRODUCTION_EVENT_KEY` is configured
- [ ] Test in deploy preview before merging

### Post-deployment Verification
1. Check Netlify function logs for errors
2. Monitor Inngest production dashboard
3. Test tracking with a small repository first
4. Verify data appears in production Supabase

## Related Documentation
- [Manual Repository Tracking Guide](./manual-repository-tracking.md)
- [Inngest Functions Documentation](../inngest/README.md)
- [Supabase RLS Policies](../supabase/RLS_POLICIES.md)