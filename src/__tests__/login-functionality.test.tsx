import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import LoginPage from "@/components/login-page";
import { useGitHubAuth } from "@/hooks/use-github-auth";
import { MetaTagsProvider } from "@/components/meta-tags-provider";

// Mock the auth hook with named export
vi.mock("@/hooks/use-github-auth", () => ({
  useGitHubAuth: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("Login Functionality", () => {
  it("redirects to home when already logged in", async () => {
    vi.mocked(useGitHubAuth).mockReturnValue({
      login: vi.fn(),
      isLoggedIn: true,
      loading: false,
      showLoginDialog: false,
      setShowLoginDialog: vi.fn(),
      logout: vi.fn(),
      checkSession: vi.fn().mockResolvedValue(true),
    });

    render(
      <MetaTagsProvider>
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      </MetaTagsProvider>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  it("shows login button and calls login when clicked", async () => {
    const mockLogin = vi.fn();
    vi.mocked(useGitHubAuth).mockReturnValue({
      login: mockLogin,
      isLoggedIn: false,
      loading: false,
      showLoginDialog: false,
      setShowLoginDialog: vi.fn(),
      logout: vi.fn(),
      checkSession: vi.fn().mockResolvedValue(false),
    });

    render(
      <MetaTagsProvider>
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      </MetaTagsProvider>
    );

    const loginButton = screen.getByRole("button", {
      name: /Login with GitHub/i,
    });
    await userEvent.click(loginButton);
    expect(mockLogin).toHaveBeenCalled();
  });
});
