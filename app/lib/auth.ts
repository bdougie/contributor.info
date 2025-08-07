import { App } from '@octokit/app';
import { Octokit } from '@octokit/rest';
import jwt from 'jsonwebtoken';
import { ENV_CONFIG } from '../config/app';

/**
 * GitHub App authentication manager
 * Handles JWT generation and installation token management
 */
export class GitHubAppAuth {
  private app: App | null = null;
  private installationTokens: Map<number, { token: string; expiresAt: Date }> = new Map();
  private isConfigured: boolean = false;

  constructor() {
    // Check if we have the required configuration
    if (!ENV_CONFIG.app_id || !ENV_CONFIG.private_key) {
      console.error('GitHub App configuration missing:', {
        hasAppId: !!ENV_CONFIG.app_id,
        hasPrivateKey: !!ENV_CONFIG.private_key,
        privateKeyLength: ENV_CONFIG.private_key?.length || 0,
      });
      this.isConfigured = false;
      return;
    }

    try {
      this.app = new App({
        appId: ENV_CONFIG.app_id,
        privateKey: ENV_CONFIG.private_key,
        webhooks: {
          secret: ENV_CONFIG.webhook_secret,
        },
      });
      this.isConfigured = true;
      console.log('GitHub App auth configured successfully');
    } catch (error) {
      console.error('Failed to initialize GitHub App:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Check if the auth is properly configured
   */
  isReady(): boolean {
    return this.isConfigured && this.app !== null;
  }

  /**
   * Generate a JWT token for app authentication
   */
  generateJWT(): string {
    if (!this.isReady()) {
      throw new Error('GitHub App not configured - cannot generate JWT');
    }
    
    const payload = {
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600, // 10 minutes
      iss: ENV_CONFIG.app_id,
    };

    return jwt.sign(payload, ENV_CONFIG.private_key, { algorithm: 'RS256' });
  }

  /**
   * Get or create an installation token
   */
  async getInstallationToken(installationId: number): Promise<string> {
    if (!this.isReady()) {
      throw new Error('GitHub App not configured - cannot get installation token');
    }
    
    // Check cache first
    const cached = this.installationTokens.get(installationId);
    if (cached && cached.expiresAt > new Date()) {
      return cached.token;
    }

    // Generate new token
    const octokit = new Octokit({
      auth: this.generateJWT(),
    });

    const { data } = await octokit.apps.createInstallationAccessToken({
      installation_id: installationId,
    });

    // Cache for 1 hour (GitHub tokens expire in 1 hour)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    
    this.installationTokens.set(installationId, {
      token: data.token,
      expiresAt,
    });

    return data.token;
  }

  /**
   * Get Octokit instance for an installation
   */
  async getInstallationOctokit(installationId: number): Promise<Octokit> {
    const token = await this.getInstallationToken(installationId);
    
    return new Octokit({
      auth: token,
    });
  }

  /**
   * Get Octokit instance for app authentication (not installation)
   */
  getAppOctokit(): Octokit {
    return new Octokit({
      auth: this.generateJWT(),
    });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    return this.app.webhooks.verify(payload, signature);
  }

  /**
   * List all installations for the app
   */
  async listInstallations() {
    const octokit = this.getAppOctokit();
    const { data } = await octokit.apps.listInstallations();
    return data;
  }

  /**
   * Get installation details
   */
  async getInstallation(installationId: number) {
    const octokit = this.getAppOctokit();
    const { data } = await octokit.apps.getInstallation({
      installation_id: installationId,
    });
    return data;
  }

  /**
   * List repositories for an installation
   */
  async listInstallationRepos(installationId: number) {
    const octokit = await this.getInstallationOctokit(installationId);
    const { data } = await octokit.apps.listReposAccessibleToInstallation();
    return data.repositories;
  }

  /**
   * Clear token cache for an installation
   */
  clearInstallationToken(installationId: number) {
    this.installationTokens.delete(installationId);
  }

  /**
   * Clear all cached tokens
   */
  clearAllTokens() {
    this.installationTokens.clear();
  }
}

// Export singleton instance
export const githubAppAuth = new GitHubAppAuth();