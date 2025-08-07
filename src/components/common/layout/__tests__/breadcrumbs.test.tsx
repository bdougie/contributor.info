import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Breadcrumbs } from '../breadcrumbs';

// Mock the mobile detection hook
const mockUseIsMobile = vi.fn(() => false);
vi.mock('@/lib/utils/mobile-detection', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

const renderWithRouter = (initialPath: string, isMobile = false) => {
  // Update the mock for this specific test
  mockUseIsMobile.mockReturnValue(isMobile);
  
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="*" element={<Breadcrumbs />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );
};

describe('Breadcrumbs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Desktop Rendering', () => {
    it('should render home breadcrumb on root path', () => {
      renderWithRouter('/');
      expect(screen.getByText('home')).toBeInTheDocument();
    });

    it('should render full breadcrumb path for repository', () => {
      renderWithRouter('/facebook/react');
      expect(screen.getByText('home')).toBeInTheDocument();
      expect(screen.getByText('facebook')).toBeInTheDocument();
      expect(screen.getByText('react')).toBeInTheDocument();
    });

    it('should render activity page breadcrumbs', () => {
      renderWithRouter('/facebook/react/activity');
      expect(screen.getByText('home')).toBeInTheDocument();
      expect(screen.getByText('facebook')).toBeInTheDocument();
      expect(screen.getByText('react')).toBeInTheDocument();
      expect(screen.getByText('activity')).toBeInTheDocument();
    });

    it('should make all breadcrumbs except last clickable', () => {
      renderWithRouter('/facebook/react/activity');
      // Find links that are breadcrumb links (not back button)
      const breadcrumbContainer = screen.getByRole('navigation', { name: 'breadcrumb' });
      const links = breadcrumbContainer.querySelectorAll('a');
      // Home, facebook, and react should be links
      expect(links).toHaveLength(3);
      // Activity should not be a link (it's the current page)
      const activityElement = screen.getByText('activity');
      expect(activityElement.closest('a')).toBeNull();
    });
  });

  describe('Mobile Rendering', () => {
    it('should not show back button on home page', () => {
      renderWithRouter('/', true);
      expect(screen.queryByLabelText(/Go back to/)).not.toBeInTheDocument();
    });

    it('should show back button on nested pages', () => {
      renderWithRouter('/facebook/react', true);
      const backButton = screen.getByLabelText('Go back to facebook');
      expect(backButton).toBeInTheDocument();
    });

    it('should truncate breadcrumbs on mobile with more than 3 levels', () => {
      renderWithRouter('/facebook/react/activity', true);
      expect(screen.getByText('home')).toBeInTheDocument();
      expect(screen.getByText('…')).toBeInTheDocument();
      // There are multiple "react" elements (back button and breadcrumb)
      const reactElements = screen.getAllByText('react');
      expect(reactElements.length).toBeGreaterThan(0);
      expect(screen.getByText('activity')).toBeInTheDocument();
      // Facebook should not be visible in the breadcrumb (but might be in back button)
      const breadcrumbNav = screen.getByLabelText('Breadcrumb navigation');
      expect(breadcrumbNav.textContent).not.toContain('facebook');
    });

    it('should not truncate with 2 or fewer levels', () => {
      renderWithRouter('/facebook', true);
      // Home appears both in back button and in breadcrumb
      const homeElements = screen.getAllByText('home');
      expect(homeElements.length).toBeGreaterThan(0);
      // Facebook appears as the current page
      expect(screen.getByText('facebook')).toBeInTheDocument();
      expect(screen.queryByText('…')).not.toBeInTheDocument();
    });

    it('should have scrollable container with proper ARIA attributes', () => {
      renderWithRouter('/facebook/react/activity', true);
      const scrollContainer = screen.getByLabelText('Breadcrumb navigation');
      expect(scrollContainer).toBeInTheDocument();
      expect(scrollContainer).toHaveAttribute('role', 'navigation');
      expect(scrollContainer).toHaveClass('scrollbar-hide');
    });
  });

  describe('JSON-LD Structured Data', () => {
    it('should render with dynamic origin support', () => {
      // Just verify the component renders without hard-coded domains
      // The actual JSON-LD is managed by react-helmet-async which doesn't render in tests
      const { container } = renderWithRouter('/facebook/react');
      
      // Verify the component renders without errors
      expect(container).toBeInTheDocument();
      
      // Verify the breadcrumbs are rendered
      expect(screen.getByText('home')).toBeInTheDocument();
      expect(screen.getByText('facebook')).toBeInTheDocument();
      expect(screen.getByText('react')).toBeInTheDocument();
    });
  });

  describe('Back Button Navigation', () => {
    it('should navigate to parent breadcrumb', () => {
      renderWithRouter('/facebook/react/activity', true);
      const backButton = screen.getByLabelText('Go back to react');
      expect(backButton).toHaveAttribute('href', '/facebook/react');
    });

    it('should display correct parent name in back button', () => {
      renderWithRouter('/facebook/react', true);
      const backButton = screen.getByLabelText('Go back to facebook');
      expect(backButton).toHaveTextContent('facebook');
    });
  });

  describe('Special Routes', () => {
    it('should handle health/lottery route correctly', () => {
      renderWithRouter('/facebook/react/health');
      expect(screen.getByText('health')).toBeInTheDocument();
    });

    it('should handle distribution route correctly', () => {
      renderWithRouter('/facebook/react/distribution');
      expect(screen.getByText('distribution')).toBeInTheDocument();
    });

    it('should handle feed route correctly', () => {
      renderWithRouter('/facebook/react/feed');
      expect(screen.getByText('feed')).toBeInTheDocument();
    });
  });
});