# Continue Agent Workflows

This document describes how the Continue Agent responds to different GitHub events and mentions.

## Workflow Separation

The Continue Agent operates through two distinct workflows, each with a specific purpose:

### 1. Issue Triage (`continue-triage.yml`)

**Purpose**: Automatically triage and categorize GitHub issues.

**Triggers**:
- New issues opened
- Issues edited  
- Issues reopened
- Scheduled (hourly for issues without labels)
- `@continue-agent` mentions in **issue comments**

**Responsibilities**:
- Analyzes issue content against project rules
- Suggests and applies appropriate labels
- Asks for clarification when context is insufficient (e.g., videos, brief descriptions)
- Provides SCQA analysis (Situation, Complication, Question, Answer)
- Keeps `needs-triage` label when more information is needed

**Key Features**:
- Detects video content and requests written descriptions
- Identifies insufficient context (<50 characters) and asks for details
- Responds to user prompts via `@continue-agent` mentions
- Sanitizes user input by removing mention text

### 2. Pull Request Review (`continue-review.yml`)

**Purpose**: Provide automated code review for pull requests.

**Triggers**:
- Pull requests opened
- Pull requests synchronized (new commits)
- Pull requests marked ready for review
- `@continue-agent` mentions in **PR comments only**

**Responsibilities**:
- Reviews code changes against project rules
- Provides constructive feedback and suggestions
- Posts review comments on the PR
- Responds to review requests via mentions

**Key Safety Check**:
The action includes an explicit check to ensure it only responds to PR comments:
```typescript
if (!context.payload.issue?.pull_request) {
  core.info('Not a pull request comment, skipping');
  return;
}
```

## Using @continue-agent

### In Issues
Mention `@continue-agent` in an issue comment to:
- Request re-triage with additional context
- Ask for help categorizing the issue
- Provide clarification after initial triage

Example:
```
@continue-agent this is actually a security issue affecting the authentication system
```

### In Pull Requests
Mention `@continue-agent` in a PR comment to:
- Request a code review
- Ask for specific feedback
- Get suggestions for improvements

Example:
```
@continue-agent please review the performance implications of these changes
```

## Important Notes

1. **No Overlap**: The workflows are designed to be mutually exclusive:
   - `continue-triage` handles issues only
   - `continue-review` handles PRs only

2. **Comment Detection**: Both workflows check the event context to determine the appropriate action:
   - Issue comments without `pull_request` field → Triage workflow
   - PR comments with `pull_request` field → Review workflow

3. **Label Management**: 
   - Triage bot manages issue labels
   - Review bot does not modify PR labels (focuses on code review)

4. **Context Awareness**: The triage bot specifically handles:
   - Video content detection (mp4, YouTube, Loom, .mov)
   - Brief descriptions requiring more detail
   - Maintaining `needs-triage` until sufficient information is provided

## Configuration Files

- **Workflows**: `.github/workflows/continue-triage.yml`, `.github/workflows/continue-review.yml`
- **Actions**: `actions/continue-triage/`, `actions/continue-review/`
- **Rules**: `.continue/rules/*.md` (shared by both workflows)

## Troubleshooting

If the wrong workflow responds:
1. Check that the mention is in the correct context (issue vs PR)
2. Verify the workflow conditions in the respective YAML files
3. Ensure the action implementations have proper guards