// Crystal system types
export type CrystalStructure = 'FCC' | 'BCC' | 'HCP';
export type CrystalSystem = 'hexagonal' | 'rectangular' | 'oblique';
export type ErrorTier = 'excellent' | 'good' | 'acceptable' | 'marginal';
export type WizardStep = 'surface' | 'monolayer' | 'optimize' | 'results';

// Metal database entry
export interface MetalEntry {
  symbol: string;
  name: string;
  a0: number; // conventional lattice constant (Angstroms)
  structure: CrystalStructure;
  c_over_a?: number; // only for HCP
}

// Surface cell parameters for a target
export interface SurfaceCellParams {
  label: string; // e.g. "1x1", "2x2", "3x3", "4x4"
  a: number;
  b: number;
  gamma: number; // degrees
  area: number;
  cif?: string; // CIF file content from ASE (metal surface slab)
}

// Base atom in a unit cell (fractional coordinates)
export interface BaseAtom {
  symbol: string;  // Element symbol (e.g., 'C', 'Si', 'Mo', 'S')
  x: number;       // Fractional x (0-1)
  y: number;       // Fractional y (0-1)
  z: number;       // Fractional z (typically 0.5 for 2D)
}

// Monolayer material definition
export interface MonolayerMaterial {
  name: string;
  a: number;
  b: number;
  gamma: number; // degrees
  atoms_per_cell: number;
  crystal_system: CrystalSystem;
  baseAtoms?: BaseAtom[]; // Atomic positions in fractional coordinates
}

// Single optimization result
export interface MatrixResult {
  matrix: [number, number, number, number]; // [n, m, k, l]
  achieved_a: number;
  achieved_b: number;
  achieved_gamma: number;
  error_a_pct: number;
  error_b_pct: number;
  error_gamma_pct: number;
  atom_count: number;
  score: number;
  tier: ErrorTier;
  determinant: number;
}

// Results grouped by target
export interface TargetResults {
  target: SurfaceCellParams;
  results: MatrixResult[];
}

// Worker messages: Main -> Worker
export interface WorkerStartMessage {
  type: 'start';
  config: {
    targets: SurfaceCellParams[];
    monolayer: MonolayerMaterial;
    duration_ms: number;
    scan_limit: number;
    target_method?: 'ase' | 'pymatgen' | 'analytical' | null;
  };
}

export interface WorkerStopMessage {
  type: 'stop';
}

export type WorkerInMessage = WorkerStartMessage | WorkerStopMessage;

// Worker messages: Worker -> Main
export interface WorkerProgressMessage {
  type: 'progress';
  data: {
    phase: string;
    progress_pct: number;
    matrices_tested: number;
    best_results_so_far: TargetResults[];
    elapsed_ms: number;
  };
}

export interface WorkerResultMessage {
  type: 'result';
  data: {
    all_results: TargetResults[];
    total_tested: number;
    elapsed_ms: number;
  };
}

export interface WorkerErrorMessage {
  type: 'error';
  data: { message: string };
}

export type WorkerOutMessage = WorkerProgressMessage | WorkerResultMessage | WorkerErrorMessage;
