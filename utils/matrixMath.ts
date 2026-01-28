import type { BaseAtom, ErrorTier } from './matrixOptimizerTypes';

// === Vector math helpers (3D) ===

export function vecLength(v: number[]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

export function vecDot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vecCross(a: number[], b: number[]): number[] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function vecScale(v: number[], s: number): number[] {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function vecAdd(a: number[], b: number[]): number[] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vecAngleDeg(a: number[], b: number[]): number {
  const cosAngle = vecDot(a, b) / (vecLength(a) * vecLength(b));
  return Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
}

// === Supercell parameter computation ===

export interface SupercellResult {
  a_super: number;
  b_super: number;
  gamma_super: number;
  det: number;
}

/**
 * Compute supercell lattice parameters from a 2D transformation matrix
 * applied to a monolayer with primitive cell (a, b, gamma).
 *
 * Matrix is [[n, m], [k, l]] applied as:
 *   v1_super = n * v1 + m * v2
 *   v2_super = k * v1 + l * v2
 */
export function computeSupercellParams(
  a: number, b: number, gammaDeg: number,
  n: number, m: number, k: number, l: number
): SupercellResult {
  const gammaRad = gammaDeg * Math.PI / 180;
  const cosG = Math.cos(gammaRad);
  const sinG = Math.sin(gammaRad);

  // Primitive cell vectors (2D): v1 = (a, 0), v2 = (b*cosG, b*sinG)
  const sx1 = n * a + m * b * cosG;
  const sy1 = m * b * sinG;
  const sx2 = k * a + l * b * cosG;
  const sy2 = l * b * sinG;

  const a_super = Math.sqrt(sx1 * sx1 + sy1 * sy1);
  const b_super = Math.sqrt(sx2 * sx2 + sy2 * sy2);

  const dot2d = sx1 * sx2 + sy1 * sy2;
  const cosGamma = dot2d / (a_super * b_super);
  const gamma_super = Math.acos(Math.max(-1, Math.min(1, cosGamma))) * (180 / Math.PI);

  const det = n * l - m * k;

  return { a_super, b_super, gamma_super, det };
}

// === Scoring ===

export interface ScoreResult {
  score: number;
  error_a_pct: number;
  error_b_pct: number;
  error_gamma_pct: number;
}

export function scoreMatrix(
  achieved_a: number, achieved_b: number, achieved_gamma: number,
  target_a: number, target_b: number, target_gamma: number,
  atom_count: number
): ScoreResult {
  const error_a_pct = Math.abs(achieved_a - target_a) / target_a * 100;
  const error_b_pct = Math.abs(achieved_b - target_b) / target_b * 100;
  const error_gamma_pct = Math.abs(achieved_gamma - target_gamma) / target_gamma * 100;

  // Penalty for exceeding thresholds
  let penalty = 0;
  if (error_a_pct > 5) penalty += 10 * (error_a_pct - 5);
  if (error_b_pct > 5) penalty += 10 * (error_b_pct - 5);
  if (error_gamma_pct > 5) penalty += 5 * (error_gamma_pct - 5);

  // Atom count penalty (prefer fewer atoms)
  const atomPenalty = (atom_count / 1000) * 0.2;

  const score = error_a_pct + error_b_pct + 1.5 * error_gamma_pct + penalty + atomPenalty;
  return { score, error_a_pct, error_b_pct, error_gamma_pct };
}

export function classifyTier(error_a: number, error_b: number, error_gamma: number): ErrorTier {
  const maxError = Math.max(error_a, error_b, error_gamma);
  if (maxError < 1) return 'excellent';
  if (maxError < 3) return 'good';
  if (maxError < 5) return 'acceptable';
  return 'marginal';
}

// === CIF lattice parameter parsing ===

function parseCifNumber(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/^\s+|\s+$/g, '').replace(/\(.*\)/, '');
  if (!cleaned || cleaned === '?' || cleaned === '.') return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function tokenizeCifLine(line: string): string[] {
  const matches = line.match(/'(?:[^']*)'|"(?:[^"]*)"|\S+/g);
  if (!matches) return [];
  return matches.map(token => token.replace(/^['"]|['"]$/g, ''));
}

function extractElementSymbol(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^A-Za-z]/g, '');
  const match = cleaned.match(/[A-Z][a-z]?/);
  return match ? match[0] : null;
}

export function parseCIFLatticeParams(content: string): { a: number; b: number; gamma: number; atoms: BaseAtom[] } {
  const lines = content.split('\n');
  let a = 0;
  let b = 0;
  let gamma = 90;
  const atoms: BaseAtom[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.startsWith('_cell_length_a')) {
      const val = line.split(/\s+/)[1];
      const parsed = parseCifNumber(val);
      if (parsed !== null) a = parsed;
      i += 1;
      continue;
    }
    if (line.startsWith('_cell_length_b')) {
      const val = line.split(/\s+/)[1];
      const parsed = parseCifNumber(val);
      if (parsed !== null) b = parsed;
      i += 1;
      continue;
    }
    if (line.startsWith('_cell_angle_gamma')) {
      const val = line.split(/\s+/)[1];
      const parsed = parseCifNumber(val);
      if (parsed !== null) gamma = parsed;
      i += 1;
      continue;
    }

    if (line.toLowerCase() === 'loop_') {
      const headers: string[] = [];
      i += 1;
      while (i < lines.length && lines[i].trim().startsWith('_')) {
        headers.push(lines[i].trim().split(/\s+/)[0]);
        i += 1;
      }

      const headerIndex = new Map<string, number>();
      headers.forEach((header, idx) => headerIndex.set(header, idx));
      const hasAtomLoop =
        headerIndex.has('_atom_site_fract_x') &&
        headerIndex.has('_atom_site_fract_y');

      while (i < lines.length) {
        const dataLine = lines[i].trim();
        if (!dataLine || dataLine.startsWith('#')) {
          i += 1;
          continue;
        }
        if (dataLine.toLowerCase() === 'loop_' || dataLine.startsWith('_') || dataLine.startsWith('data_')) {
          break;
        }

        if (hasAtomLoop) {
          const tokens = tokenizeCifLine(dataLine);
          if (tokens.length >= headers.length) {
            const symbol =
              extractElementSymbol(tokens[headerIndex.get('_atom_site_type_symbol') ?? -1]) ??
              extractElementSymbol(tokens[headerIndex.get('_atom_site_label') ?? -1]);
            const x = parseCifNumber(tokens[headerIndex.get('_atom_site_fract_x') ?? -1]);
            const y = parseCifNumber(tokens[headerIndex.get('_atom_site_fract_y') ?? -1]);
            const z = parseCifNumber(tokens[headerIndex.get('_atom_site_fract_z') ?? -1]);

            if (symbol && x !== null && y !== null) {
              atoms.push({
                symbol,
                x,
                y,
                z: z !== null ? z : 0.5,
              });
            }
          }
        }
        i += 1;
      }

      continue;
    }

    i += 1;
  }

  if (a === 0 || b === 0) {
    throw new Error('Could not find valid cell parameters (a, b) in CIF file');
  }

  return { a, b, gamma, atoms };
}
