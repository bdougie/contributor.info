# Contributor.info Documentation

This directory contains the Mintlify-hosted documentation for Contributor.info.

## Structure

```
mintlify-docs/
├── docs.json           # Mintlify configuration
├── introduction.mdx    # Home page
├── features/           # Feature documentation
│   ├── lottery-factor.mdx
│   ├── activity-feed.mdx
│   ├── authentication.mdx
│   ├── contributor-confidence.mdx
│   ├── contribution-analytics.mdx
│   ├── contributor-of-month.mdx
│   ├── hover-cards.mdx
│   ├── distribution-charts.mdx
│   ├── repository-health.mdx
│   ├── repository-search.mdx
│   └── github-app-setup.mdx
└── insights/           # Insights documentation
    ├── pr-activity.mdx
    ├── repository-health.mdx
    ├── needs-attention.mdx
    └── recommendations.mdx
```

## Setup

### Prerequisites

1. Install Mintlify CLI:
   ```bash
   npm i -g mintlify
   ```

2. Sign up for Mintlify account at [mintlify.com](https://mintlify.com)

### Local Development

Run the documentation locally:

```bash
cd mintlify-docs
mintlify dev
```

This will start a local server at `http://localhost:3000`

### Deployment

#### Option 1: Mintlify Cloud (Recommended)

1. Connect your GitHub repository to Mintlify
2. Select the `mintlify-docs` directory as the docs root
3. Deploy automatically on push to main branch

#### Option 2: Self-hosted

Deploy using Mintlify's Docker container:

```bash
docker run -p 3000:3000 -v $(pwd)/mintlify-docs:/docs mintlify/mintlify
```

## Configuration

The `docs.json` file contains all configuration:

- **Navigation**: Organized into Features and Insights sections
- **Branding**: Custom colors matching Contributor.info theme
- **Analytics**: PostHog integration for docs analytics
- **Social Links**: GitHub, Twitter, Discord

## Migration from Main App

This documentation was migrated from the main Contributor.info app to:

1. **Reduce bundle size**: Remove ~500KB-1MB from main app
2. **Improve performance**: Separate hosting on Mintlify's CDN
3. **Better features**: Built-in search, AI assistant, and analytics
4. **Easier maintenance**: Git-based workflow for docs

### What was removed from main app:

- `/src/components/features/docs/docs-list.tsx`
- `/src/components/features/docs/doc-detail.tsx`
- `/src/components/features/docs/docs-loader.ts`
- `/public/docs/*.md` files
- Docs routes from App.tsx
- Netlify function for docs-content

### Expected Savings:

- **Bundle size**: -500KB to -1MB
- **Deployment**: Faster builds
- **Performance**: Better docs loading with CDN

## Customization

### Adding New Docs

1. Create a new `.mdx` file in the appropriate directory
2. Add frontmatter:
   ```mdx
   ---
   title: 'Your Title'
   description: 'Your description'
   ---
   ```
3. Update `docs.json` navigation to include the new page

### Updating Navigation

Edit `docs.json`:

```json
{
  "navigation": {
    "anchors": [
      {
        "anchor": "Section Name",
        "icon": "icon-name",
        "pages": [
          "path/to/page"
        ]
      }
    ]
  }
}
```

### Custom Components

Mintlify supports custom MDX components:

```mdx
<Card title="Title" icon="icon">
  Content
</Card>

<CardGroup cols={2}>
  <Card>...</Card>
  <Card>...</Card>
</CardGroup>
```

## Resources

- [Mintlify Documentation](https://mintlify.com/docs)
- [Mintlify CLI](https://www.npmjs.com/package/mintlify)
- [MDX Components](https://mintlify.com/docs/components)
- [Analytics Integration](https://mintlify.com/docs/analytics)

## Support

- GitHub: [contributor.info issues](https://github.com/bdougie/contributor.info/issues)
- Discord: [Join our community](https://discord.gg/gZMKK5q)
