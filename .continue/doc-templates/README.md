# Documentation Templates

This directory contains templates to help you create consistent, high-quality documentation when adding new features or making changes to the codebase.

## When to Use These Templates

The `continue-docs-review` GitHub Action will suggest which template to use based on your code changes:

- **New feature with UI components?** → Use `feature-template.md`
- **New hooks or API endpoints?** → Use `api-template.md`
- **Architecture or system design changes?** → Use `architecture-template.md`
- **Breaking changes?** → Use `migration-template.md`

## Available Templates

### 1. Feature Template (`feature-template.md`)

Use this when adding new user-facing features or UI components.

**Best for:**
- New React components
- New user workflows
- New UI features

**Copy to:** `docs/features/your-feature-name.md`

### 2. API Template (`api-template.md`)

Use this when creating new hooks, services, or APIs.

**Best for:**
- React hooks (use*)
- Service functions
- Utility libraries
- API integrations

**Copy to:** `docs/api/your-api-name.md`

### 3. Architecture Template (`architecture-template.md`)

Use this when making significant system design changes or adding new infrastructure.

**Best for:**
- New services or systems
- Database schema design
- Integration patterns
- Performance optimizations
- Security implementations

**Copy to:** `docs/architecture/your-system-name.md`

### 4. Migration Template (`migration-template.md`)

Use this when making breaking changes that require users/developers to update their code.

**Best for:**
- Breaking API changes
- Removed or renamed exports
- Database schema migrations
- Configuration changes
- Dependency upgrades with breaking changes

**Copy to:** `docs/migration/YYYY-MM-DD-change-description.md`

## How to Use

### 1. Copy the Template

```bash
# Example: Creating feature documentation
cp .continue/doc-templates/feature-template.md docs/features/my-new-feature.md
```

### 2. Fill in the Sections

- Replace `[Placeholders]` with actual content
- Remove sections that don't apply
- Add sections if needed

### 3. Review the Documentation

Ask yourself:
- ✅ Can someone unfamiliar with this code understand it?
- ✅ Are there code examples they can copy-paste?
- ✅ Are edge cases and gotchas documented?
- ✅ Is it scannable (headers, lists, code blocks)?

### 4. Add to Your PR

Include the documentation in the same PR as your code changes.

## Documentation Best Practices

### Write for Your Audience

- **User docs** (`docs/features/`, `public/docs/`): Focus on "how to use"
- **Developer docs** (`docs/api/`, `docs/architecture/`): Focus on "how it works"

### Keep It Scannable

- Use headers to break up content
- Use bullet lists for multiple points
- Use code blocks for examples
- Use tables for structured data

### Show, Don't Just Tell

```typescript
// ✅ Good - Shows actual code
const { data } = useMyHook('param');

// ❌ Bad - Just describes
// "Call useMyHook with a parameter and it returns data"
```

### Update Docs When Code Changes

- Docs should be updated in the same PR as code
- Outdated docs are worse than no docs
- The CI will remind you if docs are needed

## Need Help?

- See `.continue/rules/` for detailed copywriting and formatting guidelines
- Check existing docs in `docs/` for examples
- Ask in PR comments if unsure which template to use

## Template Maintenance

These templates should be updated as our documentation standards evolve:

- Add new templates for common doc patterns
- Update examples to match current codebase patterns
- Remove sections that aren't useful
- Add sections that we frequently need

**Last Updated:** 2025-01-07
