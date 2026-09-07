import { describe, expect, it } from 'vitest';
import { replySignal } from '../reply-signals';

describe('Response signals', () => {
  it('handles long repeated acknowledgments without backtracking across phrases', () => {
    const body = `nice ${'thank you '.repeat(10_000)}`;
    expect(replySignal(body, { unresolvedThread: true })).toBeUndefined();
    expect(replySignal(`${body}but this leaks memory`, { unresolvedThread: true })).toBe(
      'unresolved_thread'
    );
  });

  it.each([
    'Thank you so much! Nice, thank you for the update.',
    'Thanks a lot; looks good to me!',
    'I will try that. Thanks!',
  ])('keeps compound acknowledgments: %s', (body) => {
    expect(replySignal(body, { unresolvedThread: true })).toBeUndefined();
  });

  it('does not consume acknowledgment prefixes inside substantive words', () => {
    expect(replySignal('nicely broken', { unresolvedThread: true })).toBe('unresolved_thread');
    expect(replySignal('thank you but this leaks memory', { unresolvedThread: true })).toBe(
      'unresolved_thread'
    );
  });
  it.each([
    'Thanks!',
    'LGTM',
    '@bdougie looks good to me!',
    "I'll give approach a shot thanks",
    'Phase 3 looks interesting.',
    'Done, thanks!',
    'No response needed.',
  ])('does not turn acknowledgment-only feedback into work: %s', (body) => {
    expect(replySignal(body)).toBeUndefined();
    expect(replySignal(body, { unresolvedThread: true })).toBeUndefined();
  });

  it.each([
    'Can you add a test?',
    'Thanks! Could you fix the test?',
    'Any updates',
    'What do you think',
  ])('keeps questions: %s', (body) => {
    expect(replySignal(body)).toBe('question');
  });
  it.each([
    'Please add a test.',
    'Thanks, could you check the build.',
    'We need a migration.',
    'Let me know when it is ready.',
  ])('keeps requests: %s', (body) => {
    expect(replySignal(body)).toBe('request');
  });
  it('uses review state and unresolved threads as structural signals', () => {
    expect(replySignal('', { changesRequested: true })).toBe('changes_requested');
    expect(replySignal('This leaks memory', { unresolvedThread: true })).toBe('unresolved_thread');
    expect(replySignal('I published the release')).toBeUndefined();
  });
  it('does not infer questions from quotes, code, or URLs', () => {
    expect(replySignal('> Can you fix this?\n\nDone!')).toBeUndefined();
    expect(replySignal('```js\na ? b : c\n```\nThanks!')).toBeUndefined();
    expect(replySignal('~~~js\na ? b : c\n~~~')).toBeUndefined();
    expect(replySignal('`a ? b : c` https://example.com/?q=1')).toBeUndefined();
    expect(replySignal('> LGTM\n\nCan you fix the test?')).toBe('question');
  });
});
