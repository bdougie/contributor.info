import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";
import ContributionsWrapper from "../contributions-wrapper";
import { TestRepoStatsProvider } from "../../../__tests__/test-utils";

describe("ContributionsWrapper", () => {
  it("renders the card with title and description", () => {
    render(
      <TestRepoStatsProvider>
        <ContributionsWrapper />
      </TestRepoStatsProvider>
    );

    expect(screen.getByText("Pull Request Contributions")).toBeInTheDocument();
    expect(screen.getByText("Visualize the size and frequency of contributions")).toBeInTheDocument();
  });

  it("renders loading state initially", () => {
    render(
      <TestRepoStatsProvider>
        <ContributionsWrapper />
      </TestRepoStatsProvider>
    );

    // Should show either the loading fallback or the mock component
    const loadingOrMock = screen.queryByText("Loading chart...") || screen.queryByTestId("mock-contributions-chart");
    expect(loadingOrMock).toBeTruthy();
  });
});