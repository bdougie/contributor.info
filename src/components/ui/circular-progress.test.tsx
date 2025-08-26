import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CircularProgress } from './circular-progress';

describe('CircularProgress', () => {
  it('renders with default props', () => {
    const { container } = render(<CircularProgress value={50} />);

    // Check the main container exists
    const mainDiv = container.querySelector('.relative.w-\\[98px\\].h-\\[52px\\]');
    expect(mainDiv).toBeInTheDocument();

    // Check SVG elements exist
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(2); // Background + progress SVG
  });

  it('displays percentage text when children are provided', () => {
    const { container } = render(
      <CircularProgress value={75}>
        <span className="font-bold tracking-[-0.05px]">75</span>
        <span className="font-bold text-xs tracking-[-0.01px]">%</span>
      </CircularProgress>,
    );

    const percentageContainer = container.querySelector('.absolute.w-14.top-7.left-\\[21px\\]');
    expect(percentageContainer).toBeInTheDocument();
    expect(percentageContainer?.textContent).toBe('75%');
  });

  it('does not display percentage text when no children provided', () => {
    const { container } = render(<CircularProgress value={75} />);

    const percentageContainer = container.querySelector('.absolute.w-14.top-7.left-\\[21px\\]');
    expect(percentageContainer).not.toBeInTheDocument();
  });

  it('applies correct color based on confidence level', () => {
    const { container, rerender } = render(<CircularProgress value={10} />);
    let progressPath = container.querySelectorAll('svg')[1]?.querySelector('path');
    expect(progressPath).toHaveAttribute('fill', '#FB3748'); // Red (0-30%)

    rerender(<CircularProgress value={40} />);
    progressPath = container.querySelectorAll('svg')[1]?.querySelector('path');
    expect(progressPath).toHaveAttribute('fill', '#FFA500'); // Orange (31-50%)

    rerender(<CircularProgress value={60} />);
    progressPath = container.querySelectorAll('svg')[1]?.querySelector('path');
    expect(progressPath).toHaveAttribute('fill', '#0EA5E9'); // Blue (51-70%)

    rerender(<CircularProgress value={80} />);
    progressPath = container.querySelectorAll('svg')[1]?.querySelector('path');
    expect(progressPath).toHaveAttribute('fill', '#00C851'); // Green (71-100%)
  });

  it('uses automatic color based on value (no custom color prop)', () => {
    const { container } = render(<CircularProgress value={50} />);

    const progressPath = container.querySelectorAll('svg')[1]?.querySelector('path');
    expect(progressPath).toHaveAttribute('fill', '#FFA500'); // Orange for 50%
  });

  it('handles different sizes correctly', () => {
    const { container, rerender } = render(<CircularProgress value={50} size={60} />);
    let svgElements = container.querySelectorAll('svg');
    expect(svgElements[0]).toHaveAttribute('width', '60');
    expect(svgElements[0]).toHaveAttribute('height', '30');
    expect(svgElements[0]).toHaveAttribute('viewBox', '0 0 60 30');

    rerender(<CircularProgress value={50} size={120} />);
    svgElements = container.querySelectorAll('svg');
    expect(svgElements[0]).toHaveAttribute('width', '120');
    expect(svgElements[0]).toHaveAttribute('height', '60');
    expect(svgElements[0]).toHaveAttribute('viewBox', '0 0 120 60');
  });

  it('clamps value between 0 and 100', () => {
    const { container } = render(<CircularProgress value={-10} />);
    // Check that there's no progress SVG when value is 0 or below
    const svgs1 = container.querySelectorAll('svg');
    expect(svgs1).toHaveLength(1); // Only background SVG

    const { container: container2 } = render(<CircularProgress value={150} />);
    // Check that full semicircle path is rendered for values >= 100
    const progressPath2 = container2.querySelectorAll('svg')[1]?.querySelector('path');
    expect(progressPath2?.getAttribute('d')).toContain('M0 49C0 36.015');
  });

  it('renders progress as a path element', () => {
    const { container } = render(<CircularProgress value={25} />);

    const progressPath = container.querySelectorAll('svg')[1]?.querySelector('path');
    expect(progressPath).toBeInTheDocument();
    // Path should be present for 25% value
    expect(progressPath?.getAttribute('d')).toBeTruthy();
  });

  it('renders different progress paths for different values', () => {
    const { container: container1 } = render(<CircularProgress value={0} />);
    const svgs1 = container1.querySelectorAll('svg');
    expect(svgs1).toHaveLength(1); // Only background SVG for 0%

    const { container: container2 } = render(<CircularProgress value={50} />);
    const progressPath2 = container2.querySelectorAll('svg')[1]?.querySelector('path');
    expect(progressPath2).toBeInTheDocument();

    const { container: container3 } = render(<CircularProgress value={100} />);
    const progressPath3 = container3.querySelectorAll('svg')[1]?.querySelector('path');
    expect(progressPath3?.getAttribute('d')).toContain('M0 49'); // Full semicircle
  });

  it('applies custom className', () => {
    const { container } = render(<CircularProgress value={50} className="custom-class" />);

    const mainDiv = container.querySelector('.relative.w-\\[98px\\].h-\\[52px\\]');
    expect(mainDiv).toHaveClass('custom-class');
  });

  it('renders with correct semicircle viewBox', () => {
    const { container } = render(<CircularProgress value={50} />);

    const svgElements = container.querySelectorAll('svg');
    expect(svgElements[0]).toHaveAttribute('viewBox', '0 0 98 49');
    expect(svgElements[1]).toHaveAttribute('viewBox', '0 0 98 49');
  });

  it('positions percentage text correctly when children provided', () => {
    const { container } = render(
      <CircularProgress value={50}>
        <span>50%</span>
      </CircularProgress>,
    );

    const percentageContainer = container.querySelector('.absolute.w-14.top-7.left-\\[21px\\]');
    expect(percentageContainer).toBeInTheDocument();
    expect(percentageContainer).toHaveClass('absolute', 'w-14', 'top-7', 'left-[21px]');
  });

  it('renders background semicircle with correct path', () => {
    const { container } = render(<CircularProgress value={50} />);

    const backgroundPath = container.querySelector('svg path');
    expect(backgroundPath).toBeInTheDocument();
    expect(backgroundPath).toHaveAttribute('fill', '#E1E4EA');
    // Check that background path starts with expected M98 49C98...
    expect(backgroundPath?.getAttribute('d')).toContain('M98 49C98');
  });

  it('renders background semicircle with gray color', () => {
    const { container } = render(<CircularProgress value={50} />);

    const backgroundPath = container.querySelectorAll('svg')[0]?.querySelector('path');
    expect(backgroundPath).toBeInTheDocument();
    expect(backgroundPath).toHaveAttribute('fill', '#E1E4EA');
  });

  it('handles edge case values correctly', () => {
    const testCases = [
      { value: 0, svgCount: 1 }, // Only background SVG
      { value: 0.5, svgCount: 2 }, // Background + progress
      { value: 99.9, svgCount: 2 },
      { value: 100, svgCount: 2 },
    ];

    testCases.forEach(({ value, svgCount }) => {
      const { container, unmount } = render(<CircularProgress value={value} />);
      const svgs = container.querySelectorAll('svg');
      expect(svgs).toHaveLength(svgCount);

      if (svgCount === 2) {
        const progressPath = svgs[1].querySelector('path');
        expect(progressPath).toBeInTheDocument();
      }

      unmount();
    });
  });
});
