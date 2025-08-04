# Setup Scripts

Configuration and initialization scripts for setting up the contributor.info platform infrastructure.

## 🔧 Overview

Setup scripts handle:
- Infrastructure initialization
- Security configuration
- Storage setup
- Authentication keys

## 🛠️ Scripts

| Script | Purpose | When to Run |
|--------|---------|-------------|
| `setup-supabase-storage.js` | Configure storage buckets | Initial deployment |
| `setup-card-regeneration.js` | Initialize social card system | Feature setup |
| `setup-chromatic-baselines.sh` | Setup visual testing | CI/CD configuration |
| `encode-private-key.js` | Encode GitHub App keys | Security setup |
| `prepare-private-key.sh` | Prepare keys for deployment | Pre-deployment |
| `split-private-key.sh` | Split keys for security | Key management |
| `upload-private-key.sh` | Upload keys to secure storage | Deployment |

## 💡 Usage Examples

### Initial Platform Setup
```bash
# 1. Setup Supabase storage
node scripts/setup/setup-supabase-storage.js

# 2. Configure social cards
node scripts/setup/setup-card-regeneration.js

# 3. Setup visual testing
./scripts/setup/setup-chromatic-baselines.sh
```

### GitHub App Configuration
```bash
# Encode private key
node scripts/setup/encode-private-key.js --key-path ./private-key.pem

# Prepare for deployment
./scripts/setup/prepare-private-key.sh

# Split for security (if needed)
./scripts/setup/split-private-key.sh
```

## 🔐 Security Setup

### GitHub App Keys
1. Download private key from GitHub App settings
2. Encode using `encode-private-key.js`
3. Store securely in environment variables

### Environment Variables
```bash
# Required for setup
GITHUB_APP_ID=your-app-id
GITHUB_PRIVATE_KEY=encoded-private-key
SUPABASE_SERVICE_KEY=your-service-key
```

## 📦 Storage Configuration

### Supabase Buckets
```javascript
{
  buckets: [
    {
      name: "social-cards",
      public: true,
      allowedMimeTypes: ["image/png", "image/jpeg"]
    },
    {
      name: "app-assets",
      public: true,
      allowedMimeTypes: ["image/*"]
    }
  ]
}
```

### Storage Policies
- Public read access for assets
- Authenticated write access
- Size limits: 5MB per file

## 🎨 Visual Testing Setup

### Chromatic Configuration
```bash
# Initial setup
CHROMATIC_PROJECT_TOKEN=your-token \
  ./scripts/setup/setup-chromatic-baselines.sh

# Update baselines
npm run chromatic:update
```

## 🔑 Key Management

### Private Key Encoding
```javascript
// Original PEM format
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----

// Encoded format (single line)
LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlFcEFJQkFBS0NBUUVB...
```

### Split Key Strategy
For enhanced security:
1. Split key into multiple parts
2. Store parts in different locations
3. Reconstruct during deployment

## 🚀 Deployment Checklist

### Pre-deployment
- [ ] All environment variables set
- [ ] Storage buckets created
- [ ] Private keys encoded
- [ ] Visual baselines established

### Post-deployment
- [ ] Verify storage access
- [ ] Test authentication
- [ ] Check visual regression
- [ ] Monitor error logs

## ⚙️ Configuration Files

### Storage Config
```javascript
// config/storage.js
export default {
  provider: "supabase",
  buckets: ["social-cards", "app-assets"],
  cdn: {
    enabled: true,
    ttl: 3600
  }
}
```

### Security Config
```javascript
// config/security.js
export default {
  github: {
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_PRIVATE_KEY
  }
}
```

## 🔄 Maintenance

### Regular Tasks
1. **Rotate Keys**: Every 90 days
2. **Review Permissions**: Monthly
3. **Update Baselines**: After UI changes
4. **Clean Storage**: Remove old assets

### Health Checks
```bash
# Verify storage
node scripts/health-checks/check-bucket-status.js

# Test authentication
node scripts/testing-tools/test-github-auth.mjs
```

## 🆘 Troubleshooting

### "Storage setup failed"
- Verify Supabase credentials
- Check service role permissions
- Ensure buckets don't exist

### "Key encoding error"
- Verify PEM file format
- Check file permissions
- Use absolute paths

### "Chromatic setup failed"
- Install dependencies first
- Check project token
- Verify network access

## 📚 Best Practices

1. **Security First**: Never commit keys
2. **Test Locally**: Verify setup before production
3. **Document Changes**: Update configs
4. **Backup Keys**: Store securely offline
5. **Monitor Usage**: Check quotas regularly