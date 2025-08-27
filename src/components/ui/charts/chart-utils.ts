/**
 * Chart utility functions for data processing and color handling
 */

/**
 * Convert a color to RGBA format with alpha channel
 * Handles hex colors, rgb(), rgba(), named colors, etc.
 */
export function colorWithAlpha(color: string, alpha: number): string {
  // If already an rgba color, replace the alpha
  if (color.startsWith('rgba(')) {
    return color.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
  }

  // If rgb color, convert to rgba
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }

  // If hex color (3 or 6 digits), convert to rgba
  const hexMatch = color.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) {
    let hex = hexMatch[1];

    // Convert 3-digit hex to 6-digit
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // For other color formats (named colors, hsl, etc.), use CSS custom property approach
  // This creates a valid CSS color that browsers can handle
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

/**
 * Convert labels to numeric values for uPlot x-axis
 * uPlot requires numeric x-axis values, so we convert strings to indices
 */
export function processLabelsForUPlot(labels: (string | number)[]): {
  numericLabels: number[];
  labelMap: Map<number, string>;
} {
  const numericLabels: number[] = [];
  const labelMap = new Map<number, string>();

  labels.forEach((label, index) => {
    if (typeof label === 'number') {
      numericLabels.push(label);
      labelMap.set(label, label.toString());
    } else {
      // Convert string labels to indices
      numericLabels.push(index);
      labelMap.set(index, label);
    }
  });

  return { numericLabels, labelMap };
}

/**
 * Create axis configuration with proper label formatting for uPlot axes
 */
export function createAxisValuesFormatter(labelMap: Map<number, string>) {
  return labelMap.size > 0
    ? (_self: any, splits: number[], _axisIdx: number, _foundSpace: number, _foundIncr: number) =>
        splits.map((split) => labelMap.get(split) || split.toString())
    : undefined;
}
