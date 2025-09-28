# CODEOWNERS API Documentation

Backend API endpoints for CODEOWNERS integration and reviewer suggestions.

## Prerequisites

- Repository must be tracked via the UI at `https://contributor.info/{owner}/{repo}`
- Valid GitHub token must be configured in environment variables
- Supabase database must be accessible

## Endpoints

### Health Check

**GET** `/.netlify/functions/health-check`

Returns the overall health status of all services (database, GitHub API, background jobs).

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-28T12:00:00Z",
  "services": [
    {
      "service": "supabase",
      "status": "healthy",
      "message": "Database connection successful"
    }
  ]
}
```

### Get CODEOWNERS File

**GET** `/api/repos/{owner}/{repo}/codeowners`

Fetches the CODEOWNERS file from a tracked repository.

**Parameters:**
- `owner` (string): Repository owner/organization
- `repo` (string): Repository name

**Response (Success):**
```json
{
  "exists": true,
  "content": "# CODEOWNERS\n/src/ @developer1 @developer2",
  "path": ".github/CODEOWNERS",
  "repository": "owner/repo"
}
```

**Response (Not Found):**
```json
{
  "exists": false,
  "message": "No CODEOWNERS file found",
  "checkedPaths": [
    ".github/CODEOWNERS",
    "CODEOWNERS",
    "docs/CODEOWNERS",
    ".gitlab/CODEOWNERS"
  ]
}
```

### Get Suggested CODEOWNERS

**GET** `/api/repos/{owner}/{repo}/suggested-codeowners`

Generates CODEOWNERS suggestions based on contribution analysis.

**Response:**
```json
{
  "suggestions": [
    {
      "pattern": "/src/",
      "owners": ["@developer1", "@developer2"],
      "confidence": 0.85,
      "reasoning": "Top 2 contributor(s) to this directory"
    }
  ],
  "codeOwnersContent": "# CODEOWNERS file generated based on contribution analysis\n/src/ @developer1 @developer2 # Top contributors",
  "repository": "owner/repo",
  "totalContributors": 15,
  "generatedAt": "2025-01-28T12:00:00Z"
}
```

### Suggest Reviewers

**POST** `/api/repos/{owner}/{repo}/suggest-reviewers`

Suggests reviewers for a pull request based on files changed and contribution history.

**Request Body:**
```json
{
  "files": [
    "src/components/auth.tsx",
    "src/lib/utils.ts",
    "tests/auth.test.ts"
  ],
  "prAuthor": "contributor1"
}
```

**Response:**
```json
{
  "suggestions": {
    "primary": [
      {
        "username": "developer1",
        "avatarUrl": "https://github.com/developer1.png",
        "score": 25,
        "reasoning": ["Listed in CODEOWNERS", "Has modified the same files"],
        "relevantFiles": ["src/components/auth.tsx"],
        "recentActivity": true
      }
    ],
    "secondary": [
      {
        "username": "developer2",
        "score": 15,
        "reasoning": ["Familiar with affected directories", "Active in the past week"],
        "relevantFiles": ["src/lib/utils.ts"],
        "recentActivity": true
      }
    ],
    "additional": []
  },
  "codeOwners": ["developer1"],
  "repository": "owner/repo",
  "filesAnalyzed": 3,
  "directoriesAffected": 2,
  "generatedAt": "2025-01-28T12:00:00Z"
}
```

### Get Repository File Tree

**GET** `/api/repos/{owner}/{repo}/file-tree`

Returns the complete file structure of a tracked repository.

**Query Parameters:**
- `branch` (optional): Git branch to analyze (defaults to repository's default branch)
- `format` (optional): Response format - "flat" or "hierarchical" (default: "flat")
- `includeDirectoryContents` (optional): Include file listings per directory (default: false)

**Response (Flat Format):**
```json
{
  "repository": "owner/repo",
  "totalFiles": 127,
  "totalDirectories": 23,
  "totalSize": 1048576,
  "truncated": false,
  "files": [
    "src/components/auth.tsx",
    "src/lib/utils.ts",
    "README.md"
  ],
  "directories": [
    "src",
    "src/components",
    "src/lib"
  ],
  "statistics": {
    "fileTypes": {
      "ts": 45,
      "tsx": 32,
      "js": 8,
      "md": 3
    },
    "averageFileSize": 8254
  }
}
```

## Error Responses

### Repository Not Tracked (404)
```json
{
  "error": "Repository not found",
  "message": "Repository owner/repo is not being tracked",
  "trackingUrl": "https://contributor.info/owner/repo",
  "action": "Please visit the tracking URL to start tracking this repository"
}
```

### Validation Error (400)
```json
{
  "error": "Invalid repository format",
  "success": false
}
```

### Server Error (500)
```json
{
  "error": "Internal server error: Database connection failed",
  "success": false
}
```

## Rate Limiting

Currently no rate limiting is implemented. Consider implementing rate limiting based on:
- IP address for anonymous requests
- User ID for authenticated requests
- Repository-specific limits for expensive operations

## Caching

- CODEOWNERS content: 5 minutes
- Suggested CODEOWNERS: 1 hour
- File tree: 1 hour
- Health check: No cache

## Usage Examples

### Using with curl

```bash
# Check service health
curl https://your-domain/.netlify/functions/health-check

# Get CODEOWNERS file
curl https://your-domain/api/repos/microsoft/vscode/codeowners

# Get reviewer suggestions
curl -X POST https://your-domain/api/repos/microsoft/vscode/suggest-reviewers \
  -H "Content-Type: application/json" \
  -d '{"files": ["src/vs/editor/editor.ts"], "prAuthor": "contributor1"}'

# Get file tree in hierarchical format
curl "https://your-domain/api/repos/microsoft/vscode/file-tree?format=hierarchical"
```

### Integration with GitHub Actions

```yaml
name: Suggest Reviewers
on:
  pull_request:
    types: [opened]

jobs:
  suggest-reviewers:
    runs-on: ubuntu-latest
    steps:
      - name: Get changed files
        id: files
        run: |
          FILES=$(gh pr view ${{ github.event.number }} --json files --jq '.files[].path')
          echo "files=$FILES" >> $GITHUB_OUTPUT
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Get reviewer suggestions
        run: |
          curl -X POST ${{ vars.API_BASE_URL }}/api/repos/${{ github.repository }}/suggest-reviewers \
            -H "Content-Type: application/json" \
            -d "{\"files\": ${{ steps.files.outputs.files }}, \"prAuthor\": \"${{ github.actor }}\"}"
```