import express from 'express';
import crypto from 'crypto';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { App } from '@octokit/app';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.raw({ type: 'application/json', limit: '10mb' }));

// Environment validation
const requiredEnvVars = [
  'GITHUB_APP_ID',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_APP_WEBHOOK_SECRET',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

// Initialize GitHub App
let githubApp;
try {
  githubApp = new App({
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
    webhooks: {
      secret: process.env.GITHUB_APP_WEBHOOK_SECRET
    }
  });
  console.log('✅ GitHub App initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize GitHub App:', error);
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Import webhook handlers
import { handlePullRequestEvent } from './handlers/pull-request.js';
import { handlePROpenedDirect } from './handlers/pull-request-direct.js';
import { handleIssuesEvent } from './handlers/issues.js';
import { handleIssueOpenedDirect } from './handlers/issues-direct.js';
import { handleIssueCommentEvent } from './handlers/issue-comment.js';
import { handleInstallationEvent } from './handlers/installation.js';
import { handleLabeledEvent } from './handlers/labeled.js';

// Metrics tracking
const metrics = {
  webhooksReceived: 0,
  webhooksProcessed: 0,
  webhooksFailed: 0,
  processingTime: [],
  startTime: new Date()
};

// Health check endpoint
app.get('/health', (req, res) => {
  const uptime = Math.floor((new Date() - metrics.startTime) / 1000);
  res.json({
    status: 'healthy',
    uptime: `${uptime}s`,
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString()
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const avgProcessingTime = metrics.processingTime.length > 0
    ? metrics.processingTime.reduce((a, b) => a + b, 0) / metrics.processingTime.length
    : 0;

  res.json({
    webhooks: {
      received: metrics.webhooksReceived,
      processed: metrics.webhooksProcessed,
      failed: metrics.webhooksFailed,
      successRate: metrics.webhooksReceived > 0 
        ? ((metrics.webhooksProcessed / metrics.webhooksReceived) * 100).toFixed(2) + '%'
        : 'N/A'
    },
    performance: {
      averageProcessingTime: `${avgProcessingTime.toFixed(2)}ms`,
      totalProcessingTime: `${metrics.processingTime.reduce((a, b) => a + b, 0)}ms`,
      samples: metrics.processingTime.length
    },
    uptime: `${Math.floor((new Date() - metrics.startTime) / 1000)}s`,
    lastUpdated: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'GitHub Webhook Handler',
    status: 'operational',
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      webhook: '/webhook'
    },
    version: '1.0.0'
  });
});

// GitHub webhook endpoint
app.post('/webhook', async (req, res) => {
  const startTime = Date.now();
  metrics.webhooksReceived++;

  try {
    // Get headers
    const signature = req.headers['x-hub-signature-256'];
    const eventType = req.headers['x-github-event'];
    const deliveryId = req.headers['x-github-delivery'];

    console.log(`📨 Webhook received: ${eventType} (${deliveryId})`);

    // Verify signature
    if (!verifyWebhookSignature(req.body, signature, process.env.GITHUB_APP_WEBHOOK_SECRET)) {
      console.error('❌ Invalid webhook signature');
      metrics.webhooksFailed++;
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse payload
    const payload = JSON.parse(req.body.toString());

    // Log webhook details
    console.log({
      event: eventType,
      delivery: deliveryId,
      repository: payload.repository?.full_name || 'unknown',
      action: payload.action,
      installation: payload.installation?.id
    });

    // Process webhook based on event type
    try {
      switch (eventType) {
        case 'ping':
          console.log('🏓 GitHub App ping received');
          break;

        case 'installation':
          console.log(`🔧 Installation ${payload.action}:`, payload.installation?.account?.login);
          await handleInstallationEvent(payload, githubApp, supabase);
          break;

        case 'pull_request':
          console.log(`🔀 PR ${payload.action}: #${payload.pull_request?.number}`);
          if (payload.action === 'opened') {
            await handlePROpenedDirect(payload, githubApp, supabase);
          } else if (payload.action === 'labeled') {
            await handleLabeledEvent(payload, githubApp, supabase);
          } else {
            await handlePullRequestEvent(payload, githubApp, supabase);
          }
          break;

        case 'issues':
          console.log(`📝 Issue ${payload.action}: #${payload.issue?.number}`);
          if (payload.action === 'opened') {
            await handleIssueOpenedDirect(payload, githubApp, supabase);
          } else if (payload.action === 'labeled') {
            await handleLabeledEvent(payload, githubApp, supabase);
          } else {
            await handleIssuesEvent(payload, githubApp, supabase);
          }
          break;

        case 'issue_comment':
          console.log(`💬 Issue comment ${payload.action} on #${payload.issue?.number}`);
          await handleIssueCommentEvent(payload, githubApp, supabase);
          break;

        default:
          console.log(`⚠️ Unhandled event type: ${eventType}`);
      }

      metrics.webhooksProcessed++;
    } catch (processingError) {
      console.error('❌ Error processing webhook:', processingError);
      metrics.webhooksFailed++;
      // Don't throw - we still want to return 200 to GitHub
    }

    // Track processing time
    const processingTime = Date.now() - startTime;
    metrics.processingTime.push(processingTime);
    if (metrics.processingTime.length > 100) {
      metrics.processingTime.shift(); // Keep only last 100 samples
    }

    console.log(`✅ Webhook processed in ${processingTime}ms`);

    // Always return 200 to prevent GitHub retries
    res.status(200).json({
      message: 'Webhook received',
      event: eventType,
      delivery: deliveryId,
      processingTime: `${processingTime}ms`
    });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    metrics.webhooksFailed++;
    
    // Still return 200 to prevent GitHub retries
    res.status(200).json({
      message: 'Webhook received with errors',
      error: error.message
    });
  }
});

// Verify webhook signature
function verifyWebhookSignature(payload, signature, secret) {
  if (!signature || !secret) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', secret);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;

  // Use timingSafeEqual to prevent timing attacks
  if (signature.length !== digest.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 GitHub Webhook Handler running on port ${PORT}`);
  console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
  console.log(`🏥 Health check at http://localhost:${PORT}/health`);
});