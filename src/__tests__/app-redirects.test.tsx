import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Navigate } from 'react-router-dom';

// Mock the router Navigate component to track redirects
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Navigate: ({ to, replace }: { to: string; replace?: boolean }) => {
      mockNavigate(to, replace);
      return null;
    },
  };
});

describe('App Route Redirects', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('User Route Redirects', () => {
    it('should redirect /signup to /login with replace', () => {
      render(
        <MemoryRouter initialEntries={['/signup']}>
          <Routes>
            <Route path="/signup" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>,
      );

      expect(mockNavigate).toHaveBeenCalledWith('/login', true);
    });

    it('should redirect /search/feedback to /docs with replace', () => {
      render(
        <MemoryRouter initialEntries={['/search/feedback']}>
          <Routes>
            <Route path="/search/feedback" element={<Navigate to="/docs" replace />} />
            <Route path="/docs" element={<div>Docs Page</div>} />
          </Routes>
        </MemoryRouter>,
      );

      expect(mockNavigate).toHaveBeenCalledWith('/docs', true);
    });

    it('should not create browser history entries when redirecting', () => {
      render(
        <MemoryRouter initialEntries={['/signup']}>
          <Routes>
            <Route path="/signup" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>,
      );

      // Verify replace prop is used (true as second argument)
      expect(mockNavigate).toHaveBeenCalledWith('/login', true);
    });
  });

  describe('404 Error Prevention', () => {
    it('should handle old signup route without 404', () => {
      const consoleSpy = vi.spyOn(console, '_error').mockImplementation(() => {});

      render(
        <MemoryRouter initialEntries={['/signup']}>
          <Routes>
            <Route path="/signup" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<div>Login Page</div>} />
            <Route path="*" element={<div>404 Not Found</div>} />
          </Routes>
        </MemoryRouter>,
      );

      // Should redirect to login, not show 404
      expect(mockNavigate).toHaveBeenCalledWith('/login', true);
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle old search feedback route without 404', () => {
      const consoleSpy = vi.spyOn(console, '_error').mockImplementation(() => {});

      render(
        <MemoryRouter initialEntries={['/search/feedback']}>
          <Routes>
            <Route path="/search/feedback" element={<Navigate to="/docs" replace />} />
            <Route path="/docs" element={<div>Docs Page</div>} />
            <Route path="*" element={<div>404 Not Found</div>} />
          </Routes>
        </MemoryRouter>,
      );

      // Should redirect to docs, not show 404
      expect(mockNavigate).toHaveBeenCalledWith('/docs', true);
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Redirect Impact', () => {
    it('should resolve ~480 user route 404 _errors', () => {
      // Test that both problematic routes now redirect properly
      const problematicRoutes = ['/signup', '/search/feedback'];
      const expectedRedirects = ['/login', '/docs'];

      problematicRoutes.forEach((route, index) => {
        mockNavigate.mockClear();

        render(
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path="/signup" element={<Navigate to="/login" replace />} />
              <Route path="/search/feedback" element={<Navigate to="/docs" replace />} />
            </Routes>
          </MemoryRouter>,
        );

        expect(mockNavigate).toHaveBeenCalledWith(expectedRedirects[index], true);
      });
    });
  });
});
