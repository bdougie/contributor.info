# API Documentation

This folder contains documentation for backend API endpoints, including REST APIs, Edge Functions, and webhook handlers.

## Contents

### CODEOWNERS Integration

- **[codeowners-api.md](./codeowners-api.md)** - API endpoints for CODEOWNERS integration and reviewer suggestions

## Purpose

This directory documents:
- API endpoint specifications
- Request/response formats
- Authentication requirements
- Rate limiting
- Error handling
- Usage examples

## API Architecture

### Netlify Functions
Serverless functions deployed on Netlify:
- Health checks
- CODEOWNERS operations
- Reviewer suggestions
- Repository queries

### Supabase Edge Functions
Deno-based functions on Supabase:
- GitHub data sync
- Embeddings generation
- Workspace operations
- Background processing

### API Endpoints

#### Health Check
```
GET /.netlify/functions/health-check
```
Returns system health status.

#### CODEOWNERS Operations
```
GET  /api/repos/{owner}/{repo}/codeowners
GET  /api/repos/{owner}/{repo}/suggested-codeowners
POST /api/repos/{owner}/{repo}/suggest-reviewers
GET  /api/repos/{owner}/{repo}/file-tree
```

## Authentication

### GitHub OAuth
User authentication via GitHub OAuth flow.

### API Tokens
Service-to-service authentication using bearer tokens.

### Service Role Keys
Backend services use Supabase service role key for privileged operations.

## Request/Response Format

### Successful Response
```json
{
  "data": {...},
  "success": true,
  "timestamp": "2025-01-28T12:00:00Z"
}
```

### Error Response
```json
{
  "error": "Error message",
  "success": false,
  "code": "ERROR_CODE"
}
```

## HTTP Status Codes

- **200 OK** - Successful request
- **201 Created** - Resource created
- **400 Bad Request** - Invalid input
- **401 Unauthorized** - Authentication required
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Resource not found
- **429 Too Many Requests** - Rate limit exceeded
- **500 Internal Server Error** - Server error
- **503 Service Unavailable** - Service temporarily unavailable

## Rate Limiting

Current implementation:
- No explicit rate limiting on most endpoints
- GitHub API rate limits apply to upstream calls
- Exponential backoff handles transient failures

Recommended rate limits:
- Anonymous: 60 requests/hour
- Authenticated: 5000 requests/hour
- Service accounts: Unlimited

## Caching

### Cache Durations
- CODEOWNERS content: 5 minutes
- Suggested CODEOWNERS: 1 hour
- File tree: 1 hour
- Health checks: No cache

### Cache Headers
```
Cache-Control: private, max-age=300
```

## Error Handling

### Repository Not Tracked (404)
```json
{
  "error": "Repository not found",
  "message": "Repository owner/repo is not being tracked",
  "trackingUrl": "https://contributor.info/owner/repo",
  "action": "Please visit the tracking URL to start tracking"
}
```

### Validation Error (400)
```json
{
  "error": "Invalid repository format",
  "success": false
}
```

## Usage Examples

### cURL
```bash
# Get CODEOWNERS file
curl https://contributor.info/api/repos/microsoft/vscode/codeowners

# Suggest reviewers
curl -X POST https://contributor.info/api/repos/microsoft/vscode/suggest-reviewers \
  -H "Content-Type: application/json" \
  -d '{"files": ["src/editor.ts"], "prAuthor": "contributor1"}'
```

### JavaScript/TypeScript
```typescript
// Get CODEOWNERS
const response = await fetch(
  '/api/repos/microsoft/vscode/codeowners'
);
const data = await response.json();

// Suggest reviewers
const suggestions = await fetch(
  '/api/repos/microsoft/vscode/suggest-reviewers',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      files: ['src/editor.ts'],
      prAuthor: 'contributor1'
    })
  }
);
```

### GitHub Actions
```yaml
- name: Get reviewer suggestions
  run: |
    curl -X POST ${{ vars.API_BASE_URL }}/api/repos/${{ github.repository }}/suggest-reviewers \
      -H "Content-Type: application/json" \
      -d "{\"files\": ${{ steps.files.outputs.files }}}"
```

## Testing

### Local Testing
```bash
# Start dev server
npm run dev

# Test endpoints
curl http://localhost:8888/.netlify/functions/health-check
```

### Integration Tests
Located in `netlify/functions/__tests__/`

## Related Documentation

- [Architecture](../architecture/) - System architecture
- [Integrations](../integrations/) - Third-party integrations
- [Guides](../guides/) - How-to guides
- [Deployment](../deployment/) - Deployment procedures
