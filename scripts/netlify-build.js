import { spawn } from 'child_process';

console.log('Netlify build starting...');

// Social card generation has been moved to GitHub Actions
console.log('📦 Running optimized build without social card generation');
console.log('🎨 Social cards will be generated via GitHub Actions');

// Run the standard build command
const build = spawn('npm', ['run', 'build'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: process.env
});

build.on('close', (code) => {
  console.log(`Build completed with code ${code}`);
  if (code === 0) {
    console.log('🚀 Deployment ready!');
  }
  process.exit(code);
});

build.on('error', (error) => {
  console.error('Build failed:', error);
  process.exit(1);
});