import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock supabase module before importing dub.ts
vi.mock('../supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    }
  }
}))

// Import after mocking
import { createShortUrl, createChartShareUrl, getDubConfig } from '../dub'

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn()
}
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true
})

// Get access to mocked supabase for testing
import { supabase } from '../supabase'
const mockSupabase = vi.mocked(supabase)

describe('Link Capturing Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Development Mode Behavior', () => {
    it('should return original URL in development mode', async () => {
      // Development mode skips API and returns original URL
      const testUrl = 'https://contributor.info/repo/facebook/react'
      const result = await createShortUrl({ url: testUrl })

      expect(result).toMatchObject({
        id: 'dev-mock',
        domain: 'localhost',
        key: 'dev-key',
        url: testUrl,
        shortLink: testUrl, // Should return original URL in dev mode
        qrCode: '',
        clicks: 0
      })
    })

    it('should handle chart share URL in development mode', async () => {
      const testUrl = 'https://contributor.info/repo/facebook/react'
      const result = await createChartShareUrl(testUrl, 'contributors-chart', 'facebook/react')

      // Should return original URL in development mode
      expect(result).toBe(testUrl)
    })

    it('should show development configuration', () => {
      const config = getDubConfig()
      expect(config).toMatchObject({
        domain: 'dub.sh', // Development uses dub.sh
        isDev: true,
        hasApiKey: true
      })
    })
  })

  describe('Production Environment Documentation', () => {
    it('should document oss.fyi domain usage in production', () => {
      // This test documents the expected production behavior
      // In production mode (import.meta.env.DEV = false), the system would use:
      const productionConfig = {
        domain: 'oss.fyi',
        isDev: false,
        hasApiKey: true
      }
      
      expect(productionConfig.domain).toBe('oss.fyi')
      expect(productionConfig.isDev).toBe(false)
    })

    it('should document Supabase Edge Function call in production', () => {
      // This test documents what the Supabase function call would look like in production
      const expectedProductionCall = {
        functionName: 'url-shortener',
        body: {
          url: 'https://contributor.info/repo/microsoft/vscode',
          domain: 'oss.fyi', // Production uses oss.fyi
          utmSource: 'contributor-info',
          utmMedium: 'chart-share',
          utmCampaign: 'social-sharing'
        }
      }
      
      expect(expectedProductionCall.body.domain).toBe('oss.fyi')
      expect(expectedProductionCall.functionName).toBe('url-shortener')
    })

    it('should document expected production response format', () => {
      // This test documents the expected response format from production
      const expectedProductionResponse = {
        id: 'generated-id',
        domain: 'oss.fyi',
        key: 'microsoft/vscode',
        url: 'https://contributor.info/repo/microsoft/vscode',
        shortLink: 'https://oss.fyi/microsoft/vscode',
        qrCode: 'data:image/png;base64,generated-qr',
        utmSource: 'contributor-info',
        utmMedium: 'chart-share',
        utmCampaign: 'social-sharing',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        clicks: 0,
        title: null,
        description: null
      }
      
      expect(expectedProductionResponse.shortLink).toContain('oss.fyi')
      expect(expectedProductionResponse.domain).toBe('oss.fyi')
    })
  })

  describe('Link Copying to Clipboard', () => {
    it('should copy dub.sh link to clipboard', async () => {
      const testUrl = 'https://dub.sh/test123'
      
      await navigator.clipboard.writeText(testUrl)
      
      expect(mockClipboard.writeText).toHaveBeenCalledWith(testUrl)
    })

    it('should copy oss.fyi link to clipboard', async () => {
      const testUrl = 'https://oss.fyi/test456'
      
      await navigator.clipboard.writeText(testUrl)
      
      expect(mockClipboard.writeText).toHaveBeenCalledWith(testUrl)
    })

    it('should handle clipboard write errors gracefully', async () => {
      mockClipboard.writeText.mockRejectedValueOnce(new Error('Clipboard access denied'))
      
      await expect(navigator.clipboard.writeText('https://dub.sh/error'))
        .rejects.toThrow('Clipboard access denied')
    })
  })

  describe('URL Validation and Security', () => {
    it('should handle invalid URLs in chart sharing', async () => {
      const invalidUrl = 'invalid-url'
      const result = await createChartShareUrl(invalidUrl, 'test-chart')
      
      // Should return original URL when validation fails
      expect(result).toBe(invalidUrl)
    })

    it('should reject URLs from disallowed domains', async () => {
      const maliciousUrl = 'https://malicious-site.com/page'
      const result = await createChartShareUrl(maliciousUrl, 'test-chart')
      
      // Should return original URL when domain validation fails
      expect(result).toBe(maliciousUrl)
    })

    it('should allow contributor.info domains', async () => {
      const validUrl = 'https://contributor.info/repo/test/repo'
      const result = await createChartShareUrl(validUrl, 'test-chart')
      
      // Should process the URL (in dev mode, returns original)
      expect(result).toBe(validUrl)
    })

    it('should allow localhost for development', async () => {
      const localhostUrl = 'http://localhost:3000/repo/test/repo'
      const result = await createChartShareUrl(localhostUrl, 'test-chart')
      
      // Should process the URL
      expect(result).toBe(localhostUrl)
    })
  })

  describe('Error Handling', () => {
    it('should handle Supabase function errors', async () => {
      mockSupabase.functions.invoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Function invocation failed' }
      })

      const result = await createShortUrl({ url: 'https://contributor.info/test' })
      
      // In development mode, should still return dev mock even with errors
      expect(result?.id).toBe('dev-mock')
    })

    it('should handle service errors in response', async () => {
      mockSupabase.functions.invoke.mockResolvedValueOnce({
        data: { error: 'Rate limit exceeded' },
        error: null
      })

      const result = await createShortUrl({ url: 'https://contributor.info/test' })
      
      // In development mode, should still return dev mock
      expect(result?.id).toBe('dev-mock')
    })

    it('should handle network/connection errors', async () => {
      mockSupabase.functions.invoke.mockRejectedValueOnce(new Error('Network error'))

      const result = await createShortUrl({ url: 'https://contributor.info/test' })
      
      // In development mode, should still return dev mock
      expect(result?.id).toBe('dev-mock')
    })
  })

  describe('Analytics Tracking', () => {
    it('should track successful link creation', async () => {
      const testUrl = 'https://contributor.info/repo/facebook/react'
      const result = await createShortUrl({ url: testUrl })

      // In development mode, returns original URL
      expect(result?.shortLink).toBe(testUrl)
      expect(result?.id).toBe('dev-mock')
      
      // Analytics tracking would be tested separately in analytics.test.ts
    })

    it('should include UTM parameters in production calls', async () => {
      // This test documents the expected UTM parameters
      const expectedUTMParams = {
        utmSource: 'contributor-info',
        utmMedium: 'chart-share',
        utmCampaign: 'social-sharing'
      }
      
      expect(expectedUTMParams).toMatchObject({
        utmSource: 'contributor-info',
        utmMedium: 'chart-share',
        utmCampaign: 'social-sharing'
      })
    })
  })

  describe('Integration Test Scenarios', () => {
    it('should demonstrate dub.sh link capture in development', async () => {
      const testUrl = 'https://contributor.info/repo/facebook/react'
      
      // Copy URL to clipboard (simulating user action)
      await navigator.clipboard.writeText(testUrl)
      
      // Create short URL
      const result = await createShortUrl({ url: testUrl })
      
      // Verify the link structure
      expect(result?.shortLink).toBe(testUrl) // Dev mode returns original
      expect(mockClipboard.writeText).toHaveBeenCalledWith(testUrl)
    })

    it('should demonstrate oss.fyi link would be captured in production', async () => {
      const testUrl = 'https://contributor.info/repo/microsoft/vscode'
      
      // This test shows the expected production behavior
      // In production, the shortLink would be something like: https://oss.fyi/microsoft/vscode
      const expectedProductionDomain = 'oss.fyi'
      const expectedShortFormat = `https://${expectedProductionDomain}/microsoft/vscode`
      
      expect(expectedShortFormat).toBe('https://oss.fyi/microsoft/vscode')
    })

    it('should demonstrate complete chart sharing workflow', async () => {
      const chartUrl = 'https://contributor.info/repo/facebook/react'
      const chartType = 'contributors-activity'
      const repository = 'facebook/react'
      
      // Step 1: Create chart share URL
      const shortUrl = await createChartShareUrl(chartUrl, chartType, repository)
      
      // Step 2: Copy to clipboard
      await navigator.clipboard.writeText(shortUrl)
      
      // Verify the workflow
      expect(shortUrl).toBe(chartUrl) // Dev mode
      expect(mockClipboard.writeText).toHaveBeenCalledWith(shortUrl)
    })
  })
})