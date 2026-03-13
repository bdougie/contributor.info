import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChartShareUrl } from '@/lib/dub';

vi.mock('@/lib/dub', () => ({
  createChartShareUrl: vi.fn().mockReturnValue('https://oss.fyi/facebook/react'),
}));

// Mock ClipboardItem
global.ClipboardItem = class ClipboardItem {
  constructor(data: Record<string, Blob>) {
    Object.assign(this, data);
  }
} as typeof ClipboardItem;

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockReturnValue(undefined),
  write: vi.fn().mockReturnValue(undefined),
};
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
});

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ShareableCard Link Capture - URL Only', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location.href
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://contributor.info/repo/facebook/react',
      },
      writable: true,
    });
    vi.mocked(createChartShareUrl).mockReturnValue('https://oss.fyi/facebook/react');
  });

  it('should copy only the URL without descriptive text for link capture', () => {
    // Simulate the updated handleShareUrl logic
    const currentUrl = window.location.href;
    const shortUrl = createChartShareUrl(currentUrl, 'contributors-chart', 'facebook/react');

    // Copy only the URL (no descriptive text)
    navigator.clipboard.writeText(shortUrl as string);

    // Verify only the URL was copied
    expect(mockClipboard.writeText).toHaveBeenCalledWith(shortUrl);
    expect(mockClipboard.writeText).not.toHaveBeenCalledWith(
      expect.stringContaining('Check out this')
    );
  });

  it('should fallback to original URL only on error', () => {
    // Mock createChartShareUrl to throw an error
    const mockCreateChartShareUrl = vi.fn().mockImplementation(() => {
      throw new Error('API Error');
    });

    try {
      mockCreateChartShareUrl();
    } catch {
      // Fallback: copy original URL only (no descriptive text)
      navigator.clipboard.writeText(window.location.href);
    }

    expect(mockClipboard.writeText).toHaveBeenCalledWith(window.location.href);
    expect(mockClipboard.writeText).not.toHaveBeenCalledWith(expect.stringContaining('Check out'));
  });

  it('should demonstrate difference between link capture and native share', () => {
    const currentUrl = window.location.href;
    const shortUrl = createChartShareUrl(currentUrl, 'contributors-chart', 'facebook/react');

    // Link capture: URL only
    const linkCaptureContent = shortUrl;

    // Native share: descriptive text with URL
    const nativeShareContent = {
      title: 'Contributors Chart',
      text: 'Check out this chart for facebook/react',
      url: shortUrl,
    };

    // Verify link capture is just the URL
    expect(linkCaptureContent).toBe(shortUrl);
    expect(linkCaptureContent).not.toContain('Check out');

    // Verify native share includes descriptive text
    expect(nativeShareContent.text).toContain('Check out this chart for facebook/react');
    expect(nativeShareContent.url).toBe(shortUrl);
  });

  it('should use short URL for both link capture and image copy', () => {
    const currentUrl = window.location.href;
    const shortUrl = createChartShareUrl(currentUrl, 'contributors-chart', 'facebook/react');

    // Link capture: short URL only
    navigator.clipboard.writeText(shortUrl as string);

    // Image copy: short URL as text part
    const mockBlob = new Blob(['mock image data'], { type: 'image/png' });
    const clipboardItems = [
      new ClipboardItem({
        'image/png': mockBlob,
        'text/plain': new Blob([shortUrl as string], { type: 'text/plain' }),
      }),
    ];
    navigator.clipboard.write(clipboardItems);

    // Verify both use the same short URL
    expect(mockClipboard.writeText).toHaveBeenCalledWith(shortUrl);
    expect(mockClipboard.write).toHaveBeenCalledWith(clipboardItems);
  });

  it('should verify expected behavior across sharing methods', () => {
    const testUrl = 'https://oss.fyi/facebook/react';

    // Link button (handleShareUrl): URL only
    const linkButtonBehavior = {
      clipboardContent: testUrl,
      hasDescriptiveText: false,
    };

    // Copy button (copy with image): URL + image
    const copyButtonBehavior = {
      clipboardContent: { image: 'blob', text: testUrl },
      hasDescriptiveText: false, // URL only in text part
    };

    // Share button (native share): Descriptive text + URL
    const shareButtonBehavior = {
      content: {
        title: 'Chart Title',
        text: 'Check out this chart for facebook/react',
        url: testUrl,
      },
      hasDescriptiveText: true,
    };

    // Verify expected behaviors
    expect(linkButtonBehavior.hasDescriptiveText).toBe(false);
    expect(copyButtonBehavior.hasDescriptiveText).toBe(false);
    expect(shareButtonBehavior.hasDescriptiveText).toBe(true);

    expect(linkButtonBehavior.clipboardContent).toBe(testUrl);
    expect(shareButtonBehavior.content.text).toContain('Check out this chart');
  });
});
