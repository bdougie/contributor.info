import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRepoSearch } from "../use-repo-search";
import { useGitHubAuth } from "../use-github-auth";
import { useNavigate } from "react-router-dom";

// Mock the hooks we depend on
vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(),
}));

vi.mock("../use-github-auth", () => ({
  useGitHubAuth: vi.fn(),
}));

describe("useRepoSearch", () => {
  const mockNavigate = vi.fn();
  const mockSetShowLoginDialog = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementation
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    
    // Clear localStorage between tests
    localStorage.clear();
  });
  
  describe("Home page behavior (isHomeView: true)", () => {
    it("should navigate to repo page when not logged in and searching from home page", () => {
      // Setup auth mock to simulate not logged in
      vi.mocked(useGitHubAuth).mockReturnValue({
        isLoggedIn: false,
        setShowLoginDialog: mockSetShowLoginDialog,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        checkSession: vi.fn().mockResolvedValue(false),
        showLoginDialog: false,
      });
      
      // Render the hook with isHomeView: true to simulate home page
      const { result } = renderHook(() => useRepoSearch({ isHomeView: true }));
      
      // Set some input
      act(() => {
        result.current.setSearchInput("facebook/react");
      });
      
      // Call handleSearch
      act(() => {
        const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
        result.current.handleSearch(mockEvent);
      });
      
      // Verify we navigate to the correct path even when not logged in
      expect(mockNavigate).toHaveBeenCalledWith("/facebook/react");
      
      // Verify login dialog is NOT shown on home page
      expect(mockSetShowLoginDialog).not.toHaveBeenCalled();
    });
    
    it("should navigate to repo page when not logged in and selecting example repo from home page", () => {
      // Setup auth mock to simulate not logged in
      vi.mocked(useGitHubAuth).mockReturnValue({
        isLoggedIn: false,
        setShowLoginDialog: mockSetShowLoginDialog,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        checkSession: vi.fn().mockResolvedValue(false),
        showLoginDialog: false,
      });
      
      // Render the hook with isHomeView: true to simulate home page
      const { result } = renderHook(() => useRepoSearch({ isHomeView: true }));
      
      // Call handleSelectExample
      act(() => {
        result.current.handleSelectExample("kubernetes/kubernetes");
      });
      
      // Verify we navigate to the repo even when not logged in
      expect(mockNavigate).toHaveBeenCalledWith("/kubernetes/kubernetes");
      
      // Verify login dialog is NOT shown on home page
      expect(mockSetShowLoginDialog).not.toHaveBeenCalled();
      
      // Verify input is updated
      expect(result.current.searchInput).toBe("kubernetes/kubernetes");
    });
  });
  
  describe("Repo view behavior (isHomeView: false)", () => {
    it("should redirect to login page when not logged in and searching from repo view", () => {
      // Setup auth mock to simulate not logged in
      vi.mocked(useGitHubAuth).mockReturnValue({
        isLoggedIn: false,
        setShowLoginDialog: mockSetShowLoginDialog,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        checkSession: vi.fn().mockResolvedValue(false),
        showLoginDialog: false,
      });
      
      // Render the hook with default isHomeView: false to simulate repo view
      const { result } = renderHook(() => useRepoSearch({ isHomeView: false }));
      
      // Set some input
      act(() => {
        result.current.setSearchInput("facebook/react");
      });
      
      // Call handleSearch
      act(() => {
        const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
        result.current.handleSearch(mockEvent);
      });
      
      // Verify we redirect to login page when not logged in
      expect(mockNavigate).toHaveBeenCalledWith("/login");
      
      // Verify that we saved the intended destination in localStorage
      expect(localStorage.getItem('redirectAfterLogin')).toBe('/facebook/react');
    });
    
    it("should redirect to login page when not logged in and selecting example repo from repo view", () => {
      // Setup auth mock to simulate not logged in
      vi.mocked(useGitHubAuth).mockReturnValue({
        isLoggedIn: false,
        setShowLoginDialog: mockSetShowLoginDialog,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        checkSession: vi.fn().mockResolvedValue(false),
        showLoginDialog: false,
      });
      
      // Render the hook with default isHomeView: false to simulate repo view
      const { result } = renderHook(() => useRepoSearch({ isHomeView: false }));
      
      // Call handleSelectExample
      act(() => {
        result.current.handleSelectExample("kubernetes/kubernetes");
      });
      
      // Verify we redirect to login page when not logged in
      expect(mockNavigate).toHaveBeenCalledWith("/login");
      
      // Verify that we saved the intended destination in localStorage
      expect(localStorage.getItem('redirectAfterLogin')).toBe('/kubernetes/kubernetes');
      
      // Verify input is updated
      expect(result.current.searchInput).toBe("kubernetes/kubernetes");
    });
    
    it("should navigate to repo page when logged in and searching from repo view", () => {
      // Setup auth mock to simulate logged in
      vi.mocked(useGitHubAuth).mockReturnValue({
        isLoggedIn: true,
        setShowLoginDialog: mockSetShowLoginDialog,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        checkSession: vi.fn().mockResolvedValue(true),
        showLoginDialog: false,
      });
      
      // Render the hook with default isHomeView: false
      const { result } = renderHook(() => useRepoSearch({ isHomeView: false }));
      
      // Set some input
      act(() => {
        result.current.setSearchInput("facebook/react");
      });
      
      // Call handleSearch
      act(() => {
        const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
        result.current.handleSearch(mockEvent);
      });
      
      // Verify we navigate to the correct path when logged in
      expect(mockNavigate).toHaveBeenCalledWith("/facebook/react");
      
      // Verify login dialog is not shown
      expect(mockSetShowLoginDialog).not.toHaveBeenCalled();
    });
  });
});