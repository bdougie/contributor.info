# Continue Documentation Review Action

Automated documentation review using Continue Agent with copywriting and formatting rules.

## Features

- **Automatic PR Review**: Reviews documentation changes in pull requests
- **Copywriting Rules**: Enforces clear, concise, professional writing
- **Formatting Standards**: Ensures documentation is scannable with visual breaks
- **Non-blocking Feedback**: Provides suggestions without blocking merges
- **Coverage Checks**: Validates documentation completeness

## Checks Performed

### Copywriting Rules
- Clear and concise language
- Active voice preference
- No marketing speak or fluff
- Professional tone
- Action-oriented language

### Formatting Standards
- Visual breaks between paragraphs
- Code examples in technical docs
- Proper use of headings
- Bullet points and lists for scannability

### Documentation Coverage
- Feature documentation with examples
- Architecture documentation
- Contributing guides
- User documentation

## Configuration

The action loads rules from `.continue/rules/` directory:
- `copywriting.md` - Writing style guidelines
- `documentation-scannable-format.md` - Structure and formatting rules

## Usage

```yaml
- name: Run Documentation Review
  uses: ./actions/continue-docs-review
  with:
    github-token: ${{ steps.app-token.outputs.token }}
    continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
    continue-org: 'your-org'
    continue-config: 'your-org/docs-reviewer'
```

## Rule Format

Rules use YAML frontmatter:

```markdown
---
globs: ["**/*.md", "**/docs/**/*"]
description: "Rule description"
---

Rule content and guidelines...
```

## Review Output

The action posts a PR comment with:
- Summary of findings by severity
- Detailed issues per file
- Line-specific suggestions
- Links to documentation guidelines

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Test locally
npm test
```