# Workspace API Documentation

## Overview

The Workspace API provides endpoints for managing workspaces, including CRUD operations, repository associations, and member management. All endpoints require authentication via Bearer token in the Authorization header.

## Base URL

```
https://contributor.info/.netlify/functions
```

## Authentication

All endpoints require authentication:

```http
Authorization: Bearer <your-token>
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Standard endpoints**: 100 requests per minute
- **Creation endpoints**: 20 requests per hour
- **Member invitations**: 10 requests per minute

Rate limit information is included in response headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when rate limit resets (ISO 8601)

## Endpoints

### Workspace Management

#### Create Workspace

Create a new workspace.

```http
POST /api-workspaces
```

**Request Body:**
```json
{
  "name": "My Workspace",
  "description": "Optional description",
  "visibility": "public",
  "settings": {
    "theme": "dark",
    "dashboard_layout": "grid"
  }
}
```

**Response:** `201 Created`
```json
{
  "workspace": {
    "id": "uuid",
    "name": "My Workspace",
    "slug": "my-workspace",
    "description": "Optional description",
    "owner_id": "user-uuid",
    "visibility": "public",
    "tier": "free",
    "max_repositories": 10,
    "current_repository_count": 0,
    "settings": {},
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Validation error
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Workspace limit reached
- `409 Conflict`: Workspace name already exists

#### List Workspaces

Get a paginated list of user's workspaces.

```http
GET /api-workspaces?page=1&limit=10&visibility=public&search=term
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 50)
- `visibility` (optional): Filter by visibility (public/private)
- `search` (optional): Search term for name/description

**Response:** `200 OK`
```json
{
  "workspaces": [
    {
      "id": "uuid",
      "name": "My Workspace",
      "slug": "my-workspace",
      "repository_count": 5,
      "member_count": 3,
      "owner": {
        "id": "user-uuid",
        "email": "user@example.com",
        "display_name": "John Doe"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

#### Get Workspace

Get details of a specific workspace.

```http
GET /api-workspaces/:id
```

**Response:** `200 OK`
```json
{
  "workspace": {
    "id": "uuid",
    "name": "My Workspace",
    "slug": "my-workspace",
    "description": "Workspace description",
    "owner_id": "user-uuid",
    "visibility": "public",
    "tier": "free",
    "repository_count": 5,
    "member_count": 3,
    "total_stars": 150,
    "total_contributors": 25,
    "owner": {
      "id": "user-uuid",
      "email": "user@example.com",
      "display_name": "John Doe"
    }
  }
}
```

**Error Responses:**
- `404 Not Found`: Workspace not found or access denied

#### Update Workspace

Update workspace details.

```http
PUT /api-workspaces/:id
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "visibility": "private",
  "settings": {
    "theme": "light"
  }
}
```

**Response:** `200 OK`
```json
{
  "workspace": {
    "id": "uuid",
    "name": "Updated Name",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Validation error
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Workspace not found

#### Delete Workspace

Delete a workspace (owner only).

```http
DELETE /api-workspaces/:id
```

**Response:** `200 OK`
```json
{
  "success": true
}
```

**Error Responses:**
- `403 Forbidden`: Only owner can delete
- `404 Not Found`: Workspace not found

### Repository Management

#### List Workspace Repositories

Get repositories in a workspace.

```http
GET /api-workspaces-repositories?workspaceId=:id&page=1&limit=20&pinned=true
```

**Query Parameters:**
- `workspaceId` (required): Workspace ID
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `pinned` (optional): Filter by pinned status
- `search` (optional): Search in notes

**Response:** `200 OK`
```json
{
  "repositories": [
    {
      "id": "uuid",
      "workspace_id": "workspace-uuid",
      "repository_id": "repo-uuid",
      "added_by": "user-uuid",
      "added_at": "2024-01-01T00:00:00Z",
      "notes": "Important repo",
      "tags": ["frontend", "react"],
      "is_pinned": true,
      "repositories": {
        "id": "repo-uuid",
        "owner": "octocat",
        "name": "hello-world",
        "description": "Repository description",
        "stars": 100,
        "language": "JavaScript"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

#### Add Repository to Workspace

Add a repository to a workspace.

```http
POST /api-workspaces-repositories
```

**Request Body:**
```json
{
  "workspace_id": "workspace-uuid",
  "repository_id": "repo-uuid",
  "notes": "Optional notes",
  "tags": ["tag1", "tag2"],
  "is_pinned": false
}
```

**Response:** `201 Created`
```json
{
  "repository": {
    "id": "uuid",
    "workspace_id": "workspace-uuid",
    "repository_id": "repo-uuid",
    "added_at": "2024-01-01T00:00:00Z"
  }
}
```

**Error Responses:**
- `403 Forbidden`: Repository limit reached or insufficient permissions
- `404 Not Found`: Repository not found
- `409 Conflict`: Repository already in workspace

#### Remove Repository from Workspace

Remove a repository from a workspace.

```http
DELETE /api-workspaces-repositories?workspaceId=:wid&repositoryId=:rid
```

**Response:** `200 OK`
```json
{
  "success": true
}
```

**Error Responses:**
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Repository not in workspace

### Member Management

#### List Workspace Members

Get members of a workspace.

```http
GET /api-workspaces-members?workspaceId=:id&page=1&role=admin
```

**Query Parameters:**
- `workspaceId` (required): Workspace ID
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `role` (optional): Filter by role (owner/admin/editor/viewer)

**Response:** `200 OK`
```json
{
  "members": [
    {
      "id": "uuid",
      "workspace_id": "workspace-uuid",
      "user_id": "user-uuid",
      "role": "admin",
      "joined_at": "2024-01-01T00:00:00Z",
      "user": {
        "id": "user-uuid",
        "email": "user@example.com",
        "display_name": "Jane Doe",
        "avatar_url": "https://..."
      }
    }
  ],
  "invitations": [
    {
      "id": "uuid",
      "email": "invited@example.com",
      "role": "editor",
      "status": "pending",
      "expires_at": "2024-01-08T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

#### Invite Member

Invite a new member to workspace.

```http
POST /api-workspaces-members
```

**Request Body:**
```json
{
  "workspace_id": "workspace-uuid",
  "email": "user@example.com",
  "role": "editor",
  "message": "Optional invitation message"
}
```

**Response:** `201 Created`
```json
{
  "invitation": {
    "id": "uuid",
    "workspace_id": "workspace-uuid",
    "email": "user@example.com",
    "role": "editor",
    "status": "pending",
    "expires_at": "2024-01-08T00:00:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid email or role
- `403 Forbidden`: Insufficient permissions
- `409 Conflict`: User already member or invited

#### Update Member Role

Change a member's role in the workspace.

```http
PUT /api-workspaces-members/:memberId
```

**Request Body:**
```json
{
  "workspace_id": "workspace-uuid",
  "role": "admin"
}
```

**Response:** `200 OK`
```json
{
  "member": {
    "id": "uuid",
    "user_id": "user-uuid",
    "role": "admin",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

**Error Responses:**
- `403 Forbidden`: Cannot change owner role or insufficient permissions
- `404 Not Found`: Member not found

#### Remove Member

Remove a member from workspace.

```http
DELETE /api-workspaces-members/:memberId?workspaceId=:wid
```

**Response:** `200 OK`
```json
{
  "success": true
}
```

**Error Responses:**
- `403 Forbidden`: Cannot remove owner or insufficient permissions
- `404 Not Found`: Member not found

## Error Response Format

All error responses follow this format:

```json
{
  "error": "Error message",
  "errors": ["Detailed error 1", "Detailed error 2"],
  "message": "Additional context (optional)"
}
```

## Status Codes

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (e.g., duplicate)
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## Examples

### cURL Examples

#### Create a workspace:
```bash
curl -X POST https://contributor.info/.netlify/functions/api-workspaces \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Workspace", "visibility": "public"}'
```

#### Add repository to workspace:
```bash
curl -X POST https://contributor.info/.netlify/functions/api-workspaces-repositories \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workspace_id": "WORKSPACE_ID", "repository_id": "REPO_ID"}'
```

#### Invite member:
```bash
curl -X POST https://contributor.info/.netlify/functions/api-workspaces-members \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workspace_id": "WORKSPACE_ID", "email": "user@example.com", "role": "editor"}'
```

### JavaScript/TypeScript Examples

```typescript
// Create workspace
const response = await fetch('/.netlify/functions/api-workspaces', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'My Workspace',
    visibility: 'public'
  })
});

const { workspace } = await response.json();
```

## Webhook Events

The following webhook events are triggered by workspace operations:

- `workspace.created`: New workspace created
- `workspace.updated`: Workspace details updated
- `workspace.deleted`: Workspace deleted
- `workspace.member.added`: Member added to workspace
- `workspace.member.removed`: Member removed from workspace
- `workspace.member.role_changed`: Member role updated
- `workspace.repository.added`: Repository added to workspace
- `workspace.repository.removed`: Repository removed from workspace

## Migration Notes

For existing users migrating to workspaces:

1. A default workspace will be created automatically on first use
2. Existing tracked repositories will be associated with the default workspace
3. Users can create additional workspaces based on their subscription tier

## Support

For API support, please:
- Check the [API Status Page](https://status.contributor.info)
- Report issues on [GitHub](https://github.com/bdougie/contributor.info/issues)
- Contact support at support@contributor.info