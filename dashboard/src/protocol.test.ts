import { describe, expect, it } from 'vitest';
import { CELL_COUNT, DEFAULT_COLUMNS, DEFAULT_ROWS, indexOf, parseLine, transformCoordinate } from './protocol';
import { simulateFrame } from './simulator';

describe('25x25 matrix contract', () => {
  it('contains 625 sensing intersections', () => {
    expect(DEFAULT_ROWS).toBe(25);
    expect(DEFAULT_COLUMNS).toBe(25);
    expect(CELL_COUNT).toBe(625);
    expect(simulateFrame(1, 'two-feet').values).toHaveLength(625);
  });

  it('uses row-major indexing', () => {
    expect(indexOf(0, 0, 25)).toBe(0);
    expect(indexOf(1, 0, 25)).toBe(25);
    expect(indexOf(24, 24, 25)).toBe(624);
  });

  it('transforms orientation deterministically', () => {
    expect(transformCoordinate(0, 0, 25, 25, 90, false, false)).toEqual([0, 24]);
    expect(transformCoordinate(0, 0, 25, 25, 180, false, false)).toEqual([24, 24]);
    expect(transformCoordinate(0, 0, 25, 25, 270, false, false)).toEqual([24, 0]);
    expect(transformCoordinate(4, 8, 25, 25, 0, true, false)).toEqual([4, 16]);
  });

  it('rejects frames with an invalid cell count', () => {
    const frame = simulateFrame(1, 'empty');
    expect(parseLine(JSON.stringify(frame))).not.toBeNull();
    expect(parseLine(JSON.stringify({ ...frame, values: [1, 2] }))).toBeNull();
  });

  it('generates dead-row and saturation faults', () => {
    const dead = simulateFrame(1, 'dead-row');
    expect(dead.values.slice(12 * 25, 13 * 25).every((value) => value === 0)).toBe(true);
    expect(simulateFrame(1, 'saturated').maximum).toBe(4095);
  });
});
