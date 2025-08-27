import React, { useEffect, useRef, useCallback, useState } from 'react';
import uPlot, { Options, AlignedData } from 'uplot';
import 'uplot/dist/uPlot.min.css';

export interface UPlotChartProps {
  data: AlignedData;
  options: Omit<Options, 'width' | 'height'>;
  width?: number;
  height?: number;
  className?: string;
  onReady?: (chart: uPlot) => void;
  onDestroy?: () => void;
  responsive?: boolean;
}

/**
 * React wrapper for uPlot charting library
 * Handles proper lifecycle management and responsive sizing
 */
export const UPlotChart: React.FC<UPlotChartProps> = ({
  data,
  options,
  width: propWidth,
  height: propHeight = 300,
  className = '',
  onReady,
  onDestroy,
  responsive = true,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [actualDimensions, setActualDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Calculate chart dimensions
  const getDimensions = useCallback(() => {
    if (!responsive || !chartRef.current) {
      return { width: propWidth || 600, height: propHeight };
    }

    const rect = chartRef.current.getBoundingClientRect();
    return {
      width: propWidth || rect.width || 600,
      height: propHeight,
    };
  }, [responsive, propWidth, propHeight]);

  // Handle chart resize
  const handleResize = useCallback(() => {
    if (!plotRef.current) return;

    // Only resize if in responsive mode
    if (!responsive) return;

    const { width, height } = getDimensions();
    plotRef.current.setSize({ width, height });
    // Don't update state when responsive is true to avoid unnecessary re-renders
  }, [getDimensions, responsive]);

  // Initialize chart
  useEffect(() => {
    if (!chartRef.current || !data) return;

    // Clean up existing chart
    if (plotRef.current && typeof plotRef.current.destroy === 'function') {
      plotRef.current.destroy();
      plotRef.current = null;
    }

    // Create new chart instance
    const { width, height } = getDimensions();
    const plot = new uPlot(
      {
        ...options,
        width,
        height,
      },
      data,
      chartRef.current
    );

    plotRef.current = plot;
    setActualDimensions({ width, height });

    // Notify parent component
    if (onReady) {
      onReady(plot);
    }

    // Set up ResizeObserver for responsive behavior
    if (responsive && window.ResizeObserver) {
      resizeObserverRef.current = new ResizeObserver(() => {
        requestAnimationFrame(handleResize);
      });
      resizeObserverRef.current.observe(chartRef.current);
    }

    // Cleanup function
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      if (plotRef.current && typeof plotRef.current.destroy === 'function') {
        plotRef.current.destroy();
        plotRef.current = null;
      }

      if (onDestroy) {
        onDestroy();
      }
    };
  }, [data, options, getDimensions, handleResize, onReady, onDestroy, responsive]);

  // Update data when it changes (skip initial render)
  useEffect(() => {
    // Skip if chart hasn't been created yet or no data
    if (!plotRef.current || !data) return;

    // Only update data if the chart instance exists and is not being recreated
    const chart = plotRef.current;
    if (chart && typeof chart.setData === 'function') {
      chart.setData(data);
    }
  }, [data]);

  // Handle window resize
  useEffect(() => {
    if (!responsive) return;

    const handleWindowResize = () => {
      requestAnimationFrame(handleResize);
    };

    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [handleResize, responsive]);

  // Calculate wrapper div styles
  const wrapperStyle: React.CSSProperties = responsive
    ? { width: '100%' }
    : { width: propWidth ?? actualDimensions?.width ?? 600 };

  return <div ref={chartRef} className={`uplot-chart ${className}`} style={wrapperStyle} />;
};
