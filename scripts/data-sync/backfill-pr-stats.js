// Test script to trigger the backfill-pr-stats function
// Run with: node scripts/backfill-pr-stats.js

const SUPABASE_URL = 'https://egcxzonpmmcirmgqdrla.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnY3h6b25wbW1jaXJtZ3FkcmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MzEwMTcsImV4cCI6MjA2MTEwNzAxN30.8z1xRsBD2IEgNt5s2zldqTOzXpfDCrAh3gfHVtE8SpQ'

async function runBackfill() {
  try {
    const url = `${SUPABASE_URL}/functions/v1/backfill-pr-stats?batch_size=5&max_batches=1`
    
    console.log('Triggering backfill function...')
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    })
    
    const result = await response.text()
    
    console.log('Response status:', response.status)
    console.log('Response:', result)
    
    if (response.ok) {
      const data = JSON.parse(result)
      console.log('✅ Backfill completed:', data)
    } else {
      console.error('❌ Backfill failed:', result)
    }
    
  } catch (error) {
    console.error('❌ Error running backfill:', error)
  }
}

runBackfill()