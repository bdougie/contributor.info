# Changelog Generation Scripts

RSS and XML feed generation for the contributor.info changelog system.

## 📰 Overview

Changelog scripts handle:
- RSS feed generation from changelog data
- XML feed formatting and validation
- Feed distribution and updates
- Changelog syndication

## 📄 Scripts

| Script | Purpose | Output |
|--------|---------|--------|
| `generate-rss.js` | Generate RSS feed from changelog data | RSS XML file |

## 💡 Usage Examples

### RSS Feed Generation
```bash
# Generate RSS feed
node scripts/changelog/generate-rss.js

# Generate with custom output path
node scripts/changelog/generate-rss.js --output /public/changelog-rss.xml

# Validate existing feed
node scripts/changelog/generate-rss.js --validate
```

## 📊 Feed Specifications

### RSS Format
- **Version**: RSS 2.0
- **Encoding**: UTF-8
- **Item Count**: Latest 20 changelog entries
- **Update Frequency**: On release

### Content Structure
```xml
<rss version="2.0">
  <channel>
    <title>Contributor.info Changelog</title>
    <description>Latest updates and improvements</description>
    <item>
      <title>Version X.Y.Z</title>
      <description>Release notes and changes</description>
      <pubDate>RFC-2822 date</pubDate>
      <guid>unique-identifier</guid>
    </item>
  </channel>
</rss>
```

## 🔄 Automation

### Build Integration
The RSS generation runs automatically during:
- Release builds (`npm run build`)
- Changelog updates
- Manual triggers

### Scheduling
```bash
# Update RSS feed after changelog changes
npm run changelog:update
```

## 🔗 Related Files

- `/public/changelog-rss.xml` - Generated RSS feed
- `/public/changelog-atom.xml` - Atom feed format
- `/CHANGELOG.md` - Source changelog data

## 📚 Best Practices

1. **Valid XML**: Ensure proper escaping and encoding
2. **Fresh Content**: Keep feeds updated with releases
3. **Consistent Format**: Maintain RSS 2.0 compliance
4. **Proper Dates**: Use RFC-2822 date formatting
5. **Unique GUIDs**: Generate unique identifiers for items