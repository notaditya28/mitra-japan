// Kept apart from petalShape.ts so the 2D petals never pull three.js into the first-paint bundle.
import * as THREE from 'three';
import { PETAL_POINTS } from './petalShape';

/** Unit petal as a flat mesh, ~0.12 units long. */
export function petalGeometry(): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  for (const [a, b, c, d, x, y] of PETAL_POINTS) shape.bezierCurveTo(a, b, c, d, x, y);
  const geo = new THREE.ShapeGeometry(shape, 6);
  geo.translate(0, -0.5, 0);
  geo.scale(0.12, 0.12, 0.12);
  return geo;
}
