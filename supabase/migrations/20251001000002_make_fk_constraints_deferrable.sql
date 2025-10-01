-- Migration: Make foreign key constraints DEFERRABLE for DLT compatibility
-- Issue: #879
-- Purpose: Enable DLT merge operations (DELETE+INSERT) for contributors and repositories
--          by allowing constraint checks to be deferred until transaction commit
--
-- Problem: DLT merge uses DELETE+INSERT pattern within a transaction
--          NO ACTION constraints block DELETE when child rows exist
--          CASCADE would delete child data (undesirable)
--          SET NULL would orphan child rows (undesirable)
--
-- Solution: DEFERRABLE INITIALLY DEFERRED constraints allow:
--          1. DELETE to proceed
--          2. INSERT to complete
--          3. Constraint checked at COMMIT (when both operations are done)
--
-- This works because DLT uses the same primary key (UUID) for DELETE and INSERT,
-- so at transaction COMMIT, all foreign key references are valid.

-- Contributors table - make problematic NO ACTION constraints DEFERRABLE
ALTER TABLE issues
  DROP CONSTRAINT issues_author_id_fkey,
  ADD CONSTRAINT issues_author_id_fkey
    FOREIGN KEY (author_id)
    REFERENCES contributors(id)
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE issues
  DROP CONSTRAINT issues_closed_by_id_fkey,
  ADD CONSTRAINT issues_closed_by_id_fkey
    FOREIGN KEY (closed_by_id)
    REFERENCES contributors(id)
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE commits
  DROP CONSTRAINT commits_author_id_fkey,
  ADD CONSTRAINT commits_author_id_fkey
    FOREIGN KEY (author_id)
    REFERENCES contributors(id)
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED;

-- Repositories table - make problematic NO ACTION constraint DEFERRABLE
ALTER TABLE progressive_capture_jobs
  DROP CONSTRAINT progressive_capture_jobs_repository_id_fkey,
  ADD CONSTRAINT progressive_capture_jobs_repository_id_fkey
    FOREIGN KEY (repository_id)
    REFERENCES repositories(id)
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED;

-- Self-referencing repository constraint (parent_repository_id)
ALTER TABLE repositories
  DROP CONSTRAINT repositories_parent_repository_id_fkey,
  ADD CONSTRAINT repositories_parent_repository_id_fkey
    FOREIGN KEY (parent_repository_id)
    REFERENCES repositories(id)
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED;

-- Add comment documenting the DLT compatibility approach
COMMENT ON CONSTRAINT issues_author_id_fkey ON issues IS
  'DEFERRABLE to support DLT merge operations - constraint checked at transaction commit';
COMMENT ON CONSTRAINT progressive_capture_jobs_repository_id_fkey ON progressive_capture_jobs IS
  'DEFERRABLE to support DLT merge operations - constraint checked at transaction commit';
