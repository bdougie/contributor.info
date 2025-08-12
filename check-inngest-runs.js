// Check Inngest function runs to see validation errors
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function checkInngestRuns() {
  console.log('Checking Inngest function runs...\n');
  
  try {
    // Get list of runs
    const response = await fetch('http://localhost:8288/v0/runs?limit=10', {
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch runs:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log(`Found ${data.data?.length || 0} recent runs\n`);
    
    // Display each run
    data.data?.forEach((run, index) => {
      console.log(`Run ${index + 1}:`);
      console.log(`  ID: ${run.id}`);
      console.log(`  Function: ${run.function_id}`);
      console.log(`  Status: ${run.status}`);
      console.log(`  Started: ${run.started_at}`);
      
      if (run.error) {
        console.log(`  ❌ Error: ${run.error.message || run.error}`);
      }
      
      if (run.output) {
        console.log(`  Output: ${JSON.stringify(run.output)}`);
      }
      
      console.log('');
    });
    
  } catch (error) {
    console.error('Error checking runs:', error);
  }
}

checkInngestRuns();