#!/usr/bin/env node
import dotenv from 'dotenv';
import { Inngest } from 'inngest';

dotenv.config();

// Create Inngest client
const inngest = new Inngest({
  id: 'contributor-info',
  isDev: false, // Production mode
  eventKey: process.env.INNGEST_PRODUCTION_EVENT_KEY || process.env.INNGEST_EVENT_KEY
});

async function testDiscoveryEvent() {
  console.log('🔍 Testing Repository Discovery Event\n');

  const testRepo = process.argv[2] || 'zml/zml';
  const [owner, repo] = testRepo.split('/');

  if (!owner || !repo) {
    console.error('❌ Please provide a repository in the format: owner/repo');
    console.error('Example: node scripts/test-discovery-event.js zml/zml');
    process.exit(1);
  }

  const event = {
    name: 'discover/repository.new',
    data: {
      owner,
      repo,
      source: 'test-script',
      userId: null,
      timestamp: new Date().toISOString()
    }
  };

  console.log('📤 Sending discovery event for %s/%s', owner, repo);
  console.log('Event data:', JSON.stringify(event, null, 2));

  try {
    const result = await inngest.send(event);
    console.log('\n✅ Event sent successfully!');
    console.log('Event ID:', result.ids?.[0]);
    console.log('\n📊 Check the Inngest dashboard to see if it\'s processing:');
    console.log('https://app.inngest.com/env/production/events');
    console.log('https://app.inngest.com/env/production/runs');

    // Also check if the function handler endpoint is accessible
    console.log('\n🔗 Checking Inngest endpoint...');
    const endpointUrl = 'https://contributor.info/.netlify/functions/inngest';
    const endpointResponse = await fetch(endpointUrl);

    if (endpointResponse.ok) {
      const endpointData = await endpointResponse.json();
      console.log('✅ Inngest endpoint is accessible');
      console.log('Registered functions:', endpointData.functions?.join(', ') || 'unknown');

      if (endpointData.functions?.includes('discover-new-repository')) {
        console.log('✅ discover-new-repository function is registered!');
      } else {
        console.log('⚠️  discover-new-repository function NOT found in registered functions');
      }
    } else {
      console.log('❌ Inngest endpoint returned:', endpointResponse.status);
    }

  } catch (error) {
    console.error('❌ Failed to send event:', error.message);
    console.error('Full error:', error);

    if (error.message.includes('INNGEST_EVENT_KEY')) {
      console.log('\n💡 Hint: Make sure INNGEST_EVENT_KEY or INNGEST_PRODUCTION_EVENT_KEY is set in .env');
    }
  }
}

testDiscoveryEvent();