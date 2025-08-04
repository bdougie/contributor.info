# Asset Generation Scripts

Tools for creating and optimizing visual assets including social cards, PWA icons, and app screenshots.

## 🎨 Overview

Asset scripts handle:
- Social media card generation
- PWA icon creation in multiple sizes
- App store screenshot generation
- Image optimization and conversion

## 🖼️ Scripts

| Script | Purpose | Output |
|--------|---------|--------|
| `generate-social-cards.js` | Create Open Graph/Twitter cards | 1200x630px social images |
| `generate-pwa-icons.js` | Generate PWA manifest icons | Multiple sizes (192px-512px) |
| `generate-pwa-screenshots.js` | Create app store screenshots | Device-specific screenshots |
| `convert-images.js` | Convert and optimize images | WebP, AVIF formats |
| `build-with-social-cards.js` | Build with social card generation | Integrated build process |

## 💡 Usage Examples

### Social Media Cards
```bash
# Generate cards for all repositories
node scripts/assets/generate-social-cards.js

# Generate for specific repository
node scripts/assets/generate-social-cards.js --repo pytorch/pytorch

# Regenerate all cards
node scripts/assets/generate-social-cards.js --force
```

### PWA Assets
```bash
# Generate all PWA icons
node scripts/assets/generate-pwa-icons.js

# Generate app screenshots
node scripts/assets/generate-pwa-screenshots.js --device all
```

### Image Optimization
```bash
# Convert images to modern formats
node scripts/assets/convert-images.js --format webp

# Optimize all images
node scripts/assets/convert-images.js --quality 85
```

## 📐 Asset Specifications

### Social Cards
- **Size**: 1200x630px
- **Format**: PNG/JPG
- **Elements**: Repo stats, contributor info, branding

### PWA Icons
- **Sizes**: 192x192, 384x384, 512x512
- **Format**: PNG with transparency
- **Purpose**: App manifest, home screen

### Screenshots
- **Devices**: iPhone, iPad, Android
- **Orientation**: Portrait and landscape
- **Format**: PNG/JPG

## 🎯 Design Guidelines

### Social Cards
```javascript
{
  background: "gradient or brand color",
  logo: "top-left corner",
  stats: "prominently displayed",
  typography: "Inter font family"
}
```

### Color Palette
- Primary: `#6366F1`
- Secondary: `#8B5CF6`
- Background: `#0F172A`
- Text: `#F8FAFC`

## 🔧 Configuration

### Card Templates
```javascript
// config/social-cards.js
export default {
  template: "default",
  includeStats: true,
  includeContributors: true,
  gradientColors: ["#6366F1", "#8B5CF6"]
}
```

### Icon Sizes
```javascript
// config/pwa-icons.js
export default {
  sizes: [192, 384, 512],
  padding: 0.1, // 10% padding
  background: "transparent"
}
```

## 🚀 Automation

### Scheduled Regeneration
```bash
# Regenerate stale cards (>30 days)
node scripts/assets/generate-social-cards.js --stale-only
```

### Build Integration
```json
{
  "scripts": {
    "build": "npm run build:app && npm run build:social-cards"
  }
}
```

## 📦 Storage

### Supabase Storage
- Bucket: `social-cards`
- Path: `/repos/{owner}/{name}/card.png`
- CDN: Automatic edge caching

### Local Development
- Output: `/public/social-cards/`
- Git ignored for size

## 🔄 Caching

### CDN Strategy
- Cache Duration: 7 days
- Invalidation: On data update
- Fallback: Generic card

### Generation
- Skip unchanged: Compare data hash
- Force regenerate: `--force` flag
- Batch processing: 10 cards/second

## ⚡ Performance

### Optimization Tips
1. Use WebP for modern browsers
2. Lazy load non-critical images
3. Implement responsive images
4. Enable CDN compression

### Image Sizes
- Social cards: ~50-80KB
- PWA icons: ~5-20KB each
- Screenshots: ~100-200KB

## 🆘 Troubleshooting

### "Card generation failed"
- Check Playwright installation
- Verify template file exists
- Ensure sufficient memory

### "Images too large"
- Reduce quality setting
- Use WebP format
- Enable compression

### "Storage upload failed"
- Check Supabase credentials
- Verify bucket permissions
- Check storage quota

## 📚 Related Documentation

- [Social Card Templates](./fix-social-cards-setup.md)
- [PWA Manifest Spec](https://web.dev/add-manifest/)
- [Open Graph Protocol](https://ogp.me/)