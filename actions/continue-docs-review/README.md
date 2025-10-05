# Continue Documentation Review Action

Automated documentation review that enforces copywriting and formatting rules from `.continue/rules/` across both `/docs` and `/mintlify-docs` directories.

## Features

- **Intelligent Analysis**: Applies rule-specific checks based on documentation type
- **Comprehensive Coverage**: Reviews all markdown files in `/docs`, `/mintlify-docs`, and root
- **Detailed Feedback**: Provides line-specific suggestions with actionable fixes
- **Multiple Severity Levels**: Distinguishes between errors, warnings, and suggestions
- **Non-blocking**: Posts review comments without blocking PR merges
- **Duplicate Prevention**: Avoids posting multiple reviews on the same PR

## Checks Performed

### Copywriting Rules (`.continue/rules/copywriting.md`)

**Passive Voice Detection**
- Identifies passive constructions like "is deployed" vs "deploy"
- Provides active voice alternatives
- Severity: `info`

**Marketing Speak & Fluff**
- Detects buzzwords: unlock, unleash, revolutionize, supercharge
- Flags hyperbolic language: blazingly fast, incredibly powerful
- Catches absolute claims: 100% secure, completely reliable
- Identifies vague terms: seamless, cutting-edge, world-class
- Severity: `warning`

**TODO/FIXME Markers**
- Finds incomplete documentation markers (TODO, FIXME, WIP, XXX, HACK)
- Severity: `error`

**Long Sentences**
- Flags sentences over 30 words
- Suggests breaking into smaller, clearer sentences
- Severity: `info`

**Redundant Phrases**
- Detects wordy constructions:
  - "in order to" → "to"
  - "due to the fact that" → "because"
  - "at this point in time" → "now"
  - "for the purpose of" → "to"
- Severity: `info`

### Formatting Standards (`.continue/rules/documentation-scannable-format.md`)

**Consecutive Paragraphs**
- Detects 4+ paragraphs without visual breaks
- Suggests adding code blocks, bullets, tables, or images
- Severity: `warning`

**Missing Code Examples**
- Checks technical docs (features, setup, guides, APIs) for code blocks
- Severity: `info`

**Visual Element Detection**
- Recognizes various Markdown elements:
  - Code blocks (```)
  - Bullet/numbered lists
  - Tables
  - Blockquotes
  - HTML tags

### Documentation Scope

Reviews all `.md` files in:
- `/docs/**/*.md` - Developer documentation
- `/mintlify-docs/**/*.md` - User-facing documentation  
- `*.md` - Root-level docs (README, CONTRIBUTING, etc.)

## Configuration

The action loads rules from `.continue/rules/` directory:
- `copywriting.md` - Writing style guidelines
- `documentation-scannable-format.md` - Structure and formatting rules

## Usage

### In GitHub Actions Workflow

```yaml
name: Documentation Review

on:
  pull_request:
    paths:
      - '**.md'
      - 'docs/**'
      - 'mintlify-docs/**'

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Documentation Review
        uses: ./actions/continue-docs-review
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          rules-path: '.continue/rules'
```

### Configuration Options

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `github-token` | Yes | - | GitHub token for PR comments |
| `rules-path` | No | `.continue/rules` | Path to rules directory |

## Rule Format

Rules use YAML frontmatter for configuration:

```markdown
---
globs: ["**/*.md", "docs/**", "mintlify-docs/**"]
description: "Enforces copywriting guidelines for clear, concise documentation"
---

# Rule Content

Detailed guidelines and examples...
```

### Frontmatter Fields

- `globs` (optional): Array of file patterns to match
- `description` (required): Brief rule description

### File Matching

If `globs` is specified, the rule only applies to matching files:
- `**/*.md` - All markdown files
- `docs/**` - Only files in /docs
- `mintlify-docs/**/*.mdx` - MDX files in Mintlify docs

If `globs` is omitted, the rule applies to all changed markdown files.

## Review Output

The action posts a PR comment with:

### Success Case
```markdown
## 📚 Documentation Review

✅ All documentation checks passed! The documentation follows the copywriting and formatting guidelines.
```

### Issues Found
```markdown
## 📚 Documentation Review

Found 5 suggestion(s) for documentation improvements:

- 🔴 1 error(s)
- 🟡 2 warning(s)
- 🔵 2 suggestion(s)

### Details:

**docs/features/new-feature.md:**
- 🔴 Line 42: Documentation contains TODO marker. Complete or remove before publishing.
- 🟡 Line 15: Avoid marketing speak. Be clear and direct.
- 🔵 Line 8: Avoid passive voice. Use active voice: "Deploy the app" instead of "The app is deployed"

**mintlify-docs/introduction.mdx:**
- 🟡 Line 23: Found 4 consecutive paragraphs without visual breaks. Add code examples, bullet points, tables, or images to improve scannability.
- 🔵 Line 67: Replace redundant phrase with "to" for conciseness

### 📖 Documentation Guidelines

- Keep text **clear and concise** - avoid unnecessary words
- Use **active voice** instead of passive voice
- Break up text with **visual elements** (code blocks, bullets, images)
- Avoid **marketing speak** and technical jargon
- Include **examples** for features and complex concepts

For full guidelines, see `.continue/rules/`
```

## Severity Levels

| Icon | Severity | Description | Example |
|------|----------|-------------|----------|
| 🔴 | Error | Must be fixed | TODO markers, broken syntax |
| 🟡 | Warning | Should be addressed | Marketing speak, too many paragraphs |
| 🔵 | Info | Nice to improve | Passive voice, long sentences |

## How It Works

1. **Load Rules**: Reads `.continue/rules/*.md` files with YAML frontmatter
2. **Get Changed Files**: Fetches all `.md` files modified in the PR
3. **Apply Checks**: Runs rule-specific analyzers based on glob patterns
4. **Group Issues**: Organizes findings by file and severity
5. **Post Review**: Creates a PR comment with actionable feedback
6. **Prevent Duplicates**: Checks for existing reviews before posting

## Rule-Specific Analyzers

The action uses specialized analyzers for different rules:

### `checkCopywriting()`
- Passive voice patterns with examples
- Marketing speak detection (6 patterns)
- TODO/FIXME markers
- Long sentence detection (>30 words)
- Redundant phrase replacement

### `checkScannableFormat()`
- Consecutive paragraph counting
- Visual element recognition
- Technical doc code example validation

### Extensibility

Add new rule analyzers in `index.ts`:

```typescript
function checkMyCustomRule(content: string, lines: string[], file: string): DocumentationIssue[] {
  const issues: DocumentationIssue[] = [];
  // Your custom checks here
  return issues;
}

// Then add to checkAgainstRule switch:
case 'my-custom-rule':
  issues.push(...checkMyCustomRule(content, lines, file));
  break;
```

## Development

```bash
# Install dependencies
cd actions/continue-docs-review
npm install

# Build TypeScript
npm run build

# Test locally (requires GITHUB_TOKEN)
export GITHUB_TOKEN=your_token
export INPUT_PR_NUMBER=123
node index.ts
```

## Related Documentation

- [Copywriting Guidelines](../../.continue/rules/copywriting.md)
- [Scannable Format Rule](../../.continue/rules/documentation-scannable-format.md)
- [Contributing Guide](../../CONTRIBUTING.md)
- [Documentation Best Practices](../../docs/README.md)