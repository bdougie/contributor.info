-- Subscription System for Workspaces
-- This migration creates tables for managing workspace subscriptions, usage tracking, and billing

-- =====================================================
-- SUBSCRIPTION TABLES
-- =====================================================

-- 1. User subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Stripe integration
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,
    
    -- Subscription details
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
    
    -- Billing cycle
    billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,
    
    -- Trial information
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    
    -- Limits based on tier
    max_workspaces INTEGER NOT NULL DEFAULT 1,
    max_repos_per_workspace INTEGER NOT NULL DEFAULT 4,
    data_retention_days INTEGER NOT NULL DEFAULT 30,
    allows_private_repos BOOLEAN DEFAULT FALSE,
    
    -- Additional features
    features JSONB DEFAULT '{
        "priority_queue": false,
        "advanced_analytics": false,
        "api_access": false,
        "export_data": false,
        "team_collaboration": false,
        "custom_branding": false
    }'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure one subscription per user
    CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

-- 2. Usage tracking table
CREATE TABLE usage_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Usage metrics
    metric_type TEXT NOT NULL CHECK (metric_type IN (
        'workspace_count',
        'repository_count',
        'member_count',
        'api_calls',
        'data_queries',
        'export_count'
    )),
    value INTEGER NOT NULL DEFAULT 0,
    
    -- Time period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Metadata
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint for metric per period
    CONSTRAINT unique_usage_metric UNIQUE (user_id, workspace_id, metric_type, period_start)
);

-- 3. Billing history table
CREATE TABLE billing_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    
    -- Invoice details
    stripe_invoice_id TEXT UNIQUE,
    stripe_payment_intent_id TEXT,
    
    -- Amount in cents
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    
    -- Status
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    
    -- Description
    description TEXT,
    invoice_url TEXT,
    receipt_url TEXT,
    
    -- Dates
    billing_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Priority queue for data ingestion
CREATE TABLE priority_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    
    -- Priority level (lower number = higher priority)
    priority INTEGER NOT NULL DEFAULT 100 CHECK (priority BETWEEN 1 AND 1000),
    
    -- Queue status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    
    -- Processing details
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    
    -- Data capture window
    capture_window_hours INTEGER NOT NULL DEFAULT 24,
    last_captured_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB
);

-- 5. Email notification tracking (for Resend integration)
CREATE TABLE email_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Email details
    recipient_email TEXT NOT NULL,
    email_type TEXT NOT NULL CHECK (email_type IN (
        'workspace_invitation',
        'member_added',
        'member_removed',
        'role_changed',
        'subscription_confirmation',
        'payment_receipt',
        'payment_failed',
        'usage_limit_warning',
        'data_retention_warning',
        'workspace_summary'
    )),
    
    -- Resend integration
    resend_email_id TEXT UNIQUE,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'bounced', 'failed')),
    
    -- Content
    subject TEXT NOT NULL,
    template_data JSONB,
    
    -- Tracking
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TIER CONFIGURATION (Reference Table)
-- =====================================================

CREATE TABLE tier_limits (
    tier TEXT PRIMARY KEY CHECK (tier IN ('free', 'pro', 'enterprise')),
    
    -- Limits
    max_workspaces INTEGER NOT NULL,
    max_repos_per_workspace INTEGER NOT NULL,
    max_members_per_workspace INTEGER,
    data_retention_days INTEGER NOT NULL,
    
    -- Features
    allows_private_repos BOOLEAN DEFAULT FALSE,
    priority_queue_enabled BOOLEAN DEFAULT FALSE,
    advanced_analytics BOOLEAN DEFAULT FALSE,
    api_access BOOLEAN DEFAULT FALSE,
    export_enabled BOOLEAN DEFAULT FALSE,
    custom_branding BOOLEAN DEFAULT FALSE,
    
    -- Pricing (in cents)
    monthly_price INTEGER,
    yearly_price INTEGER,
    
    -- Additional workspace pricing
    additional_workspace_yearly INTEGER,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert tier configurations (prices in cents)
INSERT INTO tier_limits (
    tier, max_workspaces, max_repos_per_workspace, max_members_per_workspace,
    data_retention_days, allows_private_repos, priority_queue_enabled,
    advanced_analytics, api_access, export_enabled, custom_branding,
    monthly_price, yearly_price, additional_workspace_yearly
) VALUES
    ('free', 1, 4, 3, 30, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 0, 0, 0),
    ('pro', 5, 10, NULL, 90, FALSE, TRUE, TRUE, TRUE, TRUE, FALSE, 1200, 10000, 5000), -- $12/mo or $100/yr
    ('enterprise', 10, 10, NULL, 365, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, 50000, 400000, 25000); -- $500/mo or $4000/yr

-- =====================================================
-- FUNCTIONS FOR SUBSCRIPTION MANAGEMENT
-- =====================================================

-- Function to check if user can create more workspaces
CREATE OR REPLACE FUNCTION can_create_workspace(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_subscription subscriptions%ROWTYPE;
    current_workspace_count INTEGER;
BEGIN
    -- Get user's subscription
    SELECT * INTO user_subscription
    FROM subscriptions
    WHERE user_id = user_uuid AND status = 'active';
    
    -- If no subscription, use free tier defaults
    IF NOT FOUND THEN
        user_subscription.max_workspaces := 1;
    END IF;
    
    -- Count current workspaces
    SELECT COUNT(*) INTO current_workspace_count
    FROM workspaces
    WHERE owner_id = user_uuid AND is_active = TRUE;
    
    RETURN current_workspace_count < user_subscription.max_workspaces;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if workspace can add more repositories
CREATE OR REPLACE FUNCTION can_add_repository(workspace_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    workspace_record workspaces%ROWTYPE;
BEGIN
    -- Get workspace with limits
    SELECT * INTO workspace_record
    FROM workspaces
    WHERE id = workspace_uuid;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Use <= to allow reaching the limit, not just approaching it
    RETURN workspace_record.current_repository_count <= workspace_record.max_repositories;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update repository count when adding/removing repos
CREATE OR REPLACE FUNCTION update_repository_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE workspaces
        SET current_repository_count = current_repository_count + 1
        WHERE id = NEW.workspace_id;
        
        -- Check if limit exceeded
        IF NOT can_add_repository(NEW.workspace_id) THEN
            RAISE EXCEPTION 'Repository limit exceeded for this workspace';
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE workspaces
        SET current_repository_count = GREATEST(current_repository_count - 1, 0)
        WHERE id = OLD.workspace_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workspace_repo_count
    AFTER INSERT OR DELETE ON workspace_repositories
    FOR EACH ROW EXECUTE FUNCTION update_repository_count();

-- Function to update user's workspace limits based on subscription
CREATE OR REPLACE FUNCTION sync_workspace_limits()
RETURNS TRIGGER AS $$
BEGIN
    -- Update all workspaces owned by the user with new tier limits
    UPDATE workspaces
    SET 
        max_repositories = NEW.max_repos_per_workspace,
        data_retention_days = NEW.data_retention_days,
        tier = NEW.tier
    WHERE owner_id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_limits_on_subscription_change
    AFTER INSERT OR UPDATE OF tier ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION sync_workspace_limits();

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

CREATE INDEX idx_usage_tracking_user ON usage_tracking(user_id);
CREATE INDEX idx_usage_tracking_workspace ON usage_tracking(workspace_id);
CREATE INDEX idx_usage_tracking_period ON usage_tracking(period_start, period_end);

CREATE INDEX idx_billing_history_user ON billing_history(user_id);
CREATE INDEX idx_billing_history_status ON billing_history(status);
CREATE INDEX idx_billing_history_date ON billing_history(billing_date DESC);

CREATE INDEX idx_priority_queue_workspace ON priority_queue(workspace_id);
CREATE INDEX idx_priority_queue_status ON priority_queue(status, priority);
CREATE INDEX idx_priority_queue_pending ON priority_queue(priority) WHERE status = 'pending';
-- Ensure unique pending item per repository
CREATE UNIQUE INDEX unique_pending_queue_item ON priority_queue(repository_id) WHERE status = 'pending';

-- Email notification indexes
CREATE INDEX idx_email_user ON email_notifications(user_id);
CREATE INDEX idx_email_workspace ON email_notifications(workspace_id);
CREATE INDEX idx_email_type ON email_notifications(email_type);
CREATE INDEX idx_email_status ON email_notifications(status);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE priority_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_limits ENABLE ROW LEVEL SECURITY;

-- Subscriptions policies
CREATE POLICY "Users can view own subscription"
    ON subscriptions FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage subscriptions"
    ON subscriptions FOR ALL
    USING (auth.role() = 'service_role');

-- Usage tracking policies
CREATE POLICY "Users can view own usage"
    ON usage_tracking FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage usage tracking"
    ON usage_tracking FOR ALL
    USING (auth.role() = 'service_role');

-- Billing history policies
CREATE POLICY "Users can view own billing history"
    ON billing_history FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage billing history"
    ON billing_history FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Priority queue policies (service role only)
CREATE POLICY "Service role manages priority queue"
    ON priority_queue FOR ALL
    USING (auth.role() = 'service_role');

-- Email notifications policies
CREATE POLICY "Users can view own email notifications"
    ON email_notifications FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage email notifications"
    ON email_notifications FOR ALL
    USING (auth.role() = 'service_role');

-- Tier limits are public read
CREATE POLICY "Anyone can view tier limits"
    ON tier_limits FOR SELECT
    USING (TRUE);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE subscriptions IS 'User subscription details and tier information';
COMMENT ON TABLE usage_tracking IS 'Tracks usage metrics for billing and limits enforcement';
COMMENT ON TABLE billing_history IS 'Historical record of all billing transactions';
COMMENT ON TABLE priority_queue IS 'Queue for prioritized data ingestion based on tier';
COMMENT ON TABLE email_notifications IS 'Tracking for all transactional emails sent via Resend';
COMMENT ON TABLE tier_limits IS 'Configuration table for subscription tier limits and features';