/**
 * SVG to PNG conversion utility using sharp
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
 * @returns {Promise<Buffer>} PNG image buffer
 */
export async function svgToPng(svgString, options = {}) {
  const { width = 1200, height = 630 } = options;

  const pngBuffer = await sharp(Buffer.from(svgString))
    .resize(width, height, {
      fit: 'contain',
      background: { r: 15, g: 23, b: 42, alpha: 1 }, // slate-900 background
    })
    .png({
      compressionLevel: 6,
    })
    .toBuffer();

  return pngBuffer;
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

  const jpegBuffer = await sharp(Buffer.from(svgString))
    .resize(width, height, {
      fit: 'contain',
      background: { r: 15, g: 23, b: 42, alpha: 1 }, // slate-900 background
    })
    .jpeg({
      quality,
      progressive: true,
    })
    .toBuffer();

  return jpegBuffer;
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
      return null;
    default:
      return svgToPng; // Default to PNG for social media compatibility
  }
}
