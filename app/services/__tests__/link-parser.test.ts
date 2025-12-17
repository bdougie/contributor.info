
import { describe, it, expect } from 'vitest';
import { extractLinkedItems } from '../link-parser';

describe('extractLinkedItems', () => {
  it('should extract short refs #123', () => {
    const text = 'This refers to #123 and #456.';
    const links = extractLinkedItems(text);
    expect(links).toHaveLength(2);
    expect(links).toContainEqual({ number: 123 });
    expect(links).toContainEqual({ number: 456 });
  });

  it('should extract repo refs owner/repo#123', () => {
    const text = 'Check out owner/repo#123.';
    const links = extractLinkedItems(text);
    expect(links).toHaveLength(1);
    expect(links).toContainEqual({ owner: 'owner', repo: 'repo', number: 123 });
  });

  it('should extract repo refs with dots and underscores', () => {
    const text = 'Check out my.org/my_repo#123.';
    const links = extractLinkedItems(text);
    expect(links).toHaveLength(1);
    expect(links).toContainEqual({ owner: 'my.org', repo: 'my_repo', number: 123 });
  });

  it('should extract full URLs', () => {
    const text = 'See https://github.com/owner/repo/issues/123';
    const links = extractLinkedItems(text);
    expect(links).toHaveLength(1);
    expect(links).toContainEqual({ owner: 'owner', repo: 'repo', number: 123 });
  });

  it('should dedup same links', () => {
    const text = 'See #123 and #123.';
    const links = extractLinkedItems(text);
    expect(links).toHaveLength(1);
    expect(links).toContainEqual({ number: 123 });
  });
});
