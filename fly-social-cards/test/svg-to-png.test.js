import { describe, it, expect } from 'vitest';
import { svgToPng, svgToJpeg, getConverter } from '../src/svg-to-png.js';

describe('SVG to PNG Conversion', () => {
  const testSvg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="#0A0A0A"/>
    <text x="600" y="315" text-anchor="middle" font-size="48" fill="#FAFAFA" font-family="Arial">Test Card</text>
  </svg>`;

  it('should convert SVG to PNG', async () => {
    const pngBuffer = await svgToPng(testSvg);
    
    expect(pngBuffer).toBeInstanceOf(Buffer);
    expect(pngBuffer.length).toBeGreaterThan(0);
    
    // Check PNG signature
    expect(pngBuffer[0]).toBe(0x89);
    expect(pngBuffer[1]).toBe(0x50); // 'P'
    expect(pngBuffer[2]).toBe(0x4e); // 'N'
    expect(pngBuffer[3]).toBe(0x47); // 'G'
  });

  it('should convert SVG to JPEG', async () => {
    const jpegBuffer = await svgToJpeg(testSvg);
    
    expect(jpegBuffer).toBeInstanceOf(Buffer);
    expect(jpegBuffer.length).toBeGreaterThan(0);
    
    // Check JPEG signature
    expect(jpegBuffer[0]).toBe(0xff);
    expect(jpegBuffer[1]).toBe(0xd8);
  });

  it('should accept custom width and height', async () => {
    const pngBuffer = await svgToPng(testSvg, { width: 800, height: 400 });
    
    expect(pngBuffer).toBeInstanceOf(Buffer);
    expect(pngBuffer.length).toBeGreaterThan(0);
  });

  it('should accept custom quality', async () => {
    const pngBuffer = await svgToPng(testSvg, { quality: 50 });
    
    expect(pngBuffer).toBeInstanceOf(Buffer);
    expect(pngBuffer.length).toBeGreaterThan(0);
  });

  it('should handle errors gracefully', async () => {
    const invalidSvg = '<svg>invalid';
    
    await expect(svgToPng(invalidSvg)).rejects.toThrow();
  });

  it('should return PNG converter for "png" format', () => {
    const converter = getConverter('png');
    expect(converter).toBe(svgToPng);
  });

  it('should return JPEG converter for "jpeg" format', () => {
    const converter = getConverter('jpeg');
    expect(converter).toBe(svgToJpeg);
  });

  it('should return JPEG converter for "jpg" format', () => {
    const converter = getConverter('jpg');
    expect(converter).toBe(svgToJpeg);
  });

  it('should return null for "svg" format', () => {
    const converter = getConverter('svg');
    expect(converter).toBeNull();
  });

  it('should default to PNG for unknown formats', () => {
    const converter = getConverter('unknown');
    expect(converter).toBe(svgToPng);
  });
});
