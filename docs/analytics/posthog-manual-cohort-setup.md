# PostHog Manual Cohort Setup Guide

Since your API key needs additional scopes, here's how to create the cohorts manually in the PostHog UI:

## Quick Links
- **Cohorts Page**: https://app.posthog.com/project/173101/cohorts
- **Create New Cohort**: https://app.posthog.com/project/173101/cohorts/new

## Cohorts to Create

### 1. 🔥 Power Users

**Click "New Cohort" and configure:**
- **Name**: Power Users
- **Match criteria**: Match ALL of the following
- **Add condition**: 
  1. Performed event → `workspace_created` → at least → 1 times → in the last → 90 days
  2. AND Performed event → `repository_added_to_workspace` → at least → 3 times → in the last → 30 days

---

### 2. 🆕 New Users (First 30 Days)

**Configuration:**
- **Name**: New Users
- **Match criteria**: Match ALL of the following
- **Add condition**:
  1. Performed event → `login_successful` → where → `is_first_time` equals `true` → in the last → 30 days

---

### 3. 🔍 Active Searchers

**Configuration:**
- **Name**: Active Searchers
- **Match criteria**: Match ALL of the following
- **Add condition**:
  1. Performed event → `repository_searched` → at least → 5 times → in the last → 7 days
  2. AND Performed event → `repository_selected_from_search` → at least → 2 times → in the last → 7 days

---

### 4. 📊 Workspace Power Users

**Configuration:**
- **Name**: Workspace Power Users
- **Match criteria**: Match ALL of the following
- **Add condition**:
  1. Performed event → `workspace_created` → at least → 1 times → ever
  2. AND Performed event → `repository_added_to_workspace` → at least → 5 times → ever
  3. AND Performed event → `workspace_settings_modified` → at least → 1 times → ever

---

### 5. 👀 Repository Browsers (No Workspace)

**Configuration:**
- **Name**: Repository Browsers
- **Match criteria**: Match ALL of the following
- **Add condition**:
  1. Performed event → `repository_page_viewed` → at least → 3 times → in the last → 30 days
  2. AND Did NOT perform event → `workspace_created` → ever

---

### 6. 📈 Trending Discovery Users

**Configuration:**
- **Name**: Trending Discovery Users
- **Match criteria**: Match ALL of the following
- **Add condition**:
  1. Performed event → `trending_page_interaction` → where → `action` equals `repository_clicked` → at least → 2 times → in the last → 7 days

---

### 7. 🔄 Manual Data Refreshers

**Configuration:**
- **Name**: Manual Data Refreshers
- **Match criteria**: Match ALL of the following
- **Add condition**:
  1. Performed event → `data_refresh_triggered` → where → `trigger_type` equals `manual` → at least → 3 times → in the last → 30 days

---

### 8. 📤 Content Sharers

**Configuration:**
- **Name**: Content Sharers
- **Match criteria**: Match ALL of the following
- **Add condition**:
  1. Performed event → `share_action` → at least → 2 times → ever

---

### 9. 🎯 High Intent (No Workspace)

**Configuration:**
- **Name**: High Intent Users
- **Match criteria**: Match ALL of the following
- **Add condition**:
  1. Performed event → `repository_page_viewed` → at least → 10 times → in the last → 30 days
  2. AND Performed event → `repository_tab_switched` → at least → 5 times → in the last → 30 days
  3. AND Did NOT perform event → `workspace_created` → ever

---

### 10. ⚠️ Error Experiencers

**Configuration:**
- **Name**: Error Experiencers
- **Match criteria**: Match ANY of the following
- **Add condition**:
  1. Performed event → `error_boundary_triggered` → at least → 1 times → in the last → 7 days
  2. OR Performed event → `page_not_found` → at least → 2 times → in the last → 7 days

---

### 11. 🔐 Authenticated Users

**Configuration:**
- **Name**: Authenticated Users
- **Match criteria**: Match ALL of the following
- **Add condition**:
  1. Performed event → `login_successful` → at least → 1 times → ever

---

### 12. 💤 Dormant Users

**Configuration:**
- **Name**: Dormant Users
- **Match criteria**: Match ALL of the following
- **Add condition**:
  1. Last seen → more than → 30 days ago
  2. AND Performed event → `login_successful` → at least → 1 times → ever

---

## Pro Tips for Manual Setup

### Using the UI Efficiently

1. **Duplicate Similar Cohorts**: After creating one, use the "Duplicate" option to create similar ones
2. **Test with Preview**: Use the "Preview matching users" to verify your conditions
3. **Save as Dynamic**: Ensure "Dynamic cohort" is selected so it auto-updates

### Keyboard Shortcuts
- `Cmd/Ctrl + Enter` - Save cohort
- `Escape` - Cancel editing

### Bulk Operations

If you need to create many cohorts, you can use the browser console:

```javascript
// Helper to fill in cohort form (run in PostHog cohort creation page)
function fillCohortForm(name, description) {
  document.querySelector('input[placeholder*="Name"]').value = name;
  document.querySelector('textarea[placeholder*="Description"]').value = description;
}

// Example usage
fillCohortForm("🔥 Power Users", "Users who have created workspaces and added multiple repositories");
```

## Verification Checklist

After creating each cohort:

- [ ] Cohort appears in the list at https://app.posthog.com/project/173101/cohorts
- [ ] Click on cohort to verify conditions are correct
- [ ] Check "Matching users" count is reasonable
- [ ] Test in an Insight to ensure filtering works

## Using Cohorts After Creation

### Quick Actions

1. **Filter Insights**: 
   - Go to any insight
   - Add filter → Cohort → Select your cohort

2. **Create Feature Flag**:
   - Go to Feature Flags → New
   - Release conditions → Add → User in cohort → Select cohort

3. **Build Dashboard**:
   - Create a new dashboard called "Cohort Analysis"
   - Add insights comparing metrics across cohorts

### Recommended Insights to Create

1. **Cohort Funnel**:
   - Browser → Signed Up → Created Workspace → Power User

2. **Retention by Cohort**:
   - Compare 7-day retention across all cohorts

3. **Feature Adoption**:
   - Track new feature usage by cohort

4. **Cohort Growth**:
   - Line chart showing cohort sizes over time

## Alternative: Update Your API Key

If you want to use the automated script:

1. Go to https://app.posthog.com/me/settings/personal-api-keys
2. Find your existing key
3. Click "Edit"
4. Add these scopes:
   - `cohort:read`
   - `cohort:write`
5. Save the key
6. Run `npm run setup-cohorts` again

## Next Steps

Once cohorts are created:

1. **Set up weekly cohort review** - Monitor changes in cohort sizes
2. **Create cohort-specific experiments** - A/B test features for different cohorts
3. **Build retention playbooks** - Different strategies for each cohort
4. **Export cohort data** - Use API to sync with CRM or email tools