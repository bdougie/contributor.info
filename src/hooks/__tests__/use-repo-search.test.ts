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
  });
  
  it("should navigate to repo page when not logged in and trying to search", () => {
    // Setup auth mock to simulate not logged in
    vi.mocked(useGitHubAuth).mockReturnValue({
      isLoggedIn: false,
      setShowLoginDialog: mockSetShowLoginDialog,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      showLoginDialog: false,
    });
    
    // Render the hook
    const { result } = renderHook(() => useRepoSearch());
    
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
    
    // Verify login dialog is NOT shown - this is the new behavior
    expect(mockSetShowLoginDialog).not.toHaveBeenCalled();
  });
  
  it("should navigate to repo page when logged in and searching", () => {
    // Setup auth mock to simulate logged in
    vi.mocked(useGitHubAuth).mockReturnValue({
      isLoggedIn: true,
      setShowLoginDialog: mockSetShowLoginDialog,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      showLoginDialog: false,
    });
    
    // Render the hook
    const { result } = renderHook(() => useRepoSearch());
    
    // Set some input
    act(() => {
      result.current.setSearchInput("facebook/react");
    });
    
    // Call handleSearch
    act(() => {
      const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
      result.current.handleSearch(mockEvent);
    });
    
    // Verify we navigate to the correct path
    expect(mockNavigate).toHaveBeenCalledWith("/facebook/react");
    
    // Verify login dialog is not shown
    expect(mockSetShowLoginDialog).not.toHaveBeenCalled();
  });
  
  it("should navigate to repo page when not logged in and selecting example repo", () => {
    // Setup auth mock to simulate not logged in
    vi.mocked(useGitHubAuth).mockReturnValue({
      isLoggedIn: false,
      setShowLoginDialog: mockSetShowLoginDialog,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      showLoginDialog: false,
    });
    
    // Render the hook
    const { result } = renderHook(() => useRepoSearch());
    
    // Call handleSelectExample
    act(() => {
      result.current.handleSelectExample("kubernetes/kubernetes");
    });
    
    // Verify we navigate to the repo even when not logged in
    expect(mockNavigate).toHaveBeenCalledWith("/kubernetes/kubernetes");
    
    // Verify login dialog is NOT shown - this is the new behavior
    expect(mockSetShowLoginDialog).not.toHaveBeenCalled();
    
    // Verify input is updated
    expect(result.current.searchInput).toBe("kubernetes/kubernetes");
  });
});