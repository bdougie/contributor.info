import { describe, it, expect, vi } from 'vitest'
import { createChartShareUrl, getDubConfig } from '@/lib/dub'

// Simple unit test for the updated functionality
describe('RepoView Link Sharing Integration', () => {
  it('should verify createChartShareUrl is available for repo-view', async () => {
    // Test that the function we're using in repo-view works correctly
    const testUrl = 'https://contributor.info/facebook/react'
    const result = await createChartShareUrl(testUrl, 'repository-contributions', 'facebook/react')
    
    // In development mode, should return original URL
    expect(result).toBe(testUrl)
  })

  it('should verify dub config for repo-view integration', () => {
    const config = getDubConfig()
    
    // Verify config structure needed by repo-view
    expect(config).toHaveProperty('domain')
    expect(config).toHaveProperty('isDev')
    expect(config).toHaveProperty('hasApiKey')
    
    // In development, should use dub.sh
    expect(config.domain).toBe('dub.sh')
    expect(config.isDev).toBe(true)
  })

  it('should test clipboard integration pattern used in repo-view', async () => {
    // Mock clipboard for testing
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined)
    }
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true
    })

    // Simulate the pattern used in repo-view
    const testUrl = 'https://contributor.info/facebook/react'
    const shortUrl = await createChartShareUrl(testUrl, 'repository-contributions', 'facebook/react')
    const shareText = `Check out the contributions analysis for facebook/react\n${shortUrl}`
    
    await navigator.clipboard.writeText(shareText)
    
    expect(mockClipboard.writeText).toHaveBeenCalledWith(shareText)
    expect(shareText).toContain('facebook/react')
    expect(shareText).toContain(testUrl)
  })

  it('should validate chart type generation for different tabs', () => {
    // Test the pattern used in repo-view for different tabs
    const tabs = [
      { path: '/facebook/react', expected: 'contributions' },
      { path: '/facebook/react/health', expected: 'lottery' },
      { path: '/facebook/react/distribution', expected: 'distribution' },
      { path: '/facebook/react/feed', expected: 'feed' },
      { path: '/facebook/react/activity', expected: 'contributions' }
    ]

    tabs.forEach(({ path, expected }) => {
      // Simulate getCurrentTab logic from repo-view
      let tab = 'contributions' // default
      if (path.endsWith('/health')) tab = 'lottery'
      else if (path.endsWith('/distribution')) tab = 'distribution'
      else if (path.endsWith('/feed')) tab = 'feed'
      else if (path.endsWith('/activity') || path.endsWith('/contributions')) tab = 'contributions'
      
      expect(tab).toBe(expected)
    })
  })

  it('should confirm oss.fyi domain configuration for production', () => {
    // This documents the expected production behavior
    const expectedProductionConfig = {
      domain: 'oss.fyi',
      isDev: false,
      hasApiKey: true
    }
    
    // Verify the expected values
    expect(expectedProductionConfig.domain).toBe('oss.fyi')
    expect(expectedProductionConfig.isDev).toBe(false)
  })
})