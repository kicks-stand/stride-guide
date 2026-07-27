import { z } from 'zod';

export const DEFAULT_ROWS = 25;
export const DEFAULT_COLUMNS = 25;
export const CELL_COUNT = DEFAULT_ROWS * DEFAULT_COLUMNS;

export const MatrixFrameSchema = z.object({
  protocolVersion: z.literal(1),
  type: z.literal('matrix_frame'),
  sequence: z.number().int().nonnegative(),
  deviceUptimeMs: z.number().int().nonnegative(),
  rows: z.number().int().positive(),
  columns: z.number().int().positive(),
  scanDurationMs: z.number().nonnegative(),
  minimum: z.number(),
  maximum: z.number(),
  values: z.array(z.number().int().nonnegative()),
}).superRefine((frame, ctx) => {
  if (frame.values.length !== frame.rows * frame.columns) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Frame length does not match dimensions' });
  }
});

export type MatrixFrame = z.infer<typeof MatrixFrameSchema>;
export type Rotation = 0 | 90 | 180 | 270;

export function indexOf(row: number, column: number, columns: number): number {
  return row * columns + column;
}

export function transformCoordinate(
  row: number,
  column: number,
  rows: number,
  columns: number,
  rotation: Rotation,
  mirrorX: boolean,
  mirrorY: boolean,
): [number, number] {
  let r = row;
  let c = column;
  let outRows = rows;
  let outColumns = columns;
  if (rotation === 90) { [r, c] = [column, rows - 1 - row]; outRows = columns; outColumns = rows; }
  if (rotation === 180) { r = rows - 1 - row; c = columns - 1 - column; }
  if (rotation === 270) { [r, c] = [columns - 1 - column, row]; outRows = columns; outColumns = rows; }
  if (mirrorX) c = outColumns - 1 - c;
  if (mirrorY) r = outRows - 1 - r;
  return [r, c];
}

export function parseLine(line: string): MatrixFrame | null {
  try { return MatrixFrameSchema.parse(JSON.parse(line)); } catch { return null; }
}
