#!/bin/bash
# Doc quality linter for mintlify-docs
# Outputs file:line:col: message format for sweeper to parse

DIR="mintlify-docs"
shopt -s globstar

for f in "$DIR"/**/*.mdx; do
  [ -f "$f" ] || continue

  lines=$(wc -l < "$f" | tr -d ' ')

  # Check for missing frontmatter title
  if ! head -5 "$f" | grep -q "^title:"; then
    echo "$f:1:1: missing frontmatter title field"
  fi

  # Check for missing frontmatter description
  if ! head -10 "$f" | grep -q "^description:"; then
    echo "$f:1:1: missing frontmatter description field"
  fi

  # Check for thin content (under 40 lines)
  if [ "$lines" -lt 40 ]; then
    echo "$f:1:1: thin content ($lines lines) - needs substantial expansion with examples, use cases, and clear explanations"
  fi

  # Check for duplicate content (repeated lines)
  dupes=$(sed -n '/^---$/,/^---$/!p' "$f" | sort | uniq -d | grep -cv '^$' || true)
  if [ "$dupes" -gt 3 ]; then
    echo "$f:1:1: contains $dupes duplicate lines - remove redundant content"
  fi

  # Check for broken image references
  if grep -qn 'supabase.co/storage' "$f"; then
    line=$(grep -n 'supabase.co/storage' "$f" | head -1 | cut -d: -f1)
    echo "$f:$line:1: broken Supabase CDN image reference - remove or replace with description"
  fi

  # Check for vague descriptions (common filler words)
  if grep -qin 'various\|comprehensive\|seamlessly\|leverage\|utilize' "$f"; then
    line=$(grep -in 'various\|comprehensive\|seamlessly\|leverage\|utilize' "$f" | head -1 | cut -d: -f1)
    echo "$f:$line:1: vague filler language detected - use specific, concrete descriptions"
  fi

  # Check for missing practical examples
  if ! grep -q '```\|<CodeGroup\|<Code' "$f"; then
    # Skip introduction.mdx which is a card hub
    if [ "$f" != "$DIR/introduction.mdx" ]; then
      echo "$f:1:1: no code examples or practical usage shown - add concrete examples"
    fi
  fi

  # Check for generic frontmatter description
  if grep -q "^description:" "$f" && head -10 "$f" | grep -qi "^description:.*\(understanding\|tracking\|measuring\)"; then
    echo "$f:1:1: frontmatter description is generic - rewrite to show user value"
  fi

done
