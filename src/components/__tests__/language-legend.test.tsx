import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom"; // Add this import for DOM assertions
import { LanguageLegend } from "../features/distribution";
import type { LanguageStats } from "@/types";

describe("LanguageLegend", () => {
  // Test data
  const sampleLanguages: LanguageStats[] = [
    { name: "TypeScript", count: 25, color: "#2b7489" },
    { name: "JavaScript", count: 15, color: "#f1e05a" },
    { name: "CSS", count: 10, color: "#563d7c" },
    { name: "HTML", count: 5, color: "#e34c26" },
  ];

  it("renders without crashing", () => {
    render(<LanguageLegend languages={sampleLanguages} />);
    // Check that a language renders
    expect(screen.getByText("TypeScript (25)")).toBeInTheDocument();
  });

  it("sorts languages by count", () => {
    // Intentionally provide languages in a non-sorted order
    const unsortedLanguages: LanguageStats[] = [
      { name: "CSS", count: 10, color: "#563d7c" },
      { name: "TypeScript", count: 25, color: "#2b7489" },
      { name: "HTML", count: 5, color: "#e34c26" },
      { name: "JavaScript", count: 15, color: "#f1e05a" },
    ];

    render(<LanguageLegend languages={unsortedLanguages} />);

    // Check that languages appear in descending order by count
    const languageElements = screen.getAllByText(/\(\d+\)/);
    expect(languageElements[0].textContent).toContain("TypeScript (25)");
    expect(languageElements[1].textContent).toContain("JavaScript (15)");
    expect(languageElements[2].textContent).toContain("CSS (10)");
    expect(languageElements[3].textContent).toContain("HTML (5)");
  });

  it("renders empty languages array", () => {
    render(<LanguageLegend languages={[]} />);
    // Just check that it renders without errors
    expect(screen.getByText("Pull Requests")).toBeInTheDocument();
  });

  it("shows language color indicators", () => {
    const { container } = render(
      <LanguageLegend languages={sampleLanguages} />
    );

    // Check that we have the right number of color indicators
    const colorIndicators = container.querySelectorAll(".w-3.h-3.rounded-full");
    expect(colorIndicators.length).toBe(4);

    // Check that the TypeScript color is applied as an inline style
    // Using toHaveStyle with jest-dom
    expect(colorIndicators[0]).toHaveStyle("background-color: #2b7489");
  });
});
