import { spawn } from 'child_process';

console.log('Netlify build starting...');

// Check if we have the required environment variables for social cards
const hasSupabaseToken = process.env.SUPABASE_TOKEN && process.env.SUPABASE_TOKEN !== '';
const hasAnonKey = process.env.VITE_SUPABASE_ANON_KEY && process.env.VITE_SUPABASE_ANON_KEY !== '';

if (hasSupabaseToken && hasAnonKey) {
  console.log('✅ Supabase credentials found - building with social cards');
  
  // Run the full build with social cards
  const build = spawn('npm', ['run', 'build'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env
  });
  
  build.on('close', (code) => {
    console.log(`Build completed with code ${code}`);
    process.exit(code);
  });
  
  build.on('error', (error) => {
    console.error('Build failed:', error);
    process.exit(1);
  });
  
} else {
  console.log('⚠️  Missing Supabase credentials - building without social cards');
  console.log('   SUPABASE_TOKEN:', hasSupabaseToken ? '✅ Set' : '❌ Missing');
  console.log('   VITE_SUPABASE_ANON_KEY:', hasAnonKey ? '✅ Set' : '❌ Missing');
  
  // Run tests, TypeScript check, and basic build
  const testBuild = spawn('npm', ['test'], {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  testBuild.on('close', (testCode) => {
    if (testCode !== 0) {
      console.error('Tests failed');
      process.exit(testCode);
    }
    
    console.log('✅ Tests passed');
    
    // Run TypeScript check
    const tscBuild = spawn('npx', ['tsc', '-b'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    tscBuild.on('close', (tscCode) => {
      if (tscCode !== 0) {
        console.error('TypeScript check failed');
        process.exit(tscCode);
      }
      
      console.log('✅ TypeScript check passed');
      
      // Run Vite build
      const viteBuild = spawn('npx', ['vite', 'build'], {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: process.env
      });
      
      viteBuild.on('close', (viteCode) => {
        console.log(`Build completed without social cards (code ${viteCode})`);
        if (viteCode === 0) {
          console.log('🚀 Deployment ready (social cards will be generated on first access)');
        }
        process.exit(viteCode);
      });
      
      viteBuild.on('error', (error) => {
        console.error('Vite build failed:', error);
        process.exit(1);
      });
    });
    
    tscBuild.on('error', (error) => {
      console.error('TypeScript check failed:', error);
      process.exit(1);
    });
  });
  
  testBuild.on('error', (error) => {
    console.error('Tests failed:', error);
    process.exit(1);
  });
}