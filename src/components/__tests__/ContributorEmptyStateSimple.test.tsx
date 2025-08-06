import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";
import { ContributorEmptyStateSimple } from "../features/contributor/contributor-empty-state-simple";

describe("ContributorEmptyStateSimple", () => {
  it("renders no_data state correctly", () => {
    render(<ContributorEmptyStateSimple type="no_data" />);

    // Component should render with correct text
    expect(screen.getByText("No Contributor Data Available")).toBeInTheDocument();
    expect(
      screen.getByText("We couldn't find any contributor data for this repository.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Make sure the repository has some activity and try again.")
    ).toBeInTheDocument();
    
    // Should have correct role
    expect(screen.getByRole("status")).toBeInTheDocument();
    
    // Should show tip badge
    expect(screen.getByText("✨ Tip")).toBeInTheDocument();
  });

  it("renders no_activity state correctly", () => {
    render(<ContributorEmptyStateSimple type="no_activity" />);

    expect(screen.getByText("No Activity This Month")).toBeInTheDocument();
    expect(
      screen.getByText("No contributor activity found for the current period.")
    ).toBeInTheDocument();
  });

  it("renders minimal_activity state correctly", () => {
    render(<ContributorEmptyStateSimple type="minimal_activity" />);

    expect(screen.getByText("Limited Activity")).toBeInTheDocument();
    expect(screen.getByText("💡 Note")).toBeInTheDocument();
  });

  it("renders loading_error state correctly", () => {
    render(<ContributorEmptyStateSimple type="loading_error" />);

    expect(screen.getByText("Unable to Load Contributor Data")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("⚠️ Error")).toBeInTheDocument();
  });

  it("uses custom message and suggestion when provided", () => {
    render(
      <ContributorEmptyStateSimple
        type="no_data"
        message="Custom error message"
        suggestion="Custom suggestion text"
      />
    );

    expect(screen.getByText("Custom error message")).toBeInTheDocument();
    expect(screen.getByText("Custom suggestion text")).toBeInTheDocument();
  });

  it("renders custom icon when renderIcon prop is provided", () => {
    const customIconRenderer = (name: string, color: string) => (
      <div data-testid={`custom-icon-${name}`} className={color}>
        Custom {name} icon
      </div>
    );

    render(
      <ContributorEmptyStateSimple
        type="no_data"
        renderIcon={customIconRenderer}
      />
    );

    expect(screen.getByTestId("custom-icon-trophy")).toBeInTheDocument();
    expect(screen.getByTestId("custom-icon-users")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <ContributorEmptyStateSimple type="no_data" className="custom-class" />
    );

    expect(container.querySelector(".custom-class")).toBeInTheDocument();
  });
});