/** Validation and row-building for tapes session ingest */

export interface TapesSessionNode {
  project: string;
  role: string;
  content: string;
  model?: string;
  session_hash?: string;
  token_count?: number;
}

const PROJECT_PATTERN = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
const VALID_ROLES = ['user', 'assistant'];

/** Max nodes allowed in a single ingest POST */
export const MAX_BATCH_SIZE = 100;

/** Validate a single tapes session node */
export function isValidSessionNode(node: TapesSessionNode): boolean {
  if (!node.project || !node.role || !node.content) return false;
  if (!VALID_ROLES.includes(node.role)) return false;
  if (!PROJECT_PATTERN.test(node.project)) return false;
  return true;
}

/** Build a Supabase row from a validated node */
export function buildSessionRow(node: TapesSessionNode) {
  return {
    project: node.project,
    app: 'contributor-info',
    session_hash: node.session_hash ?? null,
    role: node.role,
    content: node.content,
    model: node.model ?? null,
    token_count: node.token_count ?? 0,
  };
}
