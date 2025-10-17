# Example Documentation Review Outputs

## Example 1: All Checks Pass (With Context)

```markdown
## 📚 Documentation Review

<!-- docs-review-action -->

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

## Example 2: With Issues (Detailed Feedback with Copyable Suggestions)

```markdown
## 📚 Documentation Review

<!-- docs-review-action -->

Found 5 suggestion(s) for documentation improvements:

- 🔴 2 error(s)
- 🟡 2 warning(s)
- 🔵 1 suggestion(s)

### Details:

#### docs/setup/installation.md

🔴 **Line 45: Documentation contains TODO marker. Complete or remove before publishing.**

<details>
<summary>💡 Suggested fix</summary>

```markdown
# Complete the TODO or remove it:
# Either add the missing content or delete the placeholder
```

</details>

🟡 **Line 23: Found 4 consecutive paragraphs without visual breaks. Add code examples, bullet points, tables, or images to improve scannability.**

<details>
<summary>💡 Suggested fix</summary>

```markdown
# Break up text with visual elements:

## Option 1: Add code examples
\`\`\`bash
npm install package-name
\`\`\`

## Option 2: Use bullet points
- First key point
- Second key point
- Third key point

## Option 3: Add a table
| Feature | Description |
|---------|-------------|
| Item 1  | Details     |
```

</details>

🔵 **Line 67: Sentence is too long (35 words). Break into smaller sentences for better readability.**

<details>
<summary>💡 Suggested fix</summary>

```markdown
# Break into smaller sentences:
# ❌ Bad: One very long sentence with multiple clauses...
# ✅ Good: First point. Second point. Third point.
```

</details>

🟡 **Line 89: Avoid marketing speak. Be clear and direct.**

<details>
<summary>💡 Suggested fix</summary>

```markdown
# Replace vague buzzwords with specific descriptions:
# ❌ Bad: "Unlock powerful features"
# ✅ Good: "Access GitHub integration and real-time sync"

# ❌ Bad: "Seamless integration"
# ✅ Good: "Connects via OAuth in under 30 seconds"
```

</details>

🔵 **Line 102: Replace redundant phrase with "to" for conciseness**

<details>
<summary>💡 Suggested fix</summary>

```markdown
# Simplify redundant phrases:
# "in order to" → "to"
# "due to the fact that" → "because"
# "at this point in time" → "now"
# "for the purpose of" → "to"
```

</details>


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

## Key Improvements

### Version 1.0 (Original)
The action would always output:
> ✅ All documentation checks passed! The documentation follows the copywriting and formatting guidelines.

This provided no context about:
- What files were checked
- What specific rules were applied
- Which parts of the documentation were well-written
- Line numbers of code examples or good practices

### Version 2.0 (Context Added)
The action now provides:
- **Specific line numbers** for code examples, active voice usage, etc.
- **Counts** of structural elements (code blocks, bullet points, etc.)
- **Examples** of what passed validation (e.g., "Line 45: Code example found")
- **Context** about which documentation purpose was validated (user vs. dev docs)
- **Clear breakdown** of what rules were applied

### Version 3.0 (Copyable Suggestions - Current)
Following [Cubic's comment format](https://github.com/bdougie/contributor.info/pull/862#discussion_r2389945230), the action now includes:

1. **Main advice in markdown** - Clear explanation of the issue
2. **Collapsible copyable suggestions** - Expandable `<details>` blocks with:
   - 💡 "Suggested fix" summary
   - Markdown code blocks with:
     - ❌ Bad examples
     - ✅ Good examples
     - Copyable templates users can paste directly

**Benefits:**
- **Actionable**: Users can copy/paste suggested fixes directly
- **Scannable**: Collapsed by default, expand only what's needed
- **Educational**: Shows bad vs. good examples inline
- **Consistent**: Matches Cubic's proven comment format

This makes the feedback both actionable and demonstrates the action is actually working!
