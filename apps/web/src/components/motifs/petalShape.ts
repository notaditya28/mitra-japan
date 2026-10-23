/**
 * Sakura petal outline: a rounded teardrop with the characteristic notch at the
 * tip. Coordinates are in a unit box (base at 0,0, tip at 0,1).
 */
export const PETAL_POINTS: ReadonlyArray<
  readonly [number, number, number, number, number, number]
> = [
  // [cp1x, cp1y, cp2x, cp2y, x, y] cubic segments starting from (0, 0)
  [0.42, 0.12, 0.55, 0.62, 0.3, 0.98],
  [0.2, 1.02, 0.1, 0.94, 0, 0.86], // notch
  [-0.1, 0.94, -0.2, 1.02, -0.3, 0.98],
  [-0.55, 0.62, -0.42, 0.12, 0, 0],
];

export function tracePetal(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.beginPath();
  ctx.moveTo(0, -size / 2);
  for (const [a, b, c, d, x, y] of PETAL_POINTS) {
    ctx.bezierCurveTo(
      a * size,
      b * size - size / 2,
      c * size,
      d * size - size / 2,
      x * size,
      y * size - size / 2,
    );
  }
  ctx.closePath();
}
