import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnapDOMCaptureService } from '../snapdom-capture';

// Mock the snapdom module
vi.mock('@zumer/snapdom', () => ({
  snapdom: Object.assign(vi.fn(), {
    toCanvas: vi.fn()
  })
}));

describe('SnapDOMCaptureService', () => {
  let mockElement: HTMLElement;
  let mockCanvas: HTMLCanvasElement;

  beforeEach(() => {
    // Create a mock HTML element
    mockElement = document.createElement('div');
    mockElement.innerHTML = '<p>Test content</p>';
    
    // Create a mock canvas with proper methods
    mockCanvas = {
      width: 540,
      height: 400,
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,test'),
      toBlob: vi.fn().mockImplementation((callback) => {
        const blob = new Blob(['test'], { type: 'image/png' });
        if (callback) callback(blob);
      }),
      getContext: vi.fn().mockReturnValue({
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]) // Mixed white and non-white pixels
        })
      })
    } as unknown as HTMLCanvasElement;

    // Mock document methods
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockElement);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockElement);
    
    // Mock createElement for div elements
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'div') {
        element.querySelectorAll = vi.fn().mockReturnValue([]); // No images, canvas, or SVG by default
      }
      return element;
    });
    
    // Mock URL methods
    global.URL = {
      createObjectURL: vi.fn().mockReturnValue('blob:test-url'),
      revokeObjectURL: vi.fn()
    } as unknown as typeof URL;
  });

  it('should capture element with attribution', async () => {
    const { snapdom } = await import('@zumer/snapdom');
    const mockSnapResult = {
      url: 'test-url',
      options: {},
      toRaw: vi.fn(),
      toImg: vi.fn(),
      toCanvas: vi.fn().mockResolvedValue(mockCanvas),
      toBlob: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'image/png' })),
      toPng: vi.fn(),
      toJpg: vi.fn(),
      toWebp: vi.fn(),
      download: vi.fn()
    };
    vi.mocked(snapdom).mockResolvedValue(mockSnapResult);

    const result = await SnapDOMCaptureService.captureElement(mockElement, {
      title: 'Test Chart',
      repository: 'test/repo',
      width: 540
    });

    expect(snapdom).toHaveBeenCalled();
    expect(mockSnapResult.toCanvas).toHaveBeenCalled();
    expect(mockSnapResult.toBlob).toHaveBeenCalled();
    expect(result.canvas).toBe(mockCanvas);
    expect(result.dataUrl).toBe('data:image/png;base64,test');
    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('should handle capture with default options', async () => {
    const { snapdom } = await import('@zumer/snapdom');
    const mockSnapResult = {
      url: 'test-url',
      options: {},
      toRaw: vi.fn(),
      toImg: vi.fn(),
      toCanvas: vi.fn().mockResolvedValue(mockCanvas),
      toBlob: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'image/png' })),
      toPng: vi.fn(),
      toJpg: vi.fn(),
      toWebp: vi.fn(),
      download: vi.fn()
    };
    vi.mocked(snapdom).mockResolvedValue(mockSnapResult);

    const result = await SnapDOMCaptureService.captureElement(mockElement, {
      title: 'Test Chart'
    });

    expect(snapdom).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        scale: 1,
        backgroundColor: '#ffffff', // Theme-aware white color
        format: 'png',
        embedFonts: true,
        compress: false
      })
    );
    
    expect(result).toBeDefined();
  });

  it('should download blob correctly', () => {
    const mockBlob = new Blob(['test'], { type: 'image/png' });
    const mockLink = {
      download: '',
      href: '',
      style: { display: '' },
      click: vi.fn()
    } as unknown as HTMLAnchorElement;
    
    vi.spyOn(document, 'createElement').mockReturnValueOnce(mockLink);

    SnapDOMCaptureService.downloadBlob(mockBlob, 'test-chart.png');

    expect(mockLink.download).toBe('test-chart.png');
    expect(mockLink.click).toHaveBeenCalled();
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    // Note: revokeObjectURL is called in setTimeout, so we don't test it here
  });

  it('should copy blob to clipboard', async () => {
    const mockBlob = new Blob(['test'], { type: 'image/png' });
    const mockWrite = vi.fn().mockResolvedValue(undefined);
    
    // Mock ClipboardItem
    global.ClipboardItem = vi.fn().mockImplementation((data) => ({
      data
    })) as any;
    
    Object.assign(navigator, {
      clipboard: {
        write: mockWrite
      }
    });

    await SnapDOMCaptureService.copyBlobToClipboard(mockBlob);

    expect(global.ClipboardItem).toHaveBeenCalledWith({ 'image/png': mockBlob });
    expect(mockWrite).toHaveBeenCalled();
  });

  it.skip('should clean up wrapper on error', async () => {
    const { snapdom } = await import('@zumer/snapdom');
    
    // Mock both toCanvas and the default snapdom function to throw
    vi.mocked(snapdom.toCanvas).mockRejectedValue(new Error('SnapDOM toCanvas error'));
    vi.mocked(snapdom).mockRejectedValue(new Error('SnapDOM error'));

    // Track DOM operations
    const appendedElements: HTMLElement[] = [];
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((element: any) => {
      appendedElements.push(element);
      // Mock the parentNode for cleanup
      element.parentNode = document.body;
      return element;
    });

    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((element: any) => {
      return element;
    });

    await expect(
      SnapDOMCaptureService.captureElement(mockElement, {
        title: 'Test Chart'
      })
    ).rejects.toThrow();

    // Should still clean up even on error - wrapper should be removed
    expect(appendedElements.length).toBeGreaterThan(0);
    expect(removeChildSpy).toHaveBeenCalledWith(appendedElements[0]);
    
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});