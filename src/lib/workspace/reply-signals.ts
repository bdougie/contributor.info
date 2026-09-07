export type ReplyReason = 'question' | 'request' | 'changes_requested' | 'unresolved_thread';

function isAcknowledgment(prose: string): boolean {
  const phrase =
    /(?:thanks?(?: you)?(?: so much| a lot| for (?:this|that|the update))?|lgtm|looks good(?: to me)?|sounds good|great|nice|awesome|agreed|got it|done|fixed|all set|no (?:reply|response) needed|(?:i'll|i will) (?:try (?:it|that)|give (?:it|that|the approach|approach) a shot)|(?:phase \d+|this|that) looks interesting)(?=[\s,.!;:]|$)/iy;
  const separators = /[\s,.!;:]+/y;
  let cursor = 0;
  // Sticky matches consume one phrase at a time, without reconsidering earlier phrases.
  while (cursor < prose.length) {
    phrase.lastIndex = cursor;
    if (!phrase.test(prose)) return false;
    cursor = phrase.lastIndex;
    separators.lastIndex = cursor;
    if (separators.test(prose)) cursor = separators.lastIndex;
  }
  return cursor > 0;
}

/** Use authored prose, not quoted questions or code, as evidence of a request. */
export function replySignal(
  body: string,
  context: { unresolvedThread?: boolean; changesRequested?: boolean } = {}
): ReplyReason | undefined {
  const prose = body
    .replace(/```[\s\S]*?(?:```|$)/g, '')
    .replace(/~~~[\s\S]*?(?:~~~|$)/g, '')
    .replace(/^\s*>.*$/gm, '')
    .replace(/`[^`]*`/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/@[a-z\d-]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (context.changesRequested) return 'changes_requested';
  if (!prose) return undefined;
  if (
    /\?|\b(?:what do you think|what would you think|any updates|any thoughts|how about)\b/i.test(
      prose
    )
  )
    return 'question';
  if (
    /\b(?:(?:can|could|would|will) you|please\s+(?:\w+\s+)?(?:add|change|check|clarify|confirm|explain|fix|look|remove|reply|respond|review|test|update)|(?:we|you) (?:need|should|must)|(?:needs?|requires?) (?:a |an )?(?:fix|change|test|update)|let me know)\b/i.test(
      prose
    )
  )
    return 'request';

  if (isAcknowledgment(prose)) return undefined;

  // Unresolved inline feedback is structural evidence; ordinary chatter is not.
  return context.unresolvedThread ? 'unresolved_thread' : undefined;
}
