#!/bin/bash

# Script to verify Inngest keys are properly configured
# Does NOT expose the actual keys, only shows if they match expected patterns

set -e

echo "🔑 Verifying Inngest Key Configuration"
echo "======================================"
echo ""

# Check local .env file
if [ -f .env ]; then
  echo "✅ .env file found"

  # Check for event key
  if grep -q "INNGEST_EVENT_KEY" .env; then
    EVENT_KEY=$(grep INNGEST_EVENT_KEY .env | cut -d '=' -f2)
    echo "✅ INNGEST_EVENT_KEY found in .env (length: ${#EVENT_KEY})"

    # Event keys should start with "test_" or be empty
    if [[ $EVENT_KEY == test_* ]]; then
      echo "   ⚠️  Using TEST event key (starts with 'test_')"
    elif [ -z "$EVENT_KEY" ]; then
      echo "   ❌ Event key is empty!"
    else
      echo "   ✅ Using production event key"
    fi
  else
    echo "❌ INNGEST_EVENT_KEY not found in .env"
  fi

  # Check for signing key
  if grep -q "INNGEST_SIGNING_KEY" .env; then
    SIGNING_KEY=$(grep INNGEST_SIGNING_KEY .env | cut -d '=' -f2)
    echo "✅ INNGEST_SIGNING_KEY found in .env (length: ${#SIGNING_KEY})"

    # Signing keys should start with "signkey-"
    if [[ $SIGNING_KEY == signkey-* ]]; then
      echo "   ✅ Signing key has correct format (starts with 'signkey-')"
    elif [ -z "$SIGNING_KEY" ]; then
      echo "   ❌ Signing key is empty!"
    else
      echo "   ⚠️  Signing key doesn't start with 'signkey-' - may be incorrect"
    fi
  else
    echo "❌ INNGEST_SIGNING_KEY not found in .env"
  fi
else
  echo "❌ .env file not found"
fi

echo ""
echo "📝 Next steps to fix authorization errors:"
echo ""
echo "1. Go to Inngest Dashboard: https://app.inngest.com"
echo "2. Navigate to your app: contributor-info"
echo "3. Go to Settings > Keys"
echo "4. Verify the Signing Key matches what's in Supabase secrets"
echo "5. Make sure you're using PRODUCTION keys, not test keys"
echo ""
echo "To update Supabase secrets:"
echo "  supabase secrets set INNGEST_SIGNING_KEY=signkey-prod-..."
echo "  supabase secrets set INNGEST_EVENT_KEY=..."
echo ""
echo "After updating secrets, redeploy the function:"
echo "  supabase functions deploy inngest-prod"
