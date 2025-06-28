import { snapdom } from '@zumer/snapdom';

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
  private static readonly BORDER_WIDTH = 10;
  private static readonly BORDER_COLOR = '#f97316'; // Orange border
  private static readonly HEADER_HEIGHT = 60;
  private static readonly CONTENT_PADDING = 20;

  /**
   * Captures an element as an image using SnapDOM with attribution
   */
  public static async captureElement(
    element: HTMLElement,
    options: CaptureOptions
  ): Promise<CaptureResult> {
    // Store original element position for restoration
    const originalParent = element.parentNode;
    const originalNextSibling = element.nextSibling;
    
    // Create a wrapper with attribution for the capture
    const wrapper = this.createCaptureWrapperForElement(element, options);
    
    try {
      // Temporarily move the original element to our wrapper
      const contentContainer = wrapper.querySelector('[data-content-container]') as HTMLElement;
      contentContainer.appendChild(element);
      
      // Add wrapper to DOM temporarily for measurement and capture
      document.body.appendChild(wrapper);
      
      // Wait for chart libraries and async rendering to complete
      await this.waitForChartRender(contentContainer);
      
      // Debug: Check if wrapper has content
      console.log('Wrapper added to DOM:', wrapper);
      console.log('Wrapper dimensions:', wrapper.offsetWidth, 'x', wrapper.offsetHeight);
      console.log('Content container dimensions:', contentContainer.offsetWidth, 'x', contentContainer.offsetHeight);
      console.log('Element dimensions in wrapper:', element.offsetWidth, 'x', element.offsetHeight);
      
      // Try using SnapDOM's direct canvas method first (more reliable)
      let canvas: HTMLCanvasElement;
      let blob: Blob;
      
      try {
        // Use SnapDOM's direct canvas method
        canvas = await snapdom.toCanvas(wrapper, {
          scale: 1,
          backgroundColor: options.backgroundColor || 'white',
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
          backgroundColor: options.backgroundColor || 'white',
          format: 'png',
          embedFonts: true,
          compress: false
        });
        
        canvas = await result.toCanvas();
        
        // Validate canvas content before proceeding
        if (this.isCanvasBlank(canvas)) {
          console.error('Both SnapDOM methods produced blank canvas - capture failed');
          throw new Error('SnapDOM capture produced blank content');
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
    } finally {
      // Restore the original element to its original position
      try {
        if (originalParent) {
          originalParent.insertBefore(element, originalNextSibling);
        }
      } catch (error) {
        console.warn('Failed to restore original element:', error);
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
    
    // Apply light mode styles to the content container
    this.applyLightModeStyles(contentContainer);
    
    wrapper.appendChild(contentContainer);
    
    return wrapper;
  }

  /**
   * Applies wrapper styles matching the existing ShareableCard design
   */
  private static applyWrapperStyles(wrapper: HTMLDivElement, options: CaptureOptions): void {
    wrapper.style.cssText = `
      border: ${this.BORDER_WIDTH}px solid ${this.BORDER_COLOR};
      border-radius: 36px;
      overflow: hidden;
      background: white;
      position: fixed;
      top: -10000px;
      left: -10000px;
      max-width: ${options.width || this.DEFAULT_WIDTH}px;
      min-width: ${options.width || this.DEFAULT_WIDTH}px;
      width: ${options.width || this.DEFAULT_WIDTH}px;
      margin: 0;
      z-index: 10000;
      pointer-events: none;
    `;
  }

  /**
   * Creates the attribution header
   */
  private static createAttributionHeader(repository?: string): HTMLDivElement {
    const header = document.createElement('div');
    header.style.cssText = `
      height: ${this.HEADER_HEIGHT}px;
      background-color: #202020;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: white;
      position: relative;
      z-index: 1000;
    `;

    // Left side - repo info
    const leftContainer = this.createLeftContainer(repository);
    header.appendChild(leftContainer);

    // Right side - branding
    const rightContainer = this.createRightContainer();
    header.appendChild(rightContainer);

    return header;
  }

  /**
   * Creates the left side of the attribution header
   */
  private static createLeftContainer(repository?: string): HTMLDivElement {
    const leftContainer = document.createElement('div');
    leftContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    // Icon container
    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = `
      width: 24px;
      height: 24px;
      background-color: #404040;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    const iconSpan = document.createElement('span');
    iconSpan.style.cssText = 'font-size: 12px;';
    iconSpan.textContent = '📊';
    iconContainer.appendChild(iconSpan);

    // Repository name
    const repoName = document.createElement('span');
    repoName.style.cssText = `
      color: white;
      font-size: 16px;
      font-weight: bold;
      font-family: "Inter", system-ui, sans-serif;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 280px;
    `;
    repoName.textContent = repository || 'Repository';

    leftContainer.appendChild(iconContainer);
    leftContainer.appendChild(repoName);

    return leftContainer;
  }

  /**
   * Creates the right side of the attribution header
   */
  private static createRightContainer(): HTMLDivElement {
    const rightContainer = document.createElement('div');
    rightContainer.style.cssText = 'display: flex; align-items: center; flex-shrink: 0;';

    const logoIcon = document.createElement('span');
    logoIcon.style.cssText = 'font-size: 18px; margin-right: 4px;';
    logoIcon.textContent = '🌱';

    const logoText = document.createElement('span');
    logoText.style.cssText = `
      color: white;
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
   * Creates the content container
   */
  private static createContentContainer(): HTMLDivElement {
    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = `
      padding: ${this.CONTENT_PADDING}px;
      background: white;
      min-height: 300px;
      color-scheme: light;
    `;

    return contentContainer;
  }

  /**
   * Applies light mode styles to ensure consistent appearance
   * SnapDOM handles CSS better than html2canvas, so we need fewer overrides
   */
  private static applyLightModeStyles(element: HTMLElement): void {
    // Add a style element for light mode overrides
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .snapdom-light-override * {
        color-scheme: light !important;
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
        text-rendering: optimizeLegibility !important;
      }
      
      /* Background overrides */
      .snapdom-light-override .bg-background,
      .snapdom-light-override .bg-card,
      .snapdom-light-override .dark\\:bg-background,
      .snapdom-light-override .dark\\:bg-card {
        background-color: white !important;
      }
      
      /* Text color overrides */
      .snapdom-light-override .text-foreground,
      .snapdom-light-override .text-card-foreground,
      .snapdom-light-override .dark\\:text-foreground,
      .snapdom-light-override .dark\\:text-card-foreground {
        color: #111827 !important;
      }
      
      /* Border overrides */
      .snapdom-light-override .border,
      .snapdom-light-override .dark\\:border {
        border-color: #e5e7eb !important;
      }
      
      /* Muted styles */
      .snapdom-light-override .bg-muted,
      .snapdom-light-override .dark\\:bg-muted {
        background-color: #f9fafb !important;
      }
      .snapdom-light-override .text-muted-foreground,
      .snapdom-light-override .dark\\:text-muted-foreground {
        color: #6b7280 !important;
      }
      
      /* Accent styles */
      .snapdom-light-override .bg-accent,
      .snapdom-light-override .dark\\:bg-accent {
        background-color: #f3f4f6 !important;
      }
      
      /* Badge color overrides */
      .snapdom-light-override .bg-red-100,
      .snapdom-light-override .dark\\:bg-red-900\\/20 {
        background-color: #fee2e2 !important;
      }
      .snapdom-light-override .text-red-700,
      .snapdom-light-override .dark\\:text-red-400 {
        color: #b91c1c !important;
      }
      .snapdom-light-override .bg-yellow-100,
      .snapdom-light-override .dark\\:bg-yellow-900\\/20 {
        background-color: #fef3c7 !important;
      }
      .snapdom-light-override .text-yellow-700,
      .snapdom-light-override .dark\\:text-yellow-400 {
        color: #b45309 !important;
      }
      .snapdom-light-override .bg-green-100,
      .snapdom-light-override .dark\\:bg-green-900\\/20 {
        background-color: #d1fae5 !important;
      }
      .snapdom-light-override .text-green-700,
      .snapdom-light-override .dark\\:text-green-400 {
        color: #15803d !important;
      }
    `;

    element.appendChild(styleElement);
    element.classList.add('snapdom-light-override');
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
   * Waits for chart libraries and dynamic content to render completely
   */
  private static async waitForChartRender(container: HTMLElement): Promise<void> {
    // Initial wait for basic DOM updates
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Wait for images to load
    const images = container.querySelectorAll('img');
    if (images.length > 0) {
      console.log(`Waiting for ${images.length} images to load...`);
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
      console.log(`Found ${canvases.length} canvas elements, waiting for render...`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Wait for any SVG elements (D3, Nivo charts)
    const svgs = container.querySelectorAll('svg');
    if (svgs.length > 0) {
      console.log(`Found ${svgs.length} SVG elements, waiting for render...`);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Final wait for any remaining async operations
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('Chart render wait complete');
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
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log('Cleaned up download link and blob URL');
    }, 100);
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
}