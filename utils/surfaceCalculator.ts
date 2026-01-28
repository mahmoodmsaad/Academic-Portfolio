import type { MetalEntry, SurfaceCellParams } from './matrixOptimizerTypes';
import { vecLength, vecDot, vecCross, vecScale, vecAdd, vecAngleDeg } from './matrixMath';

/**
 * Get primitive lattice vectors for a crystal structure.
 * Returns 3 vectors in Cartesian coordinates.
 */
function getPrimitiveVectors(metal: MetalEntry): number[][] {
  const a = metal.a0;

  switch (metal.structure) {
    case 'FCC':
      // FCC primitive vectors
      return [
        [0, a / 2, a / 2],
        [a / 2, 0, a / 2],
        [a / 2, a / 2, 0],
      ];

    case 'BCC':
      // BCC primitive vectors
      return [
        [-a / 2, a / 2, a / 2],
        [a / 2, -a / 2, a / 2],
        [a / 2, a / 2, -a / 2],
      ];

    case 'HCP': {
      // HCP conventional cell vectors
      const c = a * (metal.c_over_a || 1.633);
      return [
        [a, 0, 0],
        [-a / 2, a * Math.sqrt(3) / 2, 0],
        [0, 0, c],
      ];
    }
  }
}

/**
 * Get the surface normal vector in Cartesian coordinates.
 * For cubic systems (FCC/BCC), the Miller indices directly give the normal direction.
 * For HCP, we must use the reciprocal lattice.
 */
function getSurfaceNormal(metal: MetalEntry, h: number, k: number, l: number): number[] {
  if (metal.structure === 'FCC' || metal.structure === 'BCC') {
    // Cubic: normal is [h,k,l] (already in Cartesian)
    const len = Math.sqrt(h * h + k * k + l * l);
    return [h / len, k / len, l / len];
  }

  // HCP: compute from reciprocal lattice of the conventional cell
  const a = metal.a0;
  const c = a * (metal.c_over_a || 1.633);
  // Direct lattice vectors
  const a1 = [a, 0, 0];
  const a2 = [-a / 2, a * Math.sqrt(3) / 2, 0];
  const a3 = [0, 0, c];

  // Reciprocal vectors: b_i = 2*pi * (a_j x a_k) / (a_i . (a_j x a_k))
  const vol = vecDot(a1, vecCross(a2, a3));
  const b1 = vecScale(vecCross(a2, a3), 1 / vol);
  const b2 = vecScale(vecCross(a3, a1), 1 / vol);
  const b3 = vecScale(vecCross(a1, a2), 1 / vol);

  // Normal = h*b1 + k*b2 + l*b3
  const normal = vecAdd(vecAdd(vecScale(b1, h), vecScale(b2, k)), vecScale(b3, l));
  const len = vecLength(normal);
  return [normal[0] / len, normal[1] / len, normal[2] / len];
}

/**
 * Find the two shortest non-parallel lattice vectors that lie in the
 * plane perpendicular to the given surface normal.
 */
function findSurfaceVectors(
  metal: MetalEntry, h: number, k: number, l: number
): [number[], number[]] {
  const prim = getPrimitiveVectors(metal);
  const normal = getSurfaceNormal(metal, h, k, l);
  const searchRadius = 8;

  // Generate all lattice points in the primitive basis within search radius
  // and filter those that lie in the surface plane (dot with normal ~ 0)
  const inPlane: { vec: number[]; len: number }[] = [];

  for (let i = -searchRadius; i <= searchRadius; i++) {
    for (let j = -searchRadius; j <= searchRadius; j++) {
      for (let k2 = -searchRadius; k2 <= searchRadius; k2++) {
        if (i === 0 && j === 0 && k2 === 0) continue;

        const R = vecAdd(vecAdd(vecScale(prim[0], i), vecScale(prim[1], j)), vecScale(prim[2], k2));
        const proj = vecDot(R, normal);

        if (Math.abs(proj) < 1e-6) {
          inPlane.push({ vec: R, len: vecLength(R) });
        }
      }
    }
  }

  if (inPlane.length < 2) {
    throw new Error(`Could not find surface vectors for (${h}${k}${l}). Try lower Miller indices.`);
  }

  // Sort by length (shortest first)
  inPlane.sort((a, b) => a.len - b.len);

  // Pick the shortest as v1
  const v1 = inPlane[0].vec;

  // Pick the next shortest that is NOT parallel to v1
  let v2: number[] | null = null;
  for (let idx = 1; idx < inPlane.length; idx++) {
    const candidate = inPlane[idx].vec;
    const cross = vecCross(v1, candidate);
    if (vecLength(cross) > 1e-6) {
      v2 = candidate;
      break;
    }
  }

  if (!v2) {
    throw new Error(`Could not find two independent surface vectors for (${h}${k}${l}).`);
  }

  // Ensure right-handedness: cross(v1, v2) should align with the surface normal
  const crossProduct = vecCross(v1, v2);
  if (vecDot(crossProduct, normal) < 0) {
    v2 = vecScale(v2, -1);
  }

  return [v1, v2];
}

/**
 * Compute surface cell parameters for a metal surface with given Miller indices.
 * Returns targets for 1x1, 2x1, and 2x2 supercells.
 */
export function computeSurfaceTargets(
  metal: MetalEntry, h: number, k: number, l: number
): SurfaceCellParams[] {
  if (h === 0 && k === 0 && l === 0) {
    throw new Error('Miller indices cannot all be zero.');
  }

  const [v1, v2] = findSurfaceVectors(metal, h, k, l);

  const a = vecLength(v1);
  const b = vecLength(v2);
  const gamma = vecAngleDeg(v1, v2);
  const area = a * b * Math.sin(gamma * Math.PI / 180);

  return [
    { label: '1x1', a, b, gamma, area },
    { label: '2x2', a: 2 * a, b: 2 * b, gamma, area: 4 * area },
    { label: '3x3', a: 3 * a, b: 3 * b, gamma, area: 9 * area },
    { label: '4x4', a: 4 * a, b: 4 * b, gamma, area: 16 * area },
  ];
}
