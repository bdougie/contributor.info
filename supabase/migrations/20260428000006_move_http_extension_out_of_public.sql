-- Fix: move `http` extension out of `public` schema (advisor: extension_in_public)
--
-- The advisor flags two extensions in `public`: `http` and `vector`.
--
-- Verified via pg_depend: nothing in this project's user-defined functions,
-- views, or triggers calls http_get / http_post / etc. Only the extension's
-- own types and functions depend on it. Safe to move.
--
-- The `vector` extension is intentionally NOT moved here. Eight tables have
-- `vector(384)` columns (issues, pull_requests, discussions,
-- similarity_cache, file_embeddings, contributor_analytics, repositories,
-- plus replicas/backups). Moving the extension requalifies the type to
-- `extensions.vector(384)`, which is technically transparent but exposes
-- regression risk in RPC signatures, view definitions, and migration
-- replay paths. The security upside is marginal (the vector type itself
-- is harmless). Skipping; advisor will continue to flag it (1 finding).

-- The http extension does not support ALTER EXTENSION ... SET SCHEMA, so we
-- must DROP and re-CREATE in the target schema. This is safe here because
-- pg_depend confirms only the extension's own objects depend on it — no
-- user functions, triggers, or views reference http_* functions.

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

DROP EXTENSION IF EXISTS http;
CREATE EXTENSION http SCHEMA extensions;

COMMIT;
