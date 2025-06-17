# Product Requirements Document: AI Insights Authentication Gating

## Project Overview

### Objective
Implement authentication-based access control for AI-powered insights to protect against unauthorized API costs while maintaining public access to core repository metrics.

### Background
Current state:
- **LLM Integration**: Complete with Repository Health, AI Recommendations, and caching system
- **Authentication System**: Supabase GitHub OAuth with `useGitHubAuth` hook
- **Cost Exposure**: OpenAI API costs ~$0.01-0.03 per insight generation with no rate limiting
- **Public Access**: All insights currently available without authentication

### Success Metrics
- **Primary**: Zero unauthorized LLM API costs
- **Secondary**: Minimal impact on user experience for public features
- **Tertiary**: Clear value proposition for login requirement

## Current State Analysis

### Authentication Infrastructure ✅ Available
- **Supabase GitHub OAuth**: `/src/hooks/use-github-auth.ts`
- **Auth Components**: `AuthButton`, `LoginDialog` in `/src/components/features/auth/`
- **Login States**: `isLoggedIn`, `loading`, `showLoginDialog`
- **Patterns**: Existing login requirement for repository search

### Insight Components Analysis

#### 🔓 Public (No Login Required)
- **PR Activity** (`/src/components/insights/sections/pr-activity.tsx`)
  - Basic metrics calculation without LLM
  - Uses `calculatePrActivityMetrics` only
- **Trends** (`/src/components/insights/sections/trends.tsx`)
  - Trend analysis without LLM enhancement
  - Uses `calculateTrendMetrics` only

#### 🔒 Private (Login Required)
- **Repository Health** (`/src/components/insights/sections/repository-health.tsx`)
  - Lines 37-38: `llmService.isAvailable()` and `loadLLMInsight(metrics)`
  - Contains AI-powered health assessments
- **Recommendations** (`/src/components/insights/sections/recommendations.tsx`)
  - Lines 47-48: LLM insight generation
  - AI-generated actionable recommendations
- **Cache Debug** (`/src/components/insights/cache-debug.tsx`)
  - Development utility, should remain accessible

## Implementation Plan

### Phase 1: Core Authentication Gates (HIGH Priority)

#### 1.1 Create Authentication Gate Component
```typescript
// /src/components/insights/auth-gate.tsx
interface AuthGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
```

**Features:**
- Check `useGitHubAuth().isLoggedIn` state
- Display login prompt with feature-specific messaging
- Graceful fallback to public content when provided
- Integration with existing `LoginDialog` component

#### 1.2 Implement Feature-Specific Login Prompts
```typescript
interface LoginPromptProps {
  feature: 'repository-health' | 'recommendations';
  onLogin: () => void;
}
```

**Content Strategy:**
- **Repository Health**: "Get AI-powered health assessments and detailed analysis"
- **Recommendations**: "Unlock personalized AI recommendations for your repositories"

#### 1.3 Update Repository Health Component
**Changes Required:**
- Wrap LLM sections (lines 37+ in `repository-health.tsx`) with `AuthGate`
- Keep basic health metrics public
- Show login prompt only for AI insight section
- Maintain fallback behavior when LLM unavailable

#### 1.4 Update Recommendations Component
**Changes Required:**
- Wrap entire component with `AuthGate` or show basic fallback
- Alternative: Show rule-based recommendations publicly, AI recommendations privately
- Maintain loading states for authenticated users

### Phase 2: UI/UX Polish (MEDIUM Priority)

#### 2.1 Design Login Prompt Cards
**Visual Requirements:**
- Consistent with existing card design system
- Clear value proposition messaging
- Prominent "Login with GitHub" button
- Optional "Learn more about AI features" link

#### 2.2 Progressive Disclosure Pattern
**Implementation:**
- Show preview/summary of AI features when logged out
- "Unlock full insights" call-to-action
- Smooth transition to full content after login

#### 2.3 Loading States for Authenticated Features
**Requirements:**
- Enhanced loading indicators for LLM operations
- "Generating AI insights..." messaging
- Confidence indicators and timing information

### Phase 3: Enhanced Access Control (LOW Priority)

#### 3.1 Rate Limiting for Authenticated Users
**Future Considerations:**
- Per-user daily/hourly limits
- Usage analytics and cost tracking
- Fair use policy implementation

#### 3.2 Admin Controls
**Optional Features:**
- Toggle AI features on/off globally
- Monitor usage and costs per user
- Rate limit adjustments

## Technical Implementation Details

### Authentication Check Pattern
```typescript
const { isLoggedIn, loading, setShowLoginDialog } = useGitHubAuth();

// In component render:
if (!isLoggedIn) {
  return <LoginPromptCard feature="repository-health" />;
}

// Proceed with LLM operations...
```

### AuthGate Component Structure
```typescript
export function AuthGate({ feature, children, fallback }: AuthGateProps) {
  const { isLoggedIn } = useGitHubAuth();
  
  if (!isLoggedIn) {
    return fallback || <LoginPromptCard feature={feature} />;
  }
  
  return <>{children}</>;
}
```

### Integration Points

#### Repository Health Changes
```typescript
// Before: Direct LLM call
if (metrics && llmService.isAvailable()) {
  loadLLMInsight(metrics);
}

// After: Authentication check first
<AuthGate feature="repository-health" fallback={<BasicHealthSummary />}>
  {metrics && llmService.isAvailable() && (
    <LLMInsightSection insight={llmInsight} loading={llmLoading} />
  )}
</AuthGate>
```

#### Recommendations Changes
```typescript
// Wrap LLM-dependent sections
<AuthGate 
  feature="recommendations" 
  fallback={<BasicRecommendations />}
>
  <AIRecommendations insight={llmInsight} />
</AuthGate>
```

## User Experience Flow

### For Anonymous Users
1. **Public Insights**: See PR Activity and Trends normally
2. **AI Preview Cards**: See locked AI insight sections with value propositions
3. **Login Prompt**: Click "Unlock AI Insights" → GitHub OAuth flow
4. **Post-Login**: Automatic unlock of AI features with redirect back

### For Authenticated Users
1. **Full Access**: All insights including AI-powered sections
2. **Enhanced Loading**: Clear feedback during LLM operations
3. **Confidence Indicators**: Show AI confidence levels and timing
4. **Logout Impact**: Graceful degradation to public features only

## Security & Cost Protection

### Rate Limiting Strategy
- **Authenticated Users**: Track LLM usage per session
- **Cooldown Periods**: Prevent rapid-fire requests
- **Circuit Breaker**: Disable LLM if error rates spike

### Monitoring Requirements
- **Cost Tracking**: Monitor OpenAI API usage per user
- **Usage Analytics**: Track feature adoption post-authentication
- **Error Monitoring**: Track authentication failures and LLM errors

## Testing Strategy

### Unit Tests
- `AuthGate` component with various auth states
- Login prompt rendering and interactions
- Feature flag behavior for LLM operations

### Integration Tests  
- End-to-end authentication flow
- Post-login feature unlocking
- Graceful degradation scenarios

### User Acceptance Testing
- Anonymous user experience validation
- Authentication flow usability
- Feature value perception assessment

## Risk Assessment

### Technical Risks
- **Authentication Failures**: Fallback to public features mitigates impact
- **LLM Service Outages**: Existing fallback patterns handle this
- **Performance Impact**: Authentication checks are lightweight

### Business Risks
- **User Friction**: Balanced by clear value proposition and existing login patterns
- **Feature Adoption**: Mitigated by maintaining public core features
- **Cost Overruns**: Primary objective addresses this directly

## Acceptance Criteria

### Phase 1 Completion Criteria ✅
- [ ] Repository Health shows basic metrics publicly, AI insights require login
- [ ] Recommendations shows rule-based fallbacks publicly, AI insights require login  
- [ ] PR Activity and Trends remain fully public
- [ ] Login prompts clearly explain value of AI features
- [ ] Smooth authentication flow with redirect back to content
- [ ] No unauthorized LLM API calls possible
- [ ] Existing user experience preserved for authenticated users

### Success Validation
- [ ] Zero API costs from anonymous users
- [ ] No degradation in public feature performance
- [ ] Authentication conversion rate > 15% for AI feature interactions
- [ ] User feedback indicates clear understanding of value proposition

## Future Considerations

### Premium Feature Evolution
- Consider positioning advanced AI insights as premium features
- Implement usage tiers and potential paid subscriptions
- Advanced analytics and reporting for authenticated users
- Integration with GitHub repository access controls

### Enhanced Personalization
- User-specific insight caching and preferences
- Historical insight tracking and trends
- Customizable recommendation priorities
- Team collaboration features for repository insights

---

## Implementation Timeline

**Phase 1 (Core Authentication Gates)**
- Week 1: AuthGate component and login prompts
- Week 2: Repository Health and Recommendations updates
- Week 3: Testing and polish

**Phase 2 (UI/UX Polish)**
- Week 4: Enhanced login prompt designs
- Week 5: Progressive disclosure implementation
- Week 6: Loading state improvements

**Phase 3 (Enhanced Controls)**
- Future iterations based on usage data and feedback