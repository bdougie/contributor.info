# Sentinel Journal

This journal records critical security learnings and vulnerability patterns found in the codebase.

---

## 2024-05-23 - Duplicate Security Function Trap

**Vulnerability:** A second, insecure implementation of `sanitizeUrl` existed in `src/lib/validation/validation-utils.ts` alongside the secure one in `url-validation.ts`. The insecure version only checked for `new URL()` validity, which allows dangerous protocols like `javascript:`.

**Learning:** Duplicate utility functions are a security risk because one might be maintained/secure while the other rots. Developers might import the wrong one by mistake (e.g., auto-import).

**Prevention:**
1. Centralize security-critical functions.
2. If a duplicate is found, either remove it or make it wrap the canonical implementation.
3. Be wary of functions named "sanitize" that don't specify *what* they sanitize against (e.g., valid URL vs safe URL).

**Resolution:** The duplicate in `validation-utils.ts` now wraps the canonical secure implementation from `url-validation.ts`, ensuring a single source of truth for URL security validation.

## 2025-05-23 - Shared Rate Limit Bucket for Authenticated Users

**Vulnerability:** The `api-track-repository` endpoint utilized a shared rate limit bucket for all "authenticated" users by using a static key `'authenticated-user'`. It also relied on the mere presence of an Authorization header for authentication without validating the token.

**Learning:** Rate limiting keys must identify the specific user to be effective. Trusting the presence of a header without validation leads to easy bypasses and potential DoS attacks where one user can exhaust the quota for everyone.

**Prevention:**
1. Always validate JWT tokens using the auth provider (e.g., `supabase.auth.getUser(token)`).
2. Use the unique `user.id` as the rate limiting identifier.
3. Fall back to secure defaults (e.g., unauthenticated IP-based limits) if validation fails.
