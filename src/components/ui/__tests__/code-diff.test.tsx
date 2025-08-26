import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { InlineCodeDiff } from '../code-diff';

describe('InlineCodeDiff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render addition and deletion counts', () => {
    render(<InlineCodeDiff additions={36} deletions={10} />);
    expect(screen.getByText('+36')).toBeInTheDocument();
    expect(screen.getByText('-10')).toBeInTheDocument();
  });

  it('should render exactly 5 boxes', () => {
    const { container } = render(<InlineCodeDiff additions={50} deletions={50} />);
    const boxes = container.querySelectorAll('[aria-label]');
    expect(boxes.length).toBe(5);
  });

  it('should show all green boxes for only additions', () => {
    const { container } = render(<InlineCodeDiff additions={100} deletions={0} />);
    const greenBoxes = container.querySelectorAll('[aria-label="Added lines"]');
    expect(greenBoxes.length).toBe(5);
  });

  it('should show all red boxes for only deletions', () => {
    const { container } = render(<InlineCodeDiff additions={0} deletions={100} />);
    const redBoxes = container.querySelectorAll('[aria-label="Deleted lines"]');
    expect(redBoxes.length).toBe(5);
  });

  it('should show all gray boxes when no changes', () => {
    const { container } = render(<InlineCodeDiff additions={0} deletions={0} />);
    const grayBoxes = container.querySelectorAll('[aria-label="Unchanged ratio"]');
    expect(grayBoxes.length).toBe(5);
  });

  it('should apply custom className', () => {
    const { container } = render(
      <InlineCodeDiff additions={10} deletions={5} className="custom-class" />,
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
