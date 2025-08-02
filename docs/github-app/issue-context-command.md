# Issue Context Command (.issues)

## Overview

The `.issues` command is a GitHub App feature that provides contextual analysis of related issues and pull requests when invoked in a PR comment. It uses semantic search with OpenAI embeddings to find relevant work based on the files changed in the PR.

## How It Works

1. **Trigger**: Type `.issues` in any PR comment
2. **Analysis**: The app analyzes changed files and PR content
3. **Response**: Posts a detailed comment with:
   - Issues that may be fixed by this PR
   - Related recent work (issues and PRs)
   - Potential conflicts with open PRs
   - Similar historical changes
4. **Cleanup**: Automatically deletes the `.issues` command comment to keep the PR clean

## Technical Implementation

### Database Schema

- **Embeddings**: Issues and PRs have `embedding` columns (VECTOR(1536))
- **Vector Search**: Uses pgvector with cosine similarity
- **Command Tracking**: `comment_commands` table tracks usage

### Key Components

1. **Webhook Handler** (`app/webhooks/issue-comment.ts`)
   - Detects `.issues` command in PR comments
   - Triggers contextual analysis

2. **Embeddings Service** (`app/services/embeddings.ts`)
   - Generates OpenAI embeddings for issue/PR content
   - Uses `text-embedding-3-small` model
   - Caches embeddings with content hash

3. **Context Service** (`app/services/issue-context.ts`)
   - Finds similar issues/PRs using vector search
   - Combines semantic similarity with file overlap
   - Categorizes relationships (may_fix, related_work, etc.)

4. **Background Jobs** (`src/lib/inngest/functions/generate-embeddings.ts`)
   - Batch generates embeddings for existing issues/PRs
   - Runs every 6 hours for active repositories

### Similarity Algorithm

- **60%** Vector similarity (semantic content)
- **20%** File overlap (changed files)
- **10%** Label overlap
- **10%** Temporal proximity

## Usage Example

```
User: .issues

Bot: ## 📋 Issue Context Analysis

Based on the files changed in this PR, here are related issues and pull requests:

### 🔧 May Fix These Issues
- **#123**: "Authentication timeout error" (85% match)
  - Changes to `auth/tokens.js` directly address this issue

### 🔄 Related Recent Work
- ✅ **PR #189**: "Refactor auth middleware"
  - Modified similar files in `src/auth/*`

### ⚠️ Potential Conflicts
- **PR #201**: "Add OAuth2 support" (currently open)
  - Open PR with similar changes

### 📊 Similar Historical Changes
- **PR #89**: "Fix auth race condition" (65% similarity)

### 📁 Changed Files
This PR modifies 5 files: `auth/tokens.js`, `auth/middleware.js`, ...

---
*Generated based on semantic analysis of 10 related items*
```

## Setup

1. **Run Migrations**:
   ```bash
   supabase db push --db-url $DATABASE_URL
   ```

2. **Set Environment Variables**:
   ```
   OPENAI_API_KEY=your-key
   ```

3. **Generate Initial Embeddings**:
   - Trigger the `batchGenerateEmbeddings` job
   - Or wait for automatic generation every 6 hours

## Performance Considerations

- Embeddings are cached for 30 days
- Vector search is optimized with ivfflat index
- Limited to 50 most recent issues/PRs per repo
- Batch processing to avoid rate limits

## Future Enhancements

- Support for cross-repository analysis
- Custom similarity weights per repository
- Integration with project boards
- Suggested labels based on similar issues
- Impact analysis (affected users, dependencies)