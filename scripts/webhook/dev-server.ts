#!/usr/bin/env tsx
/**
 * Development server with ngrok integration
 * Automatically starts webhook server and creates ngrok tunnel
 */

import { spawn, type ChildProcess } from 'child_process';
import { config as loadEnv } from 'dotenv';

loadEnv();

interface NgrokTunnel {
  url: string;
  process: ChildProcess;
}

/**
 * Start ngrok tunnel
 */
async function startNgrok(port: number): Promise<NgrokTunnel> {
  console.log('🌐 Starting ngrok tunnel...');

  const ngrokProcess = spawn('ngrok', ['http', port.toString(), '--log=stdout'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ngrokProcess.kill();
      reject(new Error('Timeout waiting for ngrok to start'));
    }, 30000);

    let output = '';

    ngrokProcess.stdout?.on('data', (data: Buffer) => {
      output += data.toString();

      // Look for the public URL in ngrok output
      const urlMatch = output.match(/url=(https:\/\/[^\s]+)/);
      if (urlMatch) {
        clearTimeout(timeout);
        const url = urlMatch[1];
        console.log(`✅ ngrok tunnel established: ${url}`);
        resolve({ url, process: ngrokProcess });
      }
    });

    ngrokProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`ngrok error: ${data.toString()}`);
    });

    ngrokProcess.on('error', (error: Error) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start ngrok: ${error.message}`));
    });

    ngrokProcess.on('exit', (code: number | null) => {
      if (code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`ngrok exited with code ${code}`));
      }
    });
  });
}

/**
 * Start webhook server
 */
function startWebhookServer(): ChildProcess {
  console.log('🚀 Starting webhook server...');

  const serverProcess = spawn('tsx', ['server/webhook-server.ts'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DEBUG_MODE: 'true',
    },
  });

  serverProcess.on('error', (error: Error) => {
    console.error(`Failed to start webhook server: ${error.message}`);
    process.exit(1);
  });

  return serverProcess;
}

/**
 * Main entry point
 */
async function main() {
  console.log('🔧 Continue Review Webhook - Development Mode');
  console.log('');

  const port = parseInt(process.env.PORT || '3000', 10);

  // Check for required environment variables
  const required = [
    'GITHUB_APP_ID',
    'GITHUB_APP_PRIVATE_KEY',
    'GITHUB_WEBHOOK_SECRET',
    'CONTINUE_API_KEY',
  ];

  const missing = required.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((v) => console.error(`   - ${v}`));
    console.error('');
    console.error('Please set these variables in your .env file');
    process.exit(1);
  }

  let ngrokTunnel: NgrokTunnel | undefined;
  let serverProcess: ChildProcess | undefined;

  try {
    // Start webhook server first
    serverProcess = startWebhookServer();

    // Wait for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Start ngrok tunnel
    ngrokTunnel = await startNgrok(port);

    console.log('');
    console.log('🎉 Development environment ready!');
    console.log('');
    console.log('📍 Local server: http://localhost:' + port);
    console.log('🌐 Public URL: ' + ngrokTunnel.url);
    console.log('');
    console.log('🔧 Next steps:');
    console.log('1. Configure your GitHub App webhook URL:');
    console.log(`   ${ngrokTunnel.url}/webhook`);
    console.log('2. Install the app on a repository');
    console.log('3. Open a PR or comment with @continue-agent');
    console.log('');
    console.log('💡 Tip: Use the /webhook/test endpoint for manual testing');
    console.log('');
    console.log('Press Ctrl+C to stop');
  } catch (error) {
    console.error('❌ Failed to start development environment:', error);

    if (ngrokTunnel) {
      ngrokTunnel.process.kill();
    }
    if (serverProcess) {
      serverProcess.kill();
    }

    process.exit(1);
  }

  // Handle graceful shutdown
  const cleanup = () => {
    console.log('');
    console.log('⚠️  Shutting down...');

    if (ngrokTunnel) {
      console.log('🌐 Stopping ngrok...');
      ngrokTunnel.process.kill();
    }

    if (serverProcess) {
      console.log('🚀 Stopping webhook server...');
      serverProcess.kill();
    }

    console.log('👋 Goodbye!');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
