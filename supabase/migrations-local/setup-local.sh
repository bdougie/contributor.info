#!/bin/bash

# Local Supabase Migration Setup Script
# This script sets up your local Supabase database with all migrations

set -e

echo "🚀 Setting up local Supabase database..."

# Check if Supabase is running
if ! supabase status 2>/dev/null | grep -q "supabase local development setup is running"; then
  echo "❌ Supabase is not running. Please run 'supabase start' first."
  exit 1
fi

# Database connection
DB_URL="postgresql://postgres:postgres@localhost:54322/postgres"

echo "📦 Running consolidated migration..."

# Run the consolidated migration
psql "$DB_URL" -f supabase/migrations-local/000_consolidated_local_safe.sql

if [ $? -eq 0 ]; then
  echo "✅ Migration completed successfully!"
  
  # Show summary
  psql "$DB_URL" -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"
  psql "$DB_URL" -c "SELECT COUNT(*) as function_count FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public';"
else
  echo "❌ Migration failed. Check the error messages above."
  exit 1
fi

echo "🎉 Local database setup complete!"