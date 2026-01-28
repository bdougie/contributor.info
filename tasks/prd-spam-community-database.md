# PRD: Known Spammer Community Database

**Issue:** #1622
**Branch:** `feature/1622-spam-community-database`
**Priority:** Tier 2

## Overview

Create a community-driven spam reporting system where users can submit spam PRs via a `/spam` form, building a shareable database for maintainers to identify and filter spam contributors.

## Current State

- **SpamDetectionService** with weighted scoring (template 40%, content 30%, account 20%, PR 10%)
- **spam_detections** table for admin reviews
- **Admin dashboard** at `/admin/spam` for review workflow
- **WorkspaceSpamTab** for maintainers

**Gap:** No community contribution mechanism or shareable API.

---

## Implementation Phases

### Phase 1: Core Infrastructure ✅
**Commit:** Database tables, form page, submission API

**Database:**
- `spam_reports` table with RLS
- `known_spammers` table with RLS
- `spam_reporters` table for tracking reporter reputation

**Abuse Prevention (Built-in):**
- Rate limiting: 10/hour anonymous, 50/day authenticated
- Trusted reporters: 50/hour, 200/day (earned via 80%+ accuracy)
- Auto-ban: 5+ rejected reports with <30% accuracy
- Reporter reputation tracking with accuracy scores
- IP hash tracking for anonymous submissions

**UI:**
- `/spam` form page with validation
- PR URL input with GitHub validation
- Spam category dropdown (Hacktoberfest, Bot/automated, Fake contribution, Self-promotion, Low quality, Other)
- Description textarea (optional)
- Reporter info (auto-filled if logged in)

**API:**
- Report submission endpoint
- Duplicate detection (same PR URL)
- Rate limit check via `check_spam_report_rate_limit()` function

---

### Phase 2: Verification Workflow ✅
**Commit:** Admin dashboard integration, bulk tools

**Reuse Existing:**
- Extend `spam-management.tsx` with reports tab
- Reuse `SpamManagement` table/filter patterns
- Leverage `logAdminAction()` for audit trail

**New Features:**
- Reports review queue (pending → verified/rejected)
- Bulk verification tools
- Auto-verify threshold (3+ independent reports)
- Link reports to `spam_detections` when PR exists

**Reporter Management (Admin):**
- View all reporters with stats (total, verified, rejected, accuracy)
- See trusted/banned status
- Manual ban/unban with reason
- Reporter activity timeline
- Filter by: trusted, banned, low accuracy, high volume

---

### Phase 3: Shareable API
**Commit:** Public endpoints with oss.fyi links

**API Endpoints (Netlify Functions):**
- `GET /api/spam/check/:github_login` - Check if user is known spammer
- `GET /api/spam/list` - Paginated verified spam PRs
- `GET /api/spam/export` - Export CSV/JSON

**oss.fyi Integration:**
- Use existing `create-short-url.ts` pattern
- Create shareable links like `oss.fyi/spam/username`
- Track clicks via Dub.co analytics

**Rate Limiting:**
- 100 requests/hour anonymous
- 1000 requests/hour with API key

---

### Phase 4: AI Integration
**Commit:** Feed reports into detection model

**Integration:**
- Verified reports increase spam score weight
- Track false positive appeals
- Add `community_reports` factor to SpamDetectionService
- Update DETECTION_WEIGHTS to include community signal

---

## Technical Details

### Database Schema

```sql
-- spam_reports table
CREATE TABLE spam_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_url TEXT NOT NULL,
  pr_owner TEXT NOT NULL,
  pr_repo TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  contributor_github_login TEXT,
  spam_category TEXT NOT NULL,
  description TEXT,
  reporter_id UUID REFERENCES auth.users(id),
  reporter_ip_hash TEXT,
  spam_reporter_id UUID REFERENCES spam_reporters(id),
  status TEXT DEFAULT 'pending',
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  report_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pr_owner, pr_repo, pr_number)
);

-- known_spammers table
CREATE TABLE known_spammers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_login TEXT UNIQUE NOT NULL,
  github_id BIGINT UNIQUE,
  spam_pr_count INTEGER DEFAULT 0,
  first_reported_at TIMESTAMPTZ DEFAULT NOW(),
  last_reported_at TIMESTAMPTZ DEFAULT NOW(),
  verification_status TEXT DEFAULT 'unverified',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- spam_reporters table (abuse prevention)
CREATE TABLE spam_reporters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  ip_hash TEXT,
  github_login TEXT,
  total_reports INTEGER DEFAULT 0,
  verified_reports INTEGER DEFAULT 0,
  rejected_reports INTEGER DEFAULT 0,
  accuracy_score DECIMAL(5,2) DEFAULT 0.00,
  is_trusted BOOLEAN DEFAULT false,
  is_banned BOOLEAN DEFAULT false,
  ban_reason TEXT,
  banned_at TIMESTAMPTZ,
  reports_today INTEGER DEFAULT 0,
  reports_this_hour INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Spam Categories

| Category | Description |
|----------|-------------|
| `hacktoberfest` | Hacktoberfest spam (name additions, trivial changes) |
| `bot_automated` | Bot or automated PRs |
| `fake_contribution` | Fake/meaningless contributions |
| `self_promotion` | Self-promotional content |
| `low_quality` | Low quality contributions |
| `other` | Other spam types |

---

## Success Metrics

- Community reports submitted per week
- Verification rate (% confirmed as spam)
- False positive rate (appealed reports)
- API usage by external maintainers
- Reduction in spam on tracked repositories

---

## References

- Existing spam: `src/lib/spam/SpamDetectionService.ts`
- Admin UI: `src/components/features/admin/spam-management.tsx`
- oss.fyi: `netlify/functions/create-short-url.ts`
- Dub docs: `docs/infrastructure/dub-env-configuration.md`
