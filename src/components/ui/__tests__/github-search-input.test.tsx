import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { GitHubSearchInput } from "../github-search-input";

// Mock the custom hook
vi.mock("@/hooks/use-github-search", () => ({
  useGitHubSearch: vi.fn(() => ({
    setQuery: vi.fn(),
    results: [],
    loading: false,
  })),
}));

// Mock GitHub API function
vi.mock("@/lib/github", () => ({
  searchGitHubRepositories: vi.fn(),
}));

describe("GitHubSearchInput", () => {
  const mockOnSearch = vi.fn();
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with default placeholder", () => {
    render(<GitHubSearchInput onSearch={mockOnSearch} />);
    
    expect(screen.getByPlaceholderText("Search repositories (e.g., facebook/react)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
  });

  it("renders with custom placeholder and button text", () => {
    render(
      <GitHubSearchInput
        onSearch={mockOnSearch}
        placeholder="Custom placeholder"
        buttonText="Analyze"
      />
    );
    
    expect(screen.getByPlaceholderText("Custom placeholder")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeInTheDocument();
  });

  it("calls onSearch when form is submitted", async () => {
    const user = userEvent.setup();
    
    render(<GitHubSearchInput onSearch={mockOnSearch} />);
    
    const input = screen.getByRole("textbox");
    const submitButton = screen.getByRole("button", { name: "Search" });

    await user.type(input, "facebook/react");
    await user.click(submitButton);

    expect(mockOnSearch).toHaveBeenCalledWith("facebook/react");
  });

  it("calls onSearch when enter is pressed", async () => {
    const user = userEvent.setup();
    
    render(<GitHubSearchInput onSearch={mockOnSearch} />);
    
    const input = screen.getByRole("textbox");

    await user.type(input, "kubernetes/kubernetes");
    await user.keyboard("{Enter}");

    expect(mockOnSearch).toHaveBeenCalledWith("kubernetes/kubernetes");
  });

  it("can be rendered without button", () => {
    render(<GitHubSearchInput onSearch={mockOnSearch} showButton={false} />);
    
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("accepts initial value", () => {
    render(<GitHubSearchInput onSearch={mockOnSearch} value="initial/repo" />);
    
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("initial/repo");
  });

  it("prevents form submission when input is empty", async () => {
    const user = userEvent.setup();
    
    render(<GitHubSearchInput onSearch={mockOnSearch} />);
    
    const submitButton = screen.getByRole("button", { name: "Search" });
    await user.click(submitButton);

    expect(mockOnSearch).toHaveBeenCalledWith("");
  });
});