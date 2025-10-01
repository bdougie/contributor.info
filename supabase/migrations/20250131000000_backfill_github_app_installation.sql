-- Backfill GitHub App installation for bdougie/contributor.info
-- The app was installed before webhook handlers existed

-- 1. Insert the GitHub App installation record
INSERT INTO github_app_installations (
    installation_id,
    account_type,
    account_name,
    account_id,
    repository_selection,
    installed_at
) VALUES (
    75772461,
    'user',
    'bdougie',
    5713670,
    'selected',
    '2025-01-15 00:00:00+00'  -- Approximate date, adjust if you know exact date
)
ON CONFLICT (installation_id) DO NOTHING;

-- 2. Link the installation to bdougie/contributor.info repository
INSERT INTO app_enabled_repositories (
    installation_id,
    repository_id,
    enabled_at
)
SELECT
    gai.id,
    '2ffb96ba-057f-47d8-b822-7f2b44f67c79'::uuid,
    '2025-01-15 00:00:00+00'
FROM github_app_installations gai
WHERE gai.installation_id = 75772461
ON CONFLICT (installation_id, repository_id) DO NOTHING;

-- Verify the installation was created
SELECT
    gai.installation_id,
    gai.account_name,
    r.full_name,
    aer.enabled_at
FROM github_app_installations gai
JOIN app_enabled_repositories aer ON aer.installation_id = gai.id
JOIN repositories r ON r.id = aer.repository_id
WHERE gai.installation_id = 75772461;
