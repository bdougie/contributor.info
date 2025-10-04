# Documentation Images Execution Plan

**Status**: OBSOLETE - Documentation migrated to Mintlify (see feat/mintlify-docs-406)

## Overview
~~This plan addresses the need to add visual content to all 16 user documentation files in `/public/docs/`. Currently, these files contain no images, making it difficult for users to understand features visually.~~

**UPDATE**: The in-app documentation at `/public/docs/` has been migrated to Mintlify. This execution plan is no longer applicable. For adding images to the new documentation, see Mintlify's image documentation: https://mintlify.com/docs/content/images

## Scripts Created

### 1. `scripts/capture-documentation-screenshots.js`
- **Purpose**: Captures 30+ screenshots covering all features
- **Output**: Saves images to `/public/docs/images/`
- **Categories**:
  - Features (10 types)
  - Insights (4 types)
  - Guides (1 type)
  - Mobile views

### 2. `scripts/update-docs-with-images.js`
- **Purpose**: Automatically inserts image references into markdown files
- **Logic**: Finds specific headers and adds images after them
- **Safety**: Checks for existing images to avoid duplicates

## Execution Steps

### Step 1: Prepare Environment
```bash
# Ensure the app is running locally
npm run dev

# Or use production URL by updating the script URLs
```

### Step 2: Capture Screenshots
```bash
# Make the script executable
chmod +x scripts/capture-documentation-screenshots.js

# Run the screenshot capture
node scripts/capture-documentation-screenshots.js
```

Expected output:
- 30+ screenshots saved to `/public/docs/images/`
- Organized in folders: `features/`, `insights/`, `guides/`, `mobile/`

### Step 3: Update Documentation
```bash
# Make the script executable
chmod +x scripts/update-docs-with-images.js

# Update all markdown files with images
node scripts/update-docs-with-images.js
```

Expected changes:
- 16 documentation files updated
- 2-3 images added per feature doc
- 1-2 images added per insight doc

### Step 4: Verify Results
1. Check that images exist in `/public/docs/images/`
2. Review each markdown file for proper image placement
3. Test image loading in the browser
4. Commit changes

## Image Specifications

### Technical Requirements
- **Resolution**: 1440x900 (Retina 2x)
- **Format**: PNG (convert to WebP later for optimization)
- **Size**: Target <200KB per image after optimization
- **Viewport**: Desktop (1440x900) and Mobile (375x812)

### Visual Standards
- Light mode browser theme
- Real repository data (React, VSCode, etc.)
- Populated UI states
- Clear, focused screenshots

## File Organization
```
public/
  docs/
    images/
      features/
        repository-search/
        contribution-analytics/
        repository-health/
        distribution-charts/
        contributor-profiles/
        activity-feed/
        contributor-of-month/
        time-range-analysis/
        authentication/
        social-cards/
      insights/
        needs-attention/
        pr-activity/
        recommendations/
        repository-health/
      guides/
        contributor-confidence/
      mobile/
```

## Troubleshooting

### If screenshots fail:
1. Check if the app is running on the expected URL
2. Verify selectors haven't changed
3. Increase timeout values
4. Run with `headless: false` to debug

### If image updates fail:
1. Verify markdown headers match exactly
2. Check file permissions
3. Review console output for specific errors

## Next Steps After Execution

1. **Optimize Images**:
   ```bash
   # Install imagemin tools
   npm install -g imagemin-cli imagemin-webp
   
   # Convert to WebP
   imagemin public/docs/images/**/*.png --plugin=webp --out-dir=public/docs/images
   ```

2. **Update Image References**:
   - Change `.png` to `.webp` in markdown files
   - Add fallback images for older browsers

3. **Add Alt Text**:
   - Review generated alt text
   - Improve descriptions for accessibility

4. **Test Across Devices**:
   - Desktop browsers
   - Mobile devices
   - Different screen sizes

## Success Criteria
- ✅ All 16 documentation files have relevant images
- ✅ Images load correctly in browser
- ✅ Mobile views are properly documented
- ✅ No broken image links
- ✅ Consistent visual style maintained

## Commit Message
```
feat: add comprehensive visual documentation

- Added 30+ screenshots covering all features
- Updated 16 documentation files with images
- Organized images in structured folders
- Included mobile view examples
- Enhanced user understanding with visual aids

Implements #230
```