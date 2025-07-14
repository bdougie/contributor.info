import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 Inngest Function Registration Diagnostic\n');

console.log('1️⃣  Current npm start command:');
console.log('   Runs 3 processes concurrently:');
console.log('   - VITE on port 5174');
console.log('   - NETLIFY dev (proxies to Vite)');
console.log('   - INNGEST dev connecting to http://127.0.0.1:8888/.netlify/functions/inngest-local\n');

console.log('2️⃣  Key Issues to Check:\n');

console.log('❓ Are functions showing up at http://localhost:8288/functions?');
console.log('   If NO:');
console.log('   - The inngest-local function might not be exporting functions correctly');
console.log('   - Environment variables might be missing');
console.log('   - There might be import errors in the function files\n');

console.log('❓ Are events being created but not triggering functions?');
console.log('   If YES:');
console.log('   - Event names might not match function triggers');
console.log('   - Functions might be throwing errors during initialization');
console.log('   - Check the Inngest dev console for error messages\n');

console.log('3️⃣  Local vs Production Functions:\n');

console.log('Local endpoint: /.netlify/functions/inngest-local');
console.log('   - Uses simple test functions');
console.log('   - Good for basic testing\n');

console.log('Production endpoint: /.netlify/functions/inngest-prod');
console.log('   - Uses function creators (createCaptureRepositorySyncGraphQL)');
console.log('   - Requires production environment variables\n');

console.log('4️⃣  Quick Debug Steps:\n');
console.log('1. Stop all processes (Ctrl+C)');
console.log('2. Run: npm start');
console.log('3. Wait for all services to start');
console.log('4. Visit: http://localhost:8288/functions');
console.log('5. Check if functions are listed');
console.log('6. Run: node scripts/test-inngest-events.js');
console.log('7. Check http://localhost:8288/runs for function executions\n');

console.log('5️⃣  Environment Variables Required:');
console.log(`   INNGEST_EVENT_KEY: ${process.env.INNGEST_EVENT_KEY ? '✅ SET' : '❌ NOT SET'}`);
console.log(`   INNGEST_SIGNING_KEY: ${process.env.INNGEST_SIGNING_KEY ? '✅ SET' : '❌ NOT SET'}`);
console.log(`   GITHUB_TOKEN: ${(process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN) ? '✅ SET' : '❌ NOT SET'}`);
console.log(`   SUPABASE_URL: ${(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) ? '✅ SET' : '❌ NOT SET'}`);
console.log(`   SUPABASE_ANON_KEY: ${(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY) ? '✅ SET' : '❌ NOT SET'}\n`);

console.log('6️⃣  Alternative: Use the Full Local Function');
console.log('   We created inngest-local-full.mts with all capture functions');
console.log('   To use it, update package.json start script to use:');
console.log('   http://127.0.0.1:8888/.netlify/functions/inngest-local-full\n');