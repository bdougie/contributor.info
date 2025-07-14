console.log(`
🔍 Debug UI Events - Browser Console Script

Copy and paste this into your browser console while on the contributor.info app:

// 1. Check Inngest client configuration
console.log('Inngest Client Config:', {
  isDev: window.inngest?.isDev,
  id: window.inngest?.id,
  hasEventKey: !!window.inngest?.eventKey
});

// 2. Intercept fetch to see queue-event calls
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  if (url && url.includes('queue-event')) {
    console.log('📤 Queue Event Call:', {
      url: url,
      body: args[1]?.body ? JSON.parse(args[1].body) : null
    });
  }
  return originalFetch.apply(this, args);
};
console.log('✅ Fetch interceptor installed - now view a repository');

// 3. Check if events are being sent directly
if (window.inngest) {
  const originalSend = window.inngest.send;
  window.inngest.send = function(event) {
    console.log('📤 Direct Inngest Send:', event);
    return originalSend.call(this, event);
  };
  console.log('✅ Inngest send interceptor installed');
}

// 4. Manually send a test event
async function sendTestEvent() {
  try {
    const response = await fetch('/.netlify/functions/queue-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'test/local.hello',
        data: { 
          message: 'Manual browser test',
          timestamp: new Date().toISOString()
        }
      })
    });
    const result = await response.json();
    console.log('✅ Manual test event result:', result);
  } catch (error) {
    console.error('❌ Manual test failed:', error);
  }
}

console.log('\\n💡 Now try:');
console.log('1. View a repository to see what events are sent');
console.log('2. Run: sendTestEvent() to manually test');
console.log('3. Check the Network tab for queue-event requests');
`);