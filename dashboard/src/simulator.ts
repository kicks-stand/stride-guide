import { DEFAULT_COLUMNS, DEFAULT_ROWS, type MatrixFrame } from './protocol';

export type Scenario = 'empty' | 'single' | 'moving' | 'left-foot' | 'two-feet' | 'dead-row' | 'dead-column' | 'noise' | 'saturated';

function gaussian(r: number, c: number, centerR: number, centerC: number, spreadR: number, spreadC: number, peak: number): number {
  const dr = (r - centerR) / spreadR;
  const dc = (c - centerC) / spreadC;
  return peak * Math.exp(-0.5 * (dr * dr + dc * dc));
}

function seededNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function simulateFrame(sequence: number, scenario: Scenario, rows = DEFAULT_ROWS, columns = DEFAULT_COLUMNS): MatrixFrame {
  const values = new Array<number>(rows * columns).fill(0);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      let value = 0;
      if (scenario === 'single') value = gaussian(r, c, 12, 12, 1.4, 1.4, 3200);
      if (scenario === 'moving') value = gaussian(r, c, 12, 3 + (sequence % 19), 1.5, 1.5, 3000);
      if (scenario === 'left-foot' || scenario === 'two-feet') {
        value += gaussian(r, c, 10, 7, 5.8, 2.3, 2600);
        value += gaussian(r, c, 19, 7, 2.7, 2.8, 3400);
      }
      if (scenario === 'two-feet') {
        value += gaussian(r, c, 10, 17, 5.8, 2.3, 2500);
        value += gaussian(r, c, 19, 17, 2.7, 2.8, 3300);
      }
      if (scenario === 'noise') value = seededNoise(sequence * 625 + r * columns + c) * 700;
      if (scenario === 'saturated' && r === 12 && c === 12) value = 4095;
      if (scenario === 'dead-row' && r === 12) value = 0;
      if (scenario === 'dead-column' && c === 12) value = 0;
      values[r * columns + c] = Math.max(0, Math.min(4095, Math.round(value)));
    }
  }
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return { protocolVersion: 1, type: 'matrix_frame', sequence, deviceUptimeMs: sequence * 100, rows, columns, scanDurationMs: 82, minimum, maximum, values };
}
