/**
 * Script to trigger manual metrics capture via Inngest
 * Usage: npx tsx scripts/trigger-metrics-capture.ts
 */
import { Inngest } from 'inngest';

const eventKey = process.env.INNGEST_PRODUCTION_EVENT_KEY;

if (!eventKey) {
  console.error('Missing INNGEST_PRODUCTION_EVENT_KEY environment variable');
  process.exit(1);
}

const inngest = new Inngest({
  id: 'contributor-info',
  eventKey,
});

async function triggerMetricsCapture() {
  try {
    console.log('Sending metrics/repository.capture event...');
    const result = await inngest.send({
      name: 'metrics/repository.capture',
      data: {},
    });
    console.log('Event sent successfully:', JSON.stringify(result, null, 2));
    console.log('\nCheck Inngest dashboard for job status: https://app.inngest.com');
  } catch (error) {
    console.error('Failed to send event:', error);
    process.exit(1);
  }
}

triggerMetricsCapture();
