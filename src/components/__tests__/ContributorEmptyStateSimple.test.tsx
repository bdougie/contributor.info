/**
 * Pure unit tests for ContributorEmptyStateSimple
 * 
 * FIXED: This test was previously flaky due to mock pollution from other tests.
 * Solution: Aggressive mock isolation using dynamic imports and complete cleanup.
 * 
 * This component has NO external dependencies and should never fail when properly isolated.
 */
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom";

// Use dynamic import to prevent module-level mock pollution
let ContributorEmptyStateSimple: any;

describe("ContributorEmptyStateSimple - Pure Component", () => {
  // Aggressive isolation to prevent mock pollution from other tests
  beforeEach(async () => {
    // Clear all possible global state
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();
    vi.resetModules();
    
    // Clean DOM
    document.body.innerHTML = '';
    cleanup();
    
    // Fresh import to avoid cached module pollution
    const module = await import("../features/contributor/contributor-empty-state-simple");
    ContributorEmptyStateSimple = module.ContributorEmptyStateSimple;
  });
  
  afterEach(() => {
    // Complete cleanup after each test
    cleanup();
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  it("renders no_data state with all required content", () => {
    // Ensure component is available
    expect(ContributorEmptyStateSimple).toBeDefined();
    
    const { container } = render(<ContributorEmptyStateSimple type="no_data" />);
    
    // Verify the component actually rendered something
    expect(container.innerHTML).not.toBe('');
    expect(container.firstChild).toBeInTheDocument();
    
    // Use more flexible text matching to handle potential DOM structure issues
    expect(screen.getByText("No Contributor Data Available")).toBeInTheDocument();
    expect(
      screen.getByText("We couldn't find any contributor data for this repository.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Make sure the repository has some activity and try again.")
    ).toBeInTheDocument();
    
    // Accessibility attributes
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    
    // Badge content
    expect(screen.getByText("✨ Tip")).toBeInTheDocument();
    
    // Icon placeholders (testing our fallback renderer)
    expect(container.querySelector('[data-icon="users"]')).toBeInTheDocument();
    expect(container.querySelector('[data-icon="trophy"]')).toBeInTheDocument();
  });

  it("renders no_activity state with correct content and accessibility", () => {
    expect(ContributorEmptyStateSimple).toBeDefined();
    
    const { container } = render(<ContributorEmptyStateSimple type="no_activity" />);
    
    // Verify rendering occurred
    expect(container.innerHTML).not.toBe('');
    
    // Content verification
    expect(screen.getByText("No Activity This Month")).toBeInTheDocument();
    expect(
      screen.getByText("No contributor activity found for the current period.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Check back later as contributors start making contributions this month.")
    ).toBeInTheDocument();
    
    // Should be info level (status, not alert)
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    
    // Icon should be calendar
    expect(container.querySelector('[data-icon="calendar"]')).toBeInTheDocument();
  });

  it("renders minimal_activity state with warning level content", () => {
    expect(ContributorEmptyStateSimple).toBeDefined();
    
    const { container } = render(<ContributorEmptyStateSimple type="minimal_activity" />);
    
    // Verify rendering
    expect(container.innerHTML).not.toBe('');
    
    // Content verification
    expect(screen.getByText("Limited Activity")).toBeInTheDocument();
    expect(
      screen.getByText("There's been minimal contributor activity this month.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("The leaderboard will be more meaningful as more contributors join.")
    ).toBeInTheDocument();
    
    // Badge should be warning level (Note)
    expect(screen.getByText("💡 Note")).toBeInTheDocument();
    
    // Should still be status (not alert)
    expect(screen.getByRole("status")).toBeInTheDocument();
    
    // Icon should be trending-up
    expect(container.querySelector('[data-icon="trending-up"]')).toBeInTheDocument();
  });

  it("renders loading_error state with alert level accessibility", () => {
    expect(ContributorEmptyStateSimple).toBeDefined();
    
    const { container } = render(<ContributorEmptyStateSimple type="loading_error" />);
    
    // Verify rendering
    expect(container.innerHTML).not.toBe('');
    
    // Content verification
    expect(screen.getByText("Unable to Load Contributor Data")).toBeInTheDocument();
    expect(
      screen.getByText("We encountered an error while loading contributor information.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Please try refreshing the page or check your network connection.")
    ).toBeInTheDocument();
    
    // Should be alert level (error state)
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    
    // Badge should be error level
    expect(screen.getByText("⚠️ Error")).toBeInTheDocument();
    
    // Icon should be trophy (error case uses trophy)
    expect(container.querySelector('[data-icon="trophy"]')).toBeInTheDocument();
  });

  it("accepts and renders custom message and suggestion props", () => {
    expect(ContributorEmptyStateSimple).toBeDefined();
    
    const customMessage = "Custom error message for testing";
    const customSuggestion = "Custom suggestion text for testing";
    
    const { container } = render(
      <ContributorEmptyStateSimple
        type="no_data"
        message={customMessage}
        suggestion={customSuggestion}
      />
    );

    // Verify rendering
    expect(container.innerHTML).not.toBe('');
    
    // Custom props should override defaults
    expect(screen.getByText(customMessage)).toBeInTheDocument();
    expect(screen.getByText(customSuggestion)).toBeInTheDocument();
    
    // Default messages should not be present
    expect(screen.queryByText("We couldn't find any contributor data for this repository.")).not.toBeInTheDocument();
    expect(screen.queryByText("Make sure the repository has some activity and try again.")).not.toBeInTheDocument();
    
    // Title and other elements should still be there
    expect(screen.getByText("No Contributor Data Available")).toBeInTheDocument();
  });

  it("accepts custom renderIcon prop and renders custom icons", () => {
    expect(ContributorEmptyStateSimple).toBeDefined();
    
    const customIconRenderer = (name: string, color: string) => (
      <div data-testid={`custom-icon-${name}`} className={color}>
        Custom {name} icon
      </div>
    );

    const { container } = render(
      <ContributorEmptyStateSimple
        type="no_data"
        renderIcon={customIconRenderer}
      />
    );
    
    // Verify rendering
    expect(container.innerHTML).not.toBe('');

    // Custom icons should be rendered with correct names
    expect(screen.getByTestId("custom-icon-trophy")).toBeInTheDocument();
    expect(screen.getByTestId("custom-icon-users")).toBeInTheDocument();
    
    // Custom icon content should be present
    expect(screen.getByText("Custom trophy icon")).toBeInTheDocument();
    expect(screen.getByText("Custom users icon")).toBeInTheDocument();
    
    // Default icon placeholders should not be present
    expect(container.querySelector('[data-icon="trophy"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-icon="users"]')).not.toBeInTheDocument();
  });

  it("applies custom className to root element", () => {
    expect(ContributorEmptyStateSimple).toBeDefined();
    
    const customClass = "my-custom-empty-state-class";
    const { container } = render(
      <ContributorEmptyStateSimple type="no_data" className={customClass} />
    );
    
    // Verify rendering
    expect(container.innerHTML).not.toBe('');

    // Custom class should be applied
    expect(container.querySelector(`.${customClass}`)).toBeInTheDocument();
    
    // Should also have the base class
    expect(container.querySelector('.contributor-empty-state')).toBeInTheDocument();
    
    // The element should have both classes
    const rootElement = container.firstChild as HTMLElement;
    expect(rootElement).toHaveClass('contributor-empty-state');
    expect(rootElement).toHaveClass(customClass);
  });
  
  it("handles unknown type gracefully with default fallback", () => {
    expect(ContributorEmptyStateSimple).toBeDefined();
    
    const { container } = render(
      // @ts-expect-error - intentionally testing invalid type
      <ContributorEmptyStateSimple type="invalid_type" />
    );
    
    // Should still render (fallback to default)
    expect(container.innerHTML).not.toBe('');
    
    // Should use default fallback content
    expect(screen.getByText("No Data Available")).toBeInTheDocument();
    expect(screen.getByText("Unable to display contributor information at this time.")).toBeInTheDocument();
    expect(screen.getByText("Please try again later.")).toBeInTheDocument();
    
    // Should be status level by default
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
  
  it("is completely self-contained with no external imports or dependencies", () => {
    expect(ContributorEmptyStateSimple).toBeDefined();
    
    // This test verifies the component can render in complete isolation
    const { container } = render(<ContributorEmptyStateSimple type="no_data" />);
    
    // Component should render successfully
    expect(container.innerHTML).not.toBe('');
    expect(container.firstChild).toBeInTheDocument();
    
    // Should have proper structure
    expect(container.querySelector('.contributor-empty-state')).toBeInTheDocument();
    expect(container.querySelector('.empty-state-header')).toBeInTheDocument();
    expect(container.querySelector('.empty-state-content')).toBeInTheDocument();
    
    // Should not depend on any external CSS or JS to function
    expect(screen.getByText("No Contributor Data Available")).toBeVisible();
  });
});