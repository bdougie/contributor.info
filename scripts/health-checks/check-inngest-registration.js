import dotenv from 'dotenv';

dotenv.config();

async function checkInngestRegistration() {
  console.log('Checking Inngest function registration...\n');

  // Check local endpoint
  console.log('1. Checking local endpoint:');
  try {
    const localResponse = await fetch('http://localhost:8888/.netlify/functions/inngest-local');
    console.log(`   Status: ${localResponse.status}`);
    if (localResponse.ok) {
      const text = await localResponse.text();
      console.log(`   Response: ${text.substring(0, 100)}...`);
    }
  } catch (error) {
    console.log(`   ❌ Local endpoint error: ${error.message}`);
  }

  // Check production endpoint
  console.log('\n2. Checking production endpoint:');
  try {
    const prodResponse = await fetch('https://contributor.info/.netlify/functions/inngest-prod');
    console.log(`   Status: ${prodResponse.status}`);
    if (prodResponse.ok) {
      const text = await prodResponse.text();
      console.log(`   Response: ${text.substring(0, 100)}...`);
    }
  } catch (error) {
    console.log(`   ❌ Production endpoint error: ${error.message}`);
  }

  // Check function registration via Inngest Dev UI
  console.log('\n3. Next steps to verify function registration:');
  console.log('   - For local: Visit http://localhost:8288/functions');
  console.log('   - Check if functions are listed there');
  console.log('   - If not, the functions might not be registering properly');
  console.log('\n4. Common issues:');
  console.log('   - Functions not exported from the serve() handler');
  console.log('   - Environment variables not set correctly');
  console.log('   - Signing key mismatch between client and server');
  console.log('   - Function IDs changed but Inngest still has old registrations');
}

checkInngestRegistration();
