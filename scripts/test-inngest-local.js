#!/usr/bin/env node

// Test script to send events to the local Inngest setup

async function testLocalInngest() {
  console.log("Testing local Inngest setup...\n");
  
  // Test the queue-event endpoint
  try {
    const response = await fetch('http://localhost:8888/.netlify/functions/queue-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        eventName: 'capture/repository.sync.graphql',
        data: {
          repositoryId: 'test-repo-123',
          repositoryName: 'test/repo',
          days: 7,
          priority: 'high',
          reason: 'Testing local Inngest'
        }
      })
    });
    
    const result = await response.json();
    console.log("Response:", result);
    
    if (result.success) {
      console.log("\n✅ Event sent successfully!");
      console.log("Event ID:", result.id);
      console.log("\nCheck these URLs:");
      console.log("- Inngest Dev Server: http://localhost:8288/");
      console.log("- Stream view: http://localhost:8288/stream");
      console.log("- Function runs: http://localhost:8288/runs");
    } else {
      console.error("\n❌ Failed to send event:", result.error);
    }
  } catch (error) {
    console.error("\n❌ Error connecting to endpoint:", error.message);
    console.error("\nMake sure:");
    console.error("1. Netlify Dev is running (should be on port 8888)");
    console.error("2. The queue-event function is available");
    console.error("3. Inngest Dev Server is running");
  }
  
  // Also test direct Inngest connection
  console.log("\n\nTesting direct Inngest connection...");
  try {
    const { Inngest } = await import("inngest");
    const inngest = new Inngest({ 
      id: "contributor-info",
      isDev: true,
      eventKey: process.env.INNGEST_EVENT_KEY || "test-key"
    });
    
    const result = await inngest.send({
      name: "test/direct",
      data: {
        message: "Direct test event",
        timestamp: new Date().toISOString()
      }
    });
    
    console.log("✅ Direct event sent:", result.ids?.[0]);
  } catch (error) {
    console.error("❌ Direct send failed:", error.message);
  }
}

testLocalInngest();