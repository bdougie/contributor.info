import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";
import ContributionsWrapper from "../contributions-wrapper";
import { TestRepoStatsProvider } from "../../../__tests__/test-utils";

describe("ContributionsWrapper", () => {
  it("renders both contributions chart and PR activity feed", () => {
    render(
      <TestRepoStatsProvider>
        <ContributionsWrapper />
      </TestRepoStatsProvider>
    );

    // Check for PR Activity section
    expect(screen.getByText("Recent PR Activity")).toBeInTheDocument();
    expect(screen.getByText("Latest pull request actions")).toBeInTheDocument();
    
    // The contributions chart should be loading or showing mock
    const loadingOrMock = screen.queryByText("Loading chart...") || screen.queryByTestId("mock-contributions-chart");
    expect(loadingOrMock).toBeTruthy();
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