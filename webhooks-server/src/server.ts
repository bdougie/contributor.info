import express from 'express';
import crypto from 'crypto';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import consolidated webhook handlers from app/webhooks
import { handleIssuesEvent } from '../../app/webhooks/issues.js';
import { handlePullRequestEvent } from '../../app/webhooks/pull-request.js';

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
app.use(express.json({ limit: '10mb' }));
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
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'GITHUB_APP_WEBHOOK_SECRET'];

// Check for GitHub App credentials
const hasGitHubCreds =
  (process.env.CONTRIBUTOR_APP_ID || process.env.GITHUB_APP_ID) &&
  (process.env.CONTRIBUTOR_APP_KEY || process.env.GITHUB_APP_PRIVATE_KEY);

if (!hasGitHubCreds) {
  console.error('❌ Missing GitHub App credentials');
  process.exit(1);
}

const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

// Metrics tracking
const metrics = {
  webhooksReceived: 0,
  webhooksProcessed: 0,
  webhooksFailed: 0,
  uptime: Date.now(),
};

/**
 * Verify GitHub webhook signature
 */
function verifyWebhookSignature(payload: Buffer, signature: string | undefined): boolean {
  if (!signature) return false;

  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET!;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const digest = `sha256=${hmac.digest('hex')}`;

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

/**
 * Main webhook endpoint
 */
app.post('/webhook', webhookLimiter, async (req, res) => {
  metrics.webhooksReceived++;

  try {
    // Verify webhook signature
    const signature = req.headers['x-hub-signature-256'] as string;
    const payload = req.body;

    if (!verifyWebhookSignature(payload, signature)) {
      console.error('❌ Invalid webhook signature');
      metrics.webhooksFailed++;
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse payload
    const event = JSON.parse(payload.toString());
    const eventType = req.headers['x-github-event'] as string;
    const deliveryId = req.headers['x-github-delivery'] as string;

    console.log('📥 Webhook received: %s (ID: %s)', eventType, deliveryId);

    // Route to appropriate handler
    let result;
    switch (eventType) {
      case 'pull_request':
        result = await handlePullRequestEvent(event);
        // Also run Check Runs (they're called internally in pull-request.ts now)
        break;

      case 'issues':
        result = await handleIssuesEvent(event);
        break;

      default:
        console.log('ℹ️ Unhandled event type: %s', eventType);
        return res.status(200).json({
          status: 'ignored',
          message: `Event type ${eventType} not handled`,
        });
    }

    metrics.webhooksProcessed++;
    console.log('✅ Webhook processed: %s', eventType);

    res.status(200).json({
      status: 'success',
      event: eventType,
      delivery_id: deliveryId,
      result,
    });
  } catch (error) {
    metrics.webhooksFailed++;
    console.error('❌ Webhook processing error:', error);

    res.status(500).json({
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);

  res.json({
    status: 'healthy',
    version: VERSION,
    uptime: `${uptime}s`,
    supabase: process.env.SUPABASE_URL ? 'configured' : 'missing',
    github_app: hasGitHubCreds ? 'configured' : 'missing',
  });
});

/**
 * Metrics endpoint
 */
app.get('/metrics', (req, res) => {
  const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);

  res.json({
    ...metrics,
    uptime: `${uptime}s`,
    success_rate:
      metrics.webhooksReceived > 0
        ? `${((metrics.webhooksProcessed / metrics.webhooksReceived) * 100).toFixed(2)}%`
        : '0%',
  });
});

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    service: 'contributor.info webhook handler',
    version: VERSION,
    status: 'running',
    endpoints: {
      webhook: 'POST /webhook',
      health: 'GET /health',
      metrics: 'GET /metrics',
    },
  });
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log('🚀 Webhook server started');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🔢 Version: ${VERSION}`);
  console.log(`🔗 Supabase: ${process.env.SUPABASE_URL?.substring(0, 30)}...`);
  console.log(
    `✅ GitHub App configured with ID: ${process.env.CONTRIBUTOR_APP_ID || process.env.GITHUB_APP_ID}`
  );
  console.log('');
  console.log('📊 Endpoints:');
  console.log('  POST /webhook - GitHub webhook handler');
  console.log('  GET  /health  - Health check');
  console.log('  GET  /metrics - Performance metrics');
  console.log('');
  console.log('🎯 Ready to receive webhooks!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully...');
  process.exit(0);
});
