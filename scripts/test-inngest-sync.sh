#!/bin/bash

# Test Inngest sync manually
# This simulates what Inngest does when syncing

ENDPOINT="https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/inngest-prod"

echo "Testing Inngest endpoint..."
echo "=========================="

# Test GET (should return function list)
echo -e "\n1. Testing GET request:"
curl -s -X GET "$ENDPOINT" | jq '.'

# Test PUT with deployId (registration)
echo -e "\n2. Testing PUT request (sync):"
curl -s -X PUT "$ENDPOINT?deployId=test-$(date +%s)" \
  -H "Content-Type: application/json" \
  | jq '.'

echo -e "\nDone!"