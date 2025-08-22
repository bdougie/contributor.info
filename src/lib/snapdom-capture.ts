import { snapdom } from '@zumer/snapdom';

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
import html2canvas from 'html2canvas';

export interface CaptureOptions {
  title: string;
  repository?: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
}

export interface CaptureResult {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  blob: Blob;
}

/**
 * Enhanced chart capture service using SnapDOM for superior performance and accuracy
 * Replaces html2canvas with 32-133x faster rendering
 */
export class SnapDOMCaptureService {
  private static readonly DEFAULT_WIDTH = 540;
  private static readonly HEADER_HEIGHT = 60;
  private static readonly CONTENT_PADDING = 20;

  /**
   * Gets the GitHub avatar URL for a repository owner
   */
  private static getRepositoryOwnerAvatarUrl(owner: string, size: number = 24): string {
    return `https://github.com/${owner}.png?s=${size}`;
  }

  /**
   * Captures an element as an image using SnapDOM with attribution
   */
  public static async captureElement(
    element: HTMLElement,
    options: CaptureOptions
  ): Promise<CaptureResult> {
    // Create a wrapper with attribution for the capture
    const wrapper = this.createCaptureWrapperForElement(element, options);
    
    // Store original element position for restoration
    const originalParent = element.parentNode;
    const originalNextSibling = element.nextSibling;
    
    try {
      // Get the content container from wrapper
      const contentContainer = wrapper.querySelector('[data-content-container]') as HTMLElement;
      
      // Move the original element to our wrapper (don't clone - it loses event handlers and chart data)
      contentContainer.appendChild(element);
      
      // Add wrapper to DOM temporarily for measurement and capture
      document.body.appendChild(wrapper);
      
      // Force layout calculation before waiting
      wrapper.offsetHeight;
      
      // Wait for chart libraries and async rendering to complete
      await this.waitForChartRender(contentContainer);
      
      // Wait for attribution images (repo logos) to load
      await this.waitForAttributionImages(wrapper);
      
      // Ensure visibility and proper dimensions
      const wrapperRect = wrapper.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      
      // Enhanced debugging to understand what SnapDOM sees
      console.log('=== SnapDOM Capture Debug ===');
      console.log('Wrapper added to DOM:', wrapper);
      console.log('Wrapper dimensions:', wrapper.offsetWidth, 'x', wrapper.offsetHeight);
      console.log('Content container dimensions:', contentContainer.offsetWidth, 'x', contentContainer.offsetHeight);
      console.log('Element dimensions in wrapper:', element.offsetWidth, 'x', element.offsetHeight);
      console.log('Wrapper rect:', wrapperRect);
      console.log('Element rect:', elementRect);
      
      // Debug wrapper visibility and styles
      const wrapperComputedStyle = window.getComputedStyle(wrapper);
      console.log('Wrapper visibility:', wrapperComputedStyle.visibility);
      console.log('Wrapper opacity:', wrapperComputedStyle.opacity);
      console.log('Wrapper display:', wrapperComputedStyle.display);
      console.log('Wrapper background:', wrapperComputedStyle.backgroundColor);
      
      // Debug element content
      console.log('Element HTML (first 500 chars):', element.innerHTML.substring(0, 500));
      console.log('Element class list:', Array.from(element.classList));
      
      // Debug child elements
      const childElements = element.querySelectorAll('*');
      console.log('Child elements count:', childElements.length);
      
      // Check for SVG and canvas elements specifically
      const svgElements = element.querySelectorAll('svg');
      const canvasElements = element.querySelectorAll('canvas');
      console.log('SVG elements:', svgElements.length);
      console.log('Canvas elements:', canvasElements.length);
      
      // Check if content is actually visible
      if (svgElements.length > 0) {
        const firstSvg = svgElements[0];
        console.log('First SVG dimensions:', firstSvg.getBoundingClientRect());
        console.log('First SVG viewBox:', firstSvg.getAttribute('viewBox'));
      }
      console.log('=== End Debug ===');
      
      // Test SnapDOM with simple content first
      await this.testSnapDOMBasicCapture();
      
      // Detect current theme for background color
      const isDarkMode = document.documentElement.classList.contains('dark') || 
                         document.body.classList.contains('dark') ||
                         (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      const themeBackgroundColor = options.backgroundColor || (isDarkMode ? '#030712' : '#ffffff');
      
      // Try using SnapDOM's direct canvas method first (more reliable)
      let canvas: HTMLCanvasElement;
      let blob: Blob;
      
      try {
        // Use SnapDOM's direct canvas method
        canvas = await snapdom.toCanvas(wrapper, {
          scale: 1,
          backgroundColor: themeBackgroundColor,
          format: 'png',
          embedFonts: true,
          compress: false
        });
        
        console.log('SnapDOM direct canvas:', canvas, 'dimensions:', canvas.width, 'x', canvas.height);
        
        // Validate canvas has actual content before creating blob
        if (this.isCanvasBlank(canvas)) {
          console.warn('SnapDOM direct canvas appears blank, retrying with result method');
          throw new Error('Canvas is blank - trying fallback method');
        }
        
        // Create blob from canvas
        blob = await this.canvasToBlob(canvas);
        console.log('Canvas-generated blob:', { size: blob.size, type: blob.type });
        
      } catch (directError) {
        console.warn('SnapDOM direct method failed, trying result object method:', directError);
        
        // Fallback to result object method
        const result = await snapdom(wrapper, {
          scale: 1,
          backgroundColor: themeBackgroundColor,
          format: 'png',
          embedFonts: true,
          compress: false
        });
        
        canvas = await result.toCanvas();
        
        // Validate canvas content before proceeding
        if (this.isCanvasBlank(canvas)) {
          console.warn('Both SnapDOM methods produced blank canvas - trying html2canvas fallback');
          throw new Error('SnapDOM capture produced blank content - trying fallback');
        }
        
        const snapBlob = await result.toBlob();
        console.log('SnapDOM result blob:', { size: snapBlob.size, type: snapBlob.type });
        
        // Validate the blob - if it's empty or invalid, create one from canvas
        if (!snapBlob || snapBlob.size === 0) {
          console.warn('SnapDOM blob is empty, creating blob from canvas');
          blob = await this.canvasToBlob(canvas);
        } else {
          blob = snapBlob;
        }
      }

      // Generate data URL from canvas
      const dataUrl = canvas.toDataURL('image/png');

      return {
        canvas,
        dataUrl,
        blob
      };
    } catch (snapdomError) {
      console.warn('SnapDOM capture failed entirely, falling back to html2canvas:', snapdomError);
      
      // Fallback to html2canvas
      try {
        const html2canvasResult = await this.captureWithHtml2Canvas(wrapper, options);
        return html2canvasResult;
      } catch (fallbackError) {
        console.error('Both SnapDOM and html2canvas failed:', fallbackError);
        throw new Error(`Capture failed: SnapDOM (${snapdomError instanceof Error ? snapdomError.message : String(snapdomError)}) and html2canvas (${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)})`);
      }
    } finally {
      // Restore the original element to its original position
      try {
        if (originalParent) {
          if (originalNextSibling) {
            originalParent.insertBefore(element, originalNextSibling);
          } else {
            originalParent.appendChild(element);
          }
        }
      } catch (restoreError) {
        console.warn('Failed to restore element position:', restoreError);
      }
      
      // Always clean up the wrapper
      this.cleanupWrapper(wrapper);
    }
  }

  /**
   * Creates a wrapper element with attribution header for capture (without cloning element)
   */
  private static createCaptureWrapperForElement(
    _element: HTMLElement, // Used for context but not directly accessed
    options: CaptureOptions
  ): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-snapdom-wrapper', 'true');
    
    // Apply wrapper styling
    this.applyWrapperStyles(wrapper, options);
    
    // Create and add attribution header
    const header = this.createAttributionHeader(options.repository);
    wrapper.appendChild(header);
    
    // Create content container (will hold the original element temporarily)
    const contentContainer = this.createContentContainer();
    contentContainer.setAttribute('data-content-container', 'true');
    
    // Apply theme-aware styles to the content container
    this.applyThemeAwareStyles(contentContainer);
    
    wrapper.appendChild(contentContainer);
    
    return wrapper;
  }

  /**
   * Applies wrapper styles matching the preview design (no orange border, theme-aware)
   */
  private static applyWrapperStyles(wrapper: HTMLDivElement, options: CaptureOptions): void {
    // Detect current theme to match preview appearance
    const isDarkMode = document.documentElement.classList.contains('dark') || 
                       document.body.classList.contains('dark') ||
                       (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    const backgroundColor = isDarkMode ? '#030712' : '#ffffff'; // bg-background equivalent
    const borderColor = isDarkMode ? '#374151' : '#e5e7eb'; // border-gray-700 : border-gray-200
    
    wrapper.style.cssText = `
      border: 1px solid ${borderColor};
      border-radius: 12px;
      overflow: hidden;
      background: ${backgroundColor};
      box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
      position: fixed;
      top: 0;
      left: -9999px;
      max-width: ${options.width || this.DEFAULT_WIDTH}px;
      min-width: ${options.width || this.DEFAULT_WIDTH}px;
      width: ${options.width || this.DEFAULT_WIDTH}px;
      margin: 0;
      z-index: 99999;
      pointer-events: none;
    `;
  }

  /**
   * Creates the attribution header with theme-aware colors
   */
  private static createAttributionHeader(repository?: string): HTMLDivElement {
    const header = document.createElement('div');
    
    // Detect current theme from document
    const isDarkMode = document.documentElement.classList.contains('dark') || 
                       document.body.classList.contains('dark') ||
                       (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    console.log('Theme detection for attribution bar:', {
      isDarkMode,
      htmlHasDark: document.documentElement.classList.contains('dark'),
      bodyHasDark: document.body.classList.contains('dark'),
      systemPrefersData: typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : 'N/A'
    });
    
    // Theme-aware colors: almost white on dark mode, black on light mode
    const backgroundColor = isDarkMode ? '#f9fafb' : '#000000'; // gray-50 (almost white) for dark, black for light  
    const textColor = isDarkMode ? '#111827' : '#ffffff'; // gray-900 (dark text) for dark, white for light
    
    console.log('Attribution bar colors:', { backgroundColor, textColor });
    
    header.style.cssText = `
      height: ${this.HEADER_HEIGHT}px;
      background-color: ${backgroundColor};
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: ${textColor};
      position: relative;
      z-index: 1000;
    `;

    // Left side - repo info
    const leftContainer = this.createLeftContainer(repository, isDarkMode);
    header.appendChild(leftContainer);

    // Right side - branding
    const rightContainer = this.createRightContainer(isDarkMode);
    header.appendChild(rightContainer);

    return header;
  }

  /**
   * Creates the left side of the attribution header with theme-aware colors
   */
  private static createLeftContainer(repository?: string, isDarkMode = false): HTMLDivElement {
    const leftContainer = document.createElement('div');
    leftContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    // Extract owner from repository string (format: "owner/repo")
    const owner = repository ? repository.split('/')[0] : null;

    // Theme-aware colors
    const textColor = isDarkMode ? '#111827' : '#000000'; // gray-900 for dark, black for light

    // Add repository owner logo if available
    if (owner && repository) {
      const logoContainer = document.createElement('div');
      logoContainer.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 4px;
        overflow: hidden;
        flex-shrink: 0;
        border: 1px solid ${isDarkMode ? '#d1d5db' : '#e5e7eb'};
      `;

      const logoImg = document.createElement('img');
      const avatarUrl = this.getRepositoryOwnerAvatarUrl(owner, 24);
      logoImg.src = avatarUrl;
      logoImg.alt = `${owner} logo`;
      logoImg.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
      `;
      
      console.log('Loading repository logo for %s: %s', owner, avatarUrl);
      
      // Add fallback for failed image loads
      logoImg.onerror = () => {
        console.log('Repository logo failed to load for %s, using fallback', owner);
        // Replace with initials fallback in rounded square
        logoContainer.innerHTML = `
          <div style="
            width: 100%;
            height: 100%;
            background-color: ${isDarkMode ? '#9ca3af' : '#6b7280'};
            color: ${isDarkMode ? '#ffffff' : '#ffffff'};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            font-family: 'Inter', system-ui, sans-serif;
          ">
            ${escapeHtml(owner.slice(0, 2).toUpperCase())}
          </div>
        `;
      };
      
      logoImg.onload = () => {
        console.log('Repository logo loaded successfully for %s', owner);
      };

      logoContainer.appendChild(logoImg);
      leftContainer.appendChild(logoContainer);
    } else {
      // Fallback: Use a generic repository icon when no owner info is available
      const iconBgColor = isDarkMode ? '#e5e7eb' : '#e5e7eb'; // gray-200 for both modes
      const iconContainer = document.createElement('div');
      iconContainer.style.cssText = `
        width: 24px;
        height: 24px;
        background-color: ${iconBgColor};
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid ${isDarkMode ? '#d1d5db' : '#e5e7eb'};
      `;
      
      // Use a repository icon for consistency with repo logos
      const iconSpan = document.createElement('span');
      iconSpan.style.cssText = `
        font-size: 12px;
        color: ${isDarkMode ? '#6b7280' : '#9ca3af'};
      `;
      iconSpan.textContent = '📁'; // Repository/folder icon is more appropriate
      iconContainer.appendChild(iconSpan);
      leftContainer.appendChild(iconContainer);
    }

    // Repository name
    const repoName = document.createElement('span');
    repoName.style.cssText = `
      color: ${textColor};
      font-size: 16px;
      font-weight: bold;
      font-family: "Inter", system-ui, sans-serif;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 280px;
    `;
    repoName.textContent = repository || 'Repository';

    leftContainer.appendChild(repoName);

    return leftContainer;
  }

  /**
   * Creates the right side of the attribution header with theme-aware colors
   */
  private static createRightContainer(isDarkMode = false): HTMLDivElement {
    const rightContainer = document.createElement('div');
    rightContainer.style.cssText = 'display: flex; align-items: center; flex-shrink: 0;';

    // Theme-aware text color for the logo
    const logoTextColor = isDarkMode ? '#111827' : '#ffffff'; // gray-900 for dark, white for light

    const logoIcon = document.createElement('span');
    logoIcon.style.cssText = 'font-size: 18px; margin-right: 4px;';
    logoIcon.textContent = '🌱';

    const logoText = document.createElement('span');
    logoText.style.cssText = `
      color: ${logoTextColor};
      font-size: 14px;
      font-weight: 500;
      font-family: "Inter", system-ui, sans-serif;
    `;
    logoText.textContent = 'contributor.info';

    rightContainer.appendChild(logoIcon);
    rightContainer.appendChild(logoText);

    return rightContainer;
  }

  /**
   * Creates the content container with theme-aware styling
   */
  private static createContentContainer(): HTMLDivElement {
    const contentContainer = document.createElement('div');
    
    // Detect current theme to match preview appearance
    const isDarkMode = document.documentElement.classList.contains('dark') || 
                       document.body.classList.contains('dark') ||
                       (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    const backgroundColor = isDarkMode ? '#030712' : '#ffffff'; // bg-background equivalent
    const colorScheme = isDarkMode ? 'dark' : 'light';
    
    contentContainer.style.cssText = `
      padding: ${this.CONTENT_PADDING}px;
      background: ${backgroundColor};
      min-height: 300px;
      color-scheme: ${colorScheme};
    `;

    return contentContainer;
  }

  /**
   * Applies theme-aware styles to preserve current theme appearance
   * Simplified to avoid conflicts with SnapDOM rendering
   */
  private static applyThemeAwareStyles(element: HTMLElement): void {
    // Detect current theme
    const isDarkMode = document.documentElement.classList.contains('dark') || 
                       document.body.classList.contains('dark') ||
                       (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    // Add theme class to preserve current theme
    if (isDarkMode) {
      element.classList.add('dark');
    } else {
      element.classList.remove('dark');
    }
    
    // Add a style element with minimal overrides to ensure visibility
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      /* Ensure basic visibility and proper rendering */
      .snapdom-theme-preserve {
        visibility: visible !important;
      }
      
      .snapdom-theme-preserve * {
        visibility: visible !important;
      }
      
      /* Ensure charts render properly in both themes */
      .snapdom-theme-preserve svg text {
        visibility: visible !important;
      }
      
      .snapdom-theme-preserve .recharts-text {
        visibility: visible !important;
      }
    `;

    element.appendChild(styleElement);
    element.classList.add('snapdom-theme-preserve');
    
    // Force layout recalculation
    element.offsetHeight;
  }

  /**
   * Converts canvas to blob as fallback
   */
  private static canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      }, 'image/png');
    });
  }

  /**
   * Enhanced wait for chart libraries and dynamic content to render completely
   */
  private static async waitForChartRender(container: HTMLElement): Promise<void> {
    console.log('Starting enhanced chart render wait...');
    
    // Initial wait for DOM settling
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Wait for images to load
    const images = container.querySelectorAll('img');
    if (images.length > 0) {
      console.log('Waiting for %s images to load...', images.length);
      await Promise.all(
        Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = () => resolve(void 0);
            img.onerror = () => resolve(void 0); // Continue even if image fails
            // Timeout after 2 seconds
            setTimeout(() => resolve(void 0), 2000);
          });
        })
      );
    }
    
    // Wait for any canvas elements (Chart.js, etc.)
    const canvases = container.querySelectorAll('canvas');
    if (canvases.length > 0) {
      console.log('Found %s canvas elements, waiting for render...', canvases.length);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Enhanced wait for SVG elements (D3, Nivo, Recharts)
    const svgs = container.querySelectorAll('svg');
    if (svgs.length > 0) {
      console.log('Found %s SVG elements, waiting for render...', svgs.length);
      
      // Wait for multiple animation frames
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => requestAnimationFrame(() => resolve(void 0)));
      }
      
      // Base wait for SVG rendering
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Additional wait for complex charts
      if (svgs.length > 5) {
        console.log('Complex chart detected, additional wait...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Check for specific chart libraries and give them extra time
      const hasRecharts = container.querySelector('.recharts-wrapper') !== null;
      const hasNivo = container.querySelector('[class*="nivo"]') !== null;
      
      if (hasRecharts) {
        console.log('Recharts detected, additional wait...');
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      if (hasNivo) {
        console.log('Nivo charts detected, additional wait...');
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // Final animation frame wait for smooth capture
    await new Promise(resolve => requestAnimationFrame(() => resolve(void 0)));
    
    // Additional safety wait
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log('Enhanced chart render wait complete');
  }

  /**
   * Waits for attribution header images (repository logos) to load
   */
  private static async waitForAttributionImages(wrapper: HTMLElement): Promise<void> {
    console.log('Waiting for attribution images to load...');
    
    // Find all images in the attribution header specifically
    const attributionImages = wrapper.querySelectorAll('img[alt*="logo"], img[alt*="avatar"]');
    
    if (attributionImages.length > 0) {
      console.log('Found %s attribution images to load...', attributionImages.length);
      
      await Promise.all(
        Array.from(attributionImages).map(img => {
          const imgElement = img as HTMLImageElement;
          
          // If already loaded, return immediately
          if (imgElement.complete && imgElement.naturalWidth > 0) {
            console.log('Image already loaded: %s', imgElement.src);
            return Promise.resolve();
          }
          
          return new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              console.log('Image load timeout: %s', imgElement.src);
              resolve();
            }, 3000); // 3 second timeout for external images
            
            imgElement.onload = () => {
              console.log('Image loaded successfully: %s', imgElement.src);
              clearTimeout(timeout);
              resolve();
            };
            
            imgElement.onerror = () => {
              console.log('Image failed to load: %s', imgElement.src);
              clearTimeout(timeout);
              resolve(); // Continue even if image fails
            };
            
            // If the src is not set or empty, resolve immediately
            if (!imgElement.src) {
              clearTimeout(timeout);
              resolve();
            }
          });
        })
      );
    }
    
    // Additional small wait for any CSS transitions
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('Attribution images wait complete');
  }

  /**
   * Checks if a canvas is blank (all white/transparent)
   */
  private static isCanvasBlank(canvas: HTMLCanvasElement): boolean {
    const context = canvas.getContext('2d');
    if (!context) return true;
    
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    // Check if all pixels are white (255,255,255,255) or transparent (0,0,0,0)
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];
      
      // If we find any non-white, non-transparent pixel, canvas has content
      if (!(
        (r === 255 && g === 255 && b === 255) || // White pixel
        (a === 0) // Transparent pixel
      )) {
        return false;
      }
    }
    
    console.warn('Canvas appears to be blank (all white/transparent pixels)');
    return true;
  }

  /**
   * Cleans up the wrapper element
   */
  private static cleanupWrapper(wrapper: HTMLDivElement): void {
    try {
      if (wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
      }
    } catch (error) {
      console.warn('Failed to cleanup SnapDOM wrapper:', error);
    }
  }

  /**
   * Utility method to download a blob as a file
   */
  public static downloadBlob(blob: Blob, filename: string): void {
    console.log('downloadBlob called with:', { 
      blobSize: blob.size, 
      blobType: blob.type, 
      filename 
    });
    
    // Check if we're in a browser environment
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      console.warn('downloadBlob called in non-browser environment');
      return;
    }
    
    if (!blob || blob.size === 0) {
      console.error('Cannot download empty blob');
      throw new Error('Cannot download empty blob');
    }
    
    const url = URL.createObjectURL(blob);
    console.log('Created blob URL:', url);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    // Clean up after a short delay to ensure download starts
    const timeoutId = setTimeout(() => {
      // Additional safety checks for browser environment
      if (typeof document !== 'undefined' && document.body && link.parentNode === document.body) {
        document.body.removeChild(link);
      }
      if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
        URL.revokeObjectURL(url);
      }
      console.log('Cleaned up download link and blob URL');
    }, 100);

    // Store timeout ID for potential cleanup (useful for testing)
    (link as any)._timeoutId = timeoutId;
  }

  /**
   * Utility method to copy blob to clipboard
   */
  public static async copyBlobToClipboard(blob: Blob): Promise<void> {
    console.log('copyBlobToClipboard called with blob:', { 
      size: blob.size, 
      type: blob.type 
    });
    
    if (!blob || blob.size === 0) {
      console.error('Cannot copy empty blob to clipboard');
      throw new Error('Cannot copy empty blob to clipboard');
    }
    
    try {
      const clipboardItem = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([clipboardItem]);
      console.log('Successfully copied blob to clipboard');
    } catch (error) {
      console.error('Failed to copy blob to clipboard:', error);
      throw error;
    }
  }

  /**
   * Fallback capture method using html2canvas
   */
  private static async captureWithHtml2Canvas(
    wrapper: HTMLElement,
    _options: CaptureOptions
  ): Promise<CaptureResult> {
    console.log('Starting html2canvas fallback capture...');
    
    const canvas = await html2canvas(wrapper, {
      useCORS: true,
      allowTaint: false,
      logging: false
    });
    
    console.log('html2canvas result:', {
      canvasSize: `${canvas.width}x${canvas.height}`,
      isBlank: this.isCanvasBlank(canvas)
    });
    
    if (this.isCanvasBlank(canvas)) {
      throw new Error('html2canvas also produced blank content');
    }
    
    const dataUrl = canvas.toDataURL('image/png');
    const blob = await this.canvasToBlob(canvas);
    
    return {
      canvas,
      dataUrl,
      blob
    };
  }

  /**
   * Test SnapDOM with simple content to verify it works at all
   * Public method for debugging purposes
   */
  public static async testSnapDOMBasicCapture(): Promise<void> {
    console.log('Testing SnapDOM with simple content...');
    
    const testElement = document.createElement('div');
    testElement.style.cssText = `
      width: 200px;
      height: 100px;
      background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: bold;
      position: fixed;
      top: 0;
      left: -9999px;
      z-index: 99999;
    `;
    testElement.textContent = 'TEST CONTENT';
    
    document.body.appendChild(testElement);
    
    try {
      const testCanvas = await snapdom.toCanvas(testElement, {
        scale: 1,
        backgroundColor: 'white',
        format: 'png'
      });
      
      const isBlank = this.isCanvasBlank(testCanvas);
      console.log('SnapDOM basic test result:', {
        canvasSize: `${testCanvas.width}x${testCanvas.height}`,
        isBlank: isBlank
      });
      
      if (isBlank) {
        console.error('SnapDOM fails even with simple content - possible library issue');
      } else {
        console.log('SnapDOM works with simple content - issue may be chart-specific');
      }
    } catch (error) {
      console.error('SnapDOM basic test failed:', error);
    } finally {
      document.body.removeChild(testElement);
    }
  }
}