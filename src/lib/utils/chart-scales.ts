/**
 * Minimal scale + tick helpers for the hand-rolled contributions scatter plot.
 *
 * Replaces @nivo/scatterplot (and the d3 stack it dragged in) for the one
 * chart that used it (#1815 Phase 3). Tick generation follows d3-array's
 * ticks/tickIncrement algorithm so axis labels look identical to what the
 * d3-backed chart produced.
 */

const E10 = Math.sqrt(50);
const E5 = Math.sqrt(10);
const E2 = Math.sqrt(2);

function tickIncrement(start: number, stop: number, count: number): number {
  const step = (stop - start) / Math.max(0, count);
  const power = Math.floor(Math.log10(step));
  const error = step / 10 ** power;

  let factor = 1;
  if (error >= E10) {
    factor = 10;
  } else if (error >= E5) {
    factor = 5;
  } else if (error >= E2) {
    factor = 2;
  }

  return power >= 0 ? factor * 10 ** power : -(10 ** -power) / factor;
}

/**
 * "Nice" linear tick values across [min, max], d3-style: steps are 1, 2, or
 * 5 times a power of ten, and ticks land on multiples of the step.
 */
export function niceLinearTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || count <= 0 || min >= max) {
    return [];
  }

  const step = tickIncrement(min, max, count);
  const ticks: number[] = [];

  if (step > 0) {
    const start = Math.ceil(min / step);
    const stop = Math.floor(max / step);
    for (let i = start; i <= stop; i++) {
      ticks.push(i * step);
    }
  } else {
    const inv = -step;
    const start = Math.ceil(min * inv);
    const stop = Math.floor(max * inv);
    for (let i = start; i <= stop; i++) {
      ticks.push(i / inv);
    }
  }

  return ticks;
}

/**
 * Symmetric-log transform with constant 1 — the same curve d3's scaleSymlog
 * (and therefore nivo's `symlog` scale) uses by default:
 * sign(v) * log1p(|v|).
 */
export function symlog(value: number): number {
  return Math.sign(value) * Math.log1p(Math.abs(value));
}

/**
 * Map a domain value to a pixel offset within [0, rangeSize].
 *
 * - `log: true` positions values on the symlog curve (the chart's
 *   "Enhanced" mode); linear otherwise.
 * - The result is NOT clamped — callers clamp or clip as needed.
 */
export function scaleValue(
  value: number,
  domainMin: number,
  domainMax: number,
  rangeSize: number,
  log = false
): number {
  const transform = log ? symlog : (v: number) => v;
  const t0 = transform(domainMin);
  const t1 = transform(domainMax);
  if (t1 === t0) return 0;
  return ((transform(value) - t0) / (t1 - t0)) * rangeSize;
}
