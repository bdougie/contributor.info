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

### Documentation Purpose (Goal-Oriented Checks)

The action validates that documentation serves its intended purpose:

**User Documentation** (`/mintlify-docs`, `/public/docs`)
- ✅ **Step-by-step instructions**: Guides users on how to use features
- ✅ **Prerequisites**: States requirements upfront
- ✅ **Code examples**: Provides copy-paste examples users can run
- ✅ **Expected outcomes**: Explains what users should see after following steps
- **Goal**: Help users understand **how to use the product**

**Developer Documentation** (`/docs`)
- ✅ **Architecture explanations**: Describes system design and component relationships
- ✅ **Technical decisions**: Documents rationale and trade-offs
- ✅ **Infrastructure details**: Covers deployment, configuration, environment setup
- ✅ **File locations**: References specific files to help navigate codebase
- **Goal**: Help developers understand **how the architecture and infrastructure works**

**Feature Documentation** (`/docs/features`, `/docs/implementations`)
- ✅ **Code examples**: Shows feature implementation
- ✅ **Usage OR architecture**: Explains how to use OR how it works internally
- **Goal**: Serves both user needs (usage) and developer needs (implementation)

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

Reviews all `.md` files with context-aware checks:

| Path | Type | Purpose | Key Checks |
|------|------|---------|------------|
| `/mintlify-docs/**` | User docs | How to **use** the product | Step-by-step, prerequisites, outcomes |
| `/docs/architecture/**` | Dev docs | How it **works** | System design, technical decisions |
| `/docs/infrastructure/**` | Dev docs | How to **deploy** | Deployment, config, environment |
| `/docs/features/**` | Mixed | Usage **or** implementation | Code examples, usage/architecture |
| `/docs/**` (other) | Dev docs | Development info | File locations, navigation hints |
| `*.md` (root) | General | Varies | Standard formatting/copywriting |

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

### Success Case (With Context)
```markdown
## 📚 Documentation Review

✅ **All documentation checks passed!**

### What we validated:

**docs/features/new-feature.md:**
- ✅ Document is properly structured with 3 code block(s), bullet points, numbered lists
  - Line 45: Code example found
  - Line 78: Code example found
  - Line 112: Code example found
- ✅ Clear writing with 5 active voice instances, no TODO markers
  - Line 12: Active voice - "Install the dependencies using npm install..."
  - Line 34: Active voice - "Configure your environment variables in the .env file..."
  - Line 56: Active voice - "Run the application with npm start..."
- ✅ User-focused documentation with 3 key element(s)
  - Step-by-step instructions found
  - Code examples included
  - Prerequisites documented

### Rules applied:

- **Copywriting**: Active voice, no marketing fluff, clear error messages
- **Scannable Format**: Visual breaks, code examples, bullet points
- **Documentation Purpose**: User docs show "how to use", dev docs explain "how it works"

_For full guidelines, see `.continue/rules/`_
```

This provides:
- **Specific line numbers** where good practices were found
- **Counts** of structural elements (code blocks, bullet points)
- **Examples** of validated content (snippets of active voice usage)
- **Context** about which documentation purpose was validated

### Issues Found
```markdown
## 📚 Documentation Review

Found 7 suggestion(s) for documentation improvements:

- 🔴 1 error(s)
- 🟡 4 warning(s)
- 🔵 2 suggestion(s)

### Details:

**docs/features/new-feature.md:**
- 🔴 Line 42: Documentation contains TODO marker. Complete or remove before publishing.
- 🟡 Line 15: Avoid marketing speak. Be clear and direct.
- 🟡 Feature documentation should include code examples showing how to use the feature
- 🔵 Line 8: Avoid passive voice. Use active voice: "Deploy the app" instead of "The app is deployed"

**mintlify-docs/guides/getting-started.md:**
- 🟡 User documentation should include step-by-step instructions or code examples showing how to use the feature
- 🔵 User documentation should clarify prerequisites or requirements upfront

**docs/architecture/data-flow.md:**
- 🟡 Architecture documentation should explain technical decisions and rationale for future developers

### 📖 Documentation Purpose

**User Documentation** (`/mintlify-docs`):
- Show **how to use** the product with step-by-step instructions
- Include **prerequisites** and expected **outcomes**
- Add **code examples** users can copy and run

**Developer Documentation** (`/docs`):
- Explain **how the architecture works** (system design, component relationships)
- Document **technical decisions** and rationale
- Include **file locations** and navigation hints
- Explain **infrastructure and deployment** details

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

### `checkDocumentationPurpose()`
- User doc validation (steps, prerequisites, outcomes)
- Architecture doc validation (design, rationale, infrastructure)
- Feature doc validation (code examples, usage/architecture)
- Developer doc validation (file references, navigation)

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

## Example Outputs

See [EXAMPLE_OUTPUT.md](./EXAMPLE_OUTPUT.md) for detailed examples of both success and failure cases.

## Key Improvements

### Before
The action would always output:
> ✅ All documentation checks passed! The documentation follows the copywriting and formatting guidelines.

This provided no context about what was actually validated.

### After
The action now provides:
- **Specific line numbers** for code examples, active voice usage, etc.
- **Counts** of structural elements (code blocks, bullet points, etc.)
- **Examples** of what passed validation (e.g., "Line 45: Code example found")
- **Context** about which documentation purpose was validated (user vs. dev docs)
- **Clear breakdown** of what rules were applied

This makes the feedback actionable and demonstrates the action is working correctly!

## Related Documentation

- [Copywriting Guidelines](../../.continue/rules/copywriting.md)
- [Scannable Format Rule](../../.continue/rules/documentation-scannable-format.md)
- [Contributing Guide](../../CONTRIBUTING.md)
- [Documentation Best Practices](../../docs/README.md)