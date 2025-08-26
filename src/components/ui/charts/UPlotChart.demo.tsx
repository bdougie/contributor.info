import React, { useState, useCallback } from 'react';
import { UPlotChart } from './UPlotChart';
import type { AlignedData, Options } from 'uplot';

/**
 * Demo component showcasing UPlotChart usage
 * This can be used as a reference for implementing charts throughout the app
 */
export const UPlotChartDemo: React.FC = () => {
  // Generate sample data
  const generateData = (points: number = 50): AlignedData => {
    const x = Array.from({ length: points }, (_, i) => i);
    const y1 = Array.from(
      { length: points },
      (_, i) => Math.sin(i * 0.1) * 50 + 50 + Math.random() * 10,
    );
    const y2 = Array.from(
      { length: points },
      (_, i) => Math.cos(i * 0.1) * 30 + 50 + Math.random() * 10,
    );

    return [x, y1, y2];
  };

  const [data, setData] = useState<AlignedData>(generateData());
  const [isResponsive, setIsResponsive] = useState(true);

  // Chart configuration (without width/height which are added by the component)
  const options: Omit<Options, 'width' | 'height'> = {
    title: 'Sample Chart - Contributors Over Time',
    scales: {
      x: {
        time: false,
      },
    },
    series: [
      {
        label: 'Time',
      },
      {
        label: 'Active Contributors',
        stroke: 'rgb(59, 130, 246)', // blue-500
        width: 2,
        points: {
          show: false,
        },
      },
      {
        label: 'New Contributors',
        stroke: 'rgb(16, 185, 129)', // green-500
        width: 2,
        points: {
          show: false,
        },
      },
    ],
    axes: [
      {
        label: 'Days',
        stroke: 'rgb(107, 114, 128)', // gray-500
        grid: {
          show: true,
          stroke: 'rgba(107, 114, 128, 0.1)',
        },
      },
      {
        label: 'Count',
        stroke: 'rgb(107, 114, 128)', // gray-500
        grid: {
          show: true,
          stroke: 'rgba(107, 114, 128, 0.1)',
        },
      },
    ],
    cursor: {
      show: true,
      points: {
        show: true,
      },
    },
    legend: {
      show: true,
      live: true,
    },
  };

  const handleRegenerateData = useCallback(() => {
    setData(generateData());
  }, []);

  const handleChartReady = useCallback((chart: unknown) => {
    console.log('Chart is ready:', chart);
  }, []);

  const handleChartDestroy = useCallback(() => {
    console.log('Chart was destroyed');
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">uPlot Chart Demo</h2>

        <div className="flex gap-4">
          <button
            onClick={handleRegenerateData}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Regenerate Data
          </button>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isResponsive}
              onChange={(e) => setIsResponsive(e.target.checked)}
              className="rounded"
            />
            <span>Responsive</span>
          </label>
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-white shadow-sm">
        <UPlotChart
          data={data}
          options={options}
          height={400}
          responsive={isResponsive}
          onReady={handleChartReady}
          onDestroy={handleChartDestroy}
          className="chart-demo"
        />
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <h3 className="font-semibold text-gray-800">Features Demonstrated:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Responsive sizing (toggle with checkbox)</li>
          <li>Multiple data series</li>
          <li>Interactive cursor with live legend</li>
          <li>Grid lines and axes labels</li>
          <li>Dynamic data updates</li>
          <li>Proper lifecycle management (check console for ready/destroy events)</li>
        </ul>
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <h3 className="font-semibold text-gray-800">Integration Notes:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Chart automatically cleans up on unmount (no memory leaks)</li>
          <li>ResizeObserver handles responsive behavior</li>
          <li>CSS is imported automatically from uPlot</li>
          <li>TypeScript support with proper typing</li>
        </ul>
      </div>
    </div>
  );
};
