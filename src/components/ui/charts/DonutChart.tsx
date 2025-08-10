import React, { useRef, useEffect, useState, useCallback } from 'react';

export interface DonutChartData {
  id: string;
  label: string;
  value: number;
  percentage: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutChartData[];
  width?: number;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  className?: string;
  onClick?: (segment: DonutChartData) => void;
  onHover?: (segment: DonutChartData | null) => void;
  activeSegmentId?: string | null;
  showLabel?: boolean;
  centerLabel?: string;
  centerSubLabel?: string;
  responsive?: boolean;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  width: propWidth = 400,
  height: propHeight = 400,
  innerRadius = 60,
  outerRadius = 120,
  className = '',
  onClick,
  onHover,
  activeSegmentId,
  showLabel = true,
  centerLabel,
  centerSubLabel,
  responsive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: propWidth, height: propHeight });
  const animationRef = useRef<number | null>(null);
  const progressRef = useRef<number>(0);
  const [focusedSegmentIndex, setFocusedSegmentIndex] = useState<number>(-1);
  const isMountedRef = useRef<boolean>(true);

  // Calculate actual dimensions based on container size
  const updateDimensions = useCallback(() => {
    if (!responsive || !containerRef.current) {
      setDimensions({ width: propWidth, height: propHeight });
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const size = Math.min(rect.width || propWidth, propHeight);
    setDimensions({ width: size, height: size });
  }, [responsive, propWidth, propHeight]);

  // Handle resize
  useEffect(() => {
    if (!responsive) return;

    const handleResize = () => {
      requestAnimationFrame(updateDimensions);
    };

    updateDimensions();
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [updateDimensions, responsive]);

  // Calculate segments
  const calculateSegments = useCallback(() => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = -Math.PI / 2; // Start at top

    return data.map(item => {
      const percentage = total > 0 ? (item.value / total) : 0;
      const angle = percentage * Math.PI * 2;
      const segment = {
        ...item,
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
        percentage: percentage * 100,
      };
      currentAngle += angle;
      return segment;
    });
  }, [data]);

  // Draw the chart with error handling
  const draw = useCallback((progress: number = 1) => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('DonutChart: Unable to get 2D context from canvas');
        return;
      }

      const segments = calculateSegments();
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      const scaledOuterRadius = Math.min(dimensions.width, dimensions.height) / 2 * 0.8;
      const scaledInnerRadius = scaledOuterRadius * (innerRadius / outerRadius);

      // Clear canvas
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Enable anti-aliasing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw segments
    segments.forEach(segment => {
      const isActive = segment.id === activeSegmentId;
      const isHovered = segment.id === hoveredSegment;
      const segmentOuterRadius = isActive || isHovered ? scaledOuterRadius * 1.05 : scaledOuterRadius;

      // Calculate animation progress for this segment
      const segmentProgress = Math.min(1, progress * segments.length);
      const segmentEndAngle = segment.startAngle + (segment.endAngle - segment.startAngle) * segmentProgress;

      ctx.beginPath();
      ctx.arc(centerX, centerY, segmentOuterRadius, segment.startAngle, segmentEndAngle);
      ctx.arc(centerX, centerY, scaledInnerRadius, segmentEndAngle, segment.startAngle, true);
      ctx.closePath();

      // Fill segment
      ctx.fillStyle = segment.color;
      ctx.fill();

      // Add stroke for active/hovered segments
      if (isActive || isHovered) {
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--foreground') || '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw percentage labels
      if (showLabel && segment.percentage > 5 && progress === 1) {
        const labelAngle = (segment.startAngle + segment.endAngle) / 2;
        const labelRadius = (scaledInnerRadius + segmentOuterRadius) / 2;
        const labelX = centerX + Math.cos(labelAngle) * labelRadius;
        const labelY = centerY + Math.sin(labelAngle) * labelRadius;

        ctx.fillStyle = '#fff';
        ctx.font = `${Math.max(12, dimensions.width / 30)}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${segment.percentage.toFixed(0)}%`, labelX, labelY);
      }
    });

    // Draw center labels
    if (centerLabel && progress === 1) {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--foreground') || '#000';
      ctx.font = `bold ${Math.max(20, dimensions.width / 15)}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(centerLabel, centerX, centerY - (centerSubLabel ? 10 : 0));

      if (centerSubLabel) {
        ctx.font = `${Math.max(12, dimensions.width / 25)}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground') || '#666';
        ctx.fillText(centerSubLabel, centerX, centerY + 15);
      }
    }
    } catch (error) {
      console.error('DonutChart: Error during canvas rendering', error);
    }
  }, [data, dimensions, innerRadius, outerRadius, activeSegmentId, hoveredSegment, showLabel, centerLabel, centerSubLabel, calculateSegments]);

  // Animation loop with proper cleanup
  const animate = useCallback(() => {
    if (!isMountedRef.current) return;
    
    progressRef.current = Math.min(1, progressRef.current + 0.05);
    draw(progressRef.current);

    if (progressRef.current < 1 && isMountedRef.current) {
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [draw]);

  // Initial draw with animation and cleanup
  useEffect(() => {
    isMountedRef.current = true;
    progressRef.current = 0;
    animate();

    return () => {
      isMountedRef.current = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [animate]);

  // Redraw on data or state changes
  useEffect(() => {
    if (progressRef.current === 1) {
      draw(1);
    }
  }, [draw, activeSegmentId, hoveredSegment]);

  // Handle mouse events
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    // Calculate distance from center
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const scaledOuterRadius = Math.min(dimensions.width, dimensions.height) / 2 * 0.8;
    const scaledInnerRadius = scaledOuterRadius * (innerRadius / outerRadius);

    // Check if within donut area
    if (distance < scaledInnerRadius || distance > scaledOuterRadius * 1.05) {
      if (hoveredSegment) {
        setHoveredSegment(null);
        onHover?.(null);
      }
      canvas.style.cursor = 'default';
      return;
    }

    // Calculate angle
    let angle = Math.atan2(dy, dx);
    if (angle < -Math.PI / 2) angle += Math.PI * 2;

    // Find segment at this angle
    const segments = calculateSegments();
    const segment = segments.find(s => angle >= s.startAngle && angle <= s.endAngle);

    if (segment) {
      canvas.style.cursor = 'pointer';
      if (hoveredSegment !== segment.id) {
        setHoveredSegment(segment.id);
        onHover?.(segment);
      }
    } else {
      canvas.style.cursor = 'default';
      if (hoveredSegment) {
        setHoveredSegment(null);
        onHover?.(null);
      }
    }
  }, [dimensions, innerRadius, outerRadius, hoveredSegment, onHover, calculateSegments]);

  const handleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    // Calculate distance and angle
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const scaledOuterRadius = Math.min(dimensions.width, dimensions.height) / 2 * 0.8;
    const scaledInnerRadius = scaledOuterRadius * (innerRadius / outerRadius);

    if (distance < scaledInnerRadius || distance > scaledOuterRadius * 1.05) return;

    let angle = Math.atan2(dy, dx);
    if (angle < -Math.PI / 2) angle += Math.PI * 2;

    const segments = calculateSegments();
    const segment = segments.find(s => angle >= s.startAngle && angle <= s.endAngle);

    if (segment && onClick) {
      onClick(segment);
    }
  }, [dimensions, innerRadius, outerRadius, onClick, calculateSegments]);

  const handleMouseLeave = useCallback(() => {
    if (hoveredSegment) {
      setHoveredSegment(null);
      onHover?.(null);
    }
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default';
    }
  }, [hoveredSegment, onHover]);

  // Keyboard navigation handlers
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const segments = calculateSegments();
    if (segments.length === 0) return;

    let newIndex = focusedSegmentIndex;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        newIndex = (focusedSegmentIndex + 1) % segments.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        newIndex = focusedSegmentIndex <= 0 ? segments.length - 1 : focusedSegmentIndex - 1;
        break;
      case 'Enter':
      case ' ':
        if (focusedSegmentIndex >= 0 && focusedSegmentIndex < segments.length) {
          event.preventDefault();
          const segment = segments[focusedSegmentIndex];
          onClick?.(segment);
        }
        break;
      case 'Escape':
        setFocusedSegmentIndex(-1);
        setHoveredSegment(null);
        break;
      default:
        return;
    }

    if (newIndex !== focusedSegmentIndex) {
      setFocusedSegmentIndex(newIndex);
      if (newIndex >= 0 && newIndex < segments.length) {
        const segment = segments[newIndex];
        setHoveredSegment(segment.id);
        onHover?.(segment);
      }
    }
  }, [focusedSegmentIndex, onClick, onHover, calculateSegments]);

  // Generate accessible description
  const getAriaLabel = useCallback(() => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const description = data.map(item => 
      `${item.label}: ${item.value} (${item.percentage.toFixed(1)}%)`
    ).join(', ');
    return `Donut chart showing distribution. Total: ${total}. ${description}`;
  }, [data]);

  return (
    <div 
      ref={containerRef}
      className={`donut-chart ${className}`}
      style={{ width: responsive ? '100%' : propWidth }}
    >
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        style={{ maxWidth: '100%', height: 'auto' }}
        role="img"
        aria-label={getAriaLabel()}
        tabIndex={0}
        aria-describedby="donut-chart-description"
      />
      <span id="donut-chart-description" className="sr-only">
        Use arrow keys to navigate between segments. Press Enter or Space to select a segment. Press Escape to clear selection.
      </span>
    </div>
  );
};