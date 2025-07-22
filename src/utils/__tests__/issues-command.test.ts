import { describe, it, expect } from 'vitest';

// Inline the function to test without imports
function containsIssuesCommand(commentBody: string): boolean {
  const normalizedBody = commentBody.toLowerCase().trim();
  
  // Check if comment starts with .issues
  if (normalizedBody.startsWith('.issues')) {
    return true;
  }
  
  // Check if .issues appears on its own line
  const lines = normalizedBody.split('\n');
  return lines.some(line => line.trim().startsWith('.issues'));
}

describe('containsIssuesCommand', () => {
  it('detects .issues at the start of comment', () => {
    expect(containsIssuesCommand('.issues')).toBe(true);
    expect(containsIssuesCommand('.issues please')).toBe(true);
    expect(containsIssuesCommand('.ISSUES')).toBe(true);
    expect(containsIssuesCommand('  .issues  ')).toBe(true);
  });

  it('detects .issues on its own line', () => {
    expect(containsIssuesCommand('Hello\n.issues\nThanks')).toBe(true);
    expect(containsIssuesCommand('Some text\n\n.issues')).toBe(true);
    expect(containsIssuesCommand('first line\n  .issues  \nlast line')).toBe(true);
  });

  it('does not detect .issues in the middle of text', () => {
    expect(containsIssuesCommand('Run .issues command')).toBe(false);
    expect(containsIssuesCommand('test.issues')).toBe(false);
    expect(containsIssuesCommand('issues')).toBe(false);
    expect(containsIssuesCommand('the .issues command')).toBe(false);
  });

  it('handles edge cases', () => {
    expect(containsIssuesCommand('')).toBe(false);
    expect(containsIssuesCommand(' ')).toBe(false);
    expect(containsIssuesCommand('\n')).toBe(false);
    expect(containsIssuesCommand('\n\n')).toBe(false);
  });

  it('handles mixed case and whitespace', () => {
    expect(containsIssuesCommand('.ISSUES')).toBe(true);
    expect(containsIssuesCommand('.Issues')).toBe(true);
    expect(containsIssuesCommand(' .issues ')).toBe(true);
    expect(containsIssuesCommand('\t.issues\t')).toBe(true);
  });

  it('handles comments with multiple commands', () => {
    expect(containsIssuesCommand('Please run:\n.issues\n.help')).toBe(true);
    expect(containsIssuesCommand('.help\n.issues')).toBe(true);
  });

  it('ignores .issues when not at line start', () => {
    expect(containsIssuesCommand('Check the .issues section')).toBe(false);
    expect(containsIssuesCommand('file.issues.txt')).toBe(false);
    expect(containsIssuesCommand('Use `.issues` command')).toBe(false);
  });
});