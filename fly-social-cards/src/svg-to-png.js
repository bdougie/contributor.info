/**
 * SVG to PNG conversion utility
 * Converts social card SVGs to PNG format for social media compatibility
 * 
 * Social media platforms (Twitter, Facebook, LinkedIn, Discord) require
 * raster image formats (PNG/JPEG) and do not support SVG for og:image tags.
 */

import sharp from 'sharp';

/**
 * Convert SVG string to PNG buffer
 * @param {string} svgString - The SVG content as a string
 * @param {object} options - Conversion options
 * @param {number} options.width - Output width in pixels (default: 1200)
 * @param {number} options.height - Output height in pixels (default: 630)
 * @param {number} options.quality - PNG compression quality 0-100 (default: 90)
 * @returns {Promise<Buffer>} PNG image buffer
 */
export async function svgToPng(svgString, options = {}) {
  const { width = 1200, height = 630, quality = 90 } = options;

  try {
    // Convert SVG to PNG using sharp
    const pngBuffer = await sharp(Buffer.from(svgString))
      .resize(width, height, {
        fit: 'contain',
        background: { r: 10, g: 10, b: 10, alpha: 1 }, // Match dark theme background
      })
      .png({
        quality,
        compressionLevel: 9,
        palette: true, // Use palette for smaller file size
      })
      .toBuffer();

    return pngBuffer;
  } catch (error) {
    console.error('SVG to PNG conversion error:', error);
    throw new Error(`Failed to convert SVG to PNG: ${error.message}`);
  }
}

/**
 * Convert SVG string to JPEG buffer
 * @param {string} svgString - The SVG content as a string
 * @param {object} options - Conversion options
 * @param {number} options.width - Output width in pixels (default: 1200)
 * @param {number} options.height - Output height in pixels (default: 630)
 * @param {number} options.quality - JPEG quality 0-100 (default: 85)
 * @returns {Promise<Buffer>} JPEG image buffer
 */
export async function svgToJpeg(svgString, options = {}) {
  const { width = 1200, height = 630, quality = 85 } = options;

  try {
    // Convert SVG to JPEG using sharp
    const jpegBuffer = await sharp(Buffer.from(svgString))
      .resize(width, height, {
        fit: 'contain',
        background: { r: 10, g: 10, b: 10, alpha: 1 }, // Match dark theme background
      })
      .jpeg({
        quality,
        progressive: true,
        mozjpeg: true, // Use mozjpeg for better compression
      })
      .toBuffer();

    return jpegBuffer;
  } catch (error) {
    console.error('SVG to JPEG conversion error:', error);
    throw new Error(`Failed to convert SVG to JPEG: ${error.message}`);
  }
}

/**
 * Get the appropriate converter function based on format
 * @param {string} format - The desired output format ('png', 'jpeg', or 'svg')
 * @returns {Function|null} Converter function or null for SVG
 */
export function getConverter(format) {
  switch (format.toLowerCase()) {
    case 'png':
      return svgToPng;
    case 'jpeg':
    case 'jpg':
      return svgToJpeg;
    case 'svg':
      return null; // No conversion needed
    default:
      return svgToPng; // Default to PNG
  }
}
