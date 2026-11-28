-- Track the time of the last Polar webhook event applied to a subscription so
-- that out-of-order or replayed events do not overwrite newer state.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;
