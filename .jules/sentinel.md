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
