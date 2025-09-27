import express from 'express';
import crypto from 'crypto';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { App } from '@octokit/app';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from './utils/logger.js';
import { validateWebhookPayload, createSafeError } from './utils/validation.js';

// Load environment variables
dotenv.config();

// Get package version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
const VERSION = packageJson.version;

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.raw({ type: 'application/json', limit: '10mb' }));

// Rate limiting for webhook endpoint
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many webhook requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Environment validation
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];

// Check for GitHub App credentials - support both naming conventions
const hasGitHubCreds =
  (process.env.CONTRIBUTOR_APP_ID || process.env.GITHUB_APP_ID) &&
  (process.env.CONTRIBUTOR_APP_KEY || process.env.GITHUB_APP_PRIVATE_KEY) &&
  process.env.GITHUB_APP_WEBHOOK_SECRET;

if (!hasGitHubCreds) {
  requiredEnvVars.push('CONTRIBUTOR_APP_ID or GITHUB_APP_ID');
  requiredEnvVars.push('CONTRIBUTOR_APP_KEY or GITHUB_APP_PRIVATE_KEY');
  requiredEnvVars.push('GITHUB_APP_WEBHOOK_SECRET');
}

const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingEnvVars.length > 0) {
  logger.error('❌ Missing required environment variables: %s', missingEnvVars.join(', '));
  process.exit(1);
}

// Initialize GitHub App
let githubApp;
try {
  const appId = process.env.CONTRIBUTOR_APP_ID || process.env.GITHUB_APP_ID;
  const privateKey = process.env.CONTRIBUTOR_APP_KEY || process.env.GITHUB_APP_PRIVATE_KEY;

  githubApp = new App({
    appId: appId,
    privateKey: privateKey.replace(/\\n/g, '\n'),
    webhooks: {
      secret: process.env.GITHUB_APP_WEBHOOK_SECRET,
    },
  });
  logger.info('✅ GitHub App initialized successfully with App ID: %s', appId);
} catch (error) {
  logger.error('❌ Failed to initialize GitHub App: %s', error.message);
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Import webhook handlers
import { handlePullRequestEvent } from './handlers/pull-request.js';
import { handlePROpenedDirect } from './handlers/pull-request-direct.js';
import { handlePRWithReviewerSuggestions } from './handlers/pull-request-reviewer-suggestions.js';
import { handlePRCheckRuns } from './handlers/pr-check-runs.js';
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
  startTime: new Date(),
};

// Health check endpoint
app.get('/health', (req, res) => {
  const uptime = Math.floor((new Date() - metrics.startTime) / 1000);
  res.json({
    status: 'healthy',
    uptime: `${uptime}s`,
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const avgProcessingTime =
    metrics.processingTime.length > 0
      ? metrics.processingTime.reduce((a, b) => a + b, 0) / metrics.processingTime.length
      : 0;

  res.json({
    webhooks: {
      received: metrics.webhooksReceived,
      processed: metrics.webhooksProcessed,
      failed: metrics.webhooksFailed,
      successRate:
        metrics.webhooksReceived > 0
          ? ((metrics.webhooksProcessed / metrics.webhooksReceived) * 100).toFixed(2) + '%'
          : 'N/A',
    },
    performance: {
      averageProcessingTime: `${avgProcessingTime.toFixed(2)}ms`,
      totalProcessingTime: `${metrics.processingTime.reduce((a, b) => a + b, 0)}ms`,
      samples: metrics.processingTime.length,
    },
    uptime: `${Math.floor((new Date() - metrics.startTime) / 1000)}s`,
    lastUpdated: new Date().toISOString(),
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
      webhook: '/webhook',
    },
    version: VERSION,
  });
});

// GitHub webhook endpoint with rate limiting
app.post('/webhook', webhookLimiter, async (req, res) => {
  const startTime = Date.now();
  metrics.webhooksReceived++;

  try {
    // Get headers
    const signature = req.headers['x-hub-signature-256'];
    const eventType = req.headers['x-github-event'];
    const deliveryId = req.headers['x-github-delivery'];

    logger.info('📨 Webhook received: %s (%s)', eventType, deliveryId);

    // Verify signature
    if (!verifyWebhookSignature(req.body, signature, process.env.GITHUB_APP_WEBHOOK_SECRET)) {
      logger.error('❌ Invalid webhook signature');
      metrics.webhooksFailed++;
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse payload
    const payload = JSON.parse(req.body.toString());

    // Validate payload structure
    try {
      validateWebhookPayload(payload, eventType);
    } catch (validationError) {
      logger.error('Payload validation failed: %s', validationError.message);
      metrics.webhooksFailed++;
      return res.status(400).json(createSafeError(validationError, 'validation'));
    }

    // Log webhook details
    logger.webhook(
      eventType,
      deliveryId,
      payload.repository?.full_name,
      payload.action,
      payload.installation?.id
    );

    // Process webhook based on event type
    try {
      switch (eventType) {
        case 'ping':
          logger.info('🏓 GitHub App ping received');
          break;

        case 'installation':
          logger.info(
            '🔧 Installation %s: %s',
            payload.action,
            payload.installation?.account?.login
          );
          await handleInstallationEvent(payload, githubApp, supabase, logger);
          break;

        case 'pull_request':
          logger.info('🔀 PR %s: #%d', payload.action, payload.pull_request?.number);

          // Run check runs for fork PRs (similarity & performance monitoring)
          // This runs in parallel with other handlers and doesn't block
          if (['opened', 'synchronize', 'ready_for_review'].includes(payload.action)) {
            handlePRCheckRuns(payload, githubApp, supabase, logger).catch((err) =>
              logger.error('Check runs failed:', err)
            );
          }

          // Process other PR handlers
          if (payload.action === 'opened' || payload.action === 'ready_for_review') {
            // Use the new handler with reviewer suggestions
            await handlePRWithReviewerSuggestions(payload, githubApp, supabase, logger);
          } else if (payload.action === 'labeled') {
            await handleLabeledEvent(payload, githubApp, supabase, logger);
          } else {
            await handlePullRequestEvent(payload, githubApp, supabase, logger);
          }
          break;

        case 'issues':
          logger.info('📝 Issue %s: #%d', payload.action, payload.issue?.number);
          if (payload.action === 'opened') {
            await handleIssueOpenedDirect(payload, githubApp, supabase, logger);
          } else if (payload.action === 'labeled') {
            await handleLabeledEvent(payload, githubApp, supabase, logger);
          } else {
            await handleIssuesEvent(payload, githubApp, supabase, logger);
          }
          break;

        case 'issue_comment':
          logger.info('💬 Issue comment %s on #%d', payload.action, payload.issue?.number);
          await handleIssueCommentEvent(payload, githubApp, supabase, logger);
          break;

        default:
          logger.warn('⚠️ Unhandled event type: %s', eventType);
      }

      metrics.webhooksProcessed++;
    } catch (processingError) {
      logger.error('❌ Error processing webhook: %s', processingError.message);
      metrics.webhooksFailed++;
      // Don't throw - we still want to return 200 to GitHub
    }

    // Track processing time
    const processingTime = Date.now() - startTime;
    metrics.processingTime.push(processingTime);
    if (metrics.processingTime.length > 100) {
      metrics.processingTime.shift(); // Keep only last 100 samples
    }

    logger.info('✅ Webhook processed in %dms', processingTime);

    // Always return 200 to prevent GitHub retries
    res.status(200).json({
      message: 'Webhook received',
      event: eventType,
      delivery: deliveryId,
      processingTime: `${processingTime}ms`,
    });
  } catch (error) {
    logger.error('❌ Webhook error: %s', error.message);
    metrics.webhooksFailed++;

    // Still return 200 to prevent GitHub retries
    res.status(200).json({
      message: 'Webhook received with errors',
      error: error.message,
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

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Express error: %s', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info('🚀 GitHub Webhook Handler running on port %d', PORT);
  logger.info('📊 Metrics available at http://localhost:%d/metrics', PORT);
  logger.info('🏥 Health check at http://localhost:%d/health', PORT);
});
