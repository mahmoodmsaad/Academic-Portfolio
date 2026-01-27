import type { MetalEntry, MonolayerMaterial } from './matrixOptimizerTypes';

// === Metal Database ===
// Lattice constants from experimental data at room temperature

export const METALS: MetalEntry[] = [
  // FCC metals
  { symbol: 'Pt', name: 'Platinum',    a0: 3.9242, structure: 'FCC' },
  { symbol: 'Au', name: 'Gold',        a0: 4.0782, structure: 'FCC' },
  { symbol: 'Ag', name: 'Silver',      a0: 4.0853, structure: 'FCC' },
  { symbol: 'Cu', name: 'Copper',      a0: 3.6149, structure: 'FCC' },
  { symbol: 'Ni', name: 'Nickel',      a0: 3.5240, structure: 'FCC' },
  { symbol: 'Pd', name: 'Palladium',   a0: 3.8907, structure: 'FCC' },
  { symbol: 'Ir', name: 'Iridium',     a0: 3.8394, structure: 'FCC' },
  { symbol: 'Rh', name: 'Rhodium',     a0: 3.8034, structure: 'FCC' },
  { symbol: 'Al', name: 'Aluminum',    a0: 4.0495, structure: 'FCC' },
  { symbol: 'Pb', name: 'Lead',        a0: 4.9502, structure: 'FCC' },

  // BCC metals
  { symbol: 'Fe', name: 'Iron',        a0: 2.8665, structure: 'BCC' },
  { symbol: 'W',  name: 'Tungsten',    a0: 3.1652, structure: 'BCC' },
  { symbol: 'Mo', name: 'Molybdenum',  a0: 3.1470, structure: 'BCC' },
  { symbol: 'Cr', name: 'Chromium',    a0: 2.9100, structure: 'BCC' },
  { symbol: 'V',  name: 'Vanadium',    a0: 3.0240, structure: 'BCC' },
  { symbol: 'Nb', name: 'Niobium',     a0: 3.3004, structure: 'BCC' },
  { symbol: 'Ta', name: 'Tantalum',    a0: 3.3058, structure: 'BCC' },

  // HCP metals
  { symbol: 'Ru', name: 'Ruthenium',   a0: 2.7059, structure: 'HCP', c_over_a: 1.5824 },
  { symbol: 'Co', name: 'Cobalt',      a0: 2.5071, structure: 'HCP', c_over_a: 1.6228 },
  { symbol: 'Ti', name: 'Titanium',    a0: 2.9508, structure: 'HCP', c_over_a: 1.5873 },
  { symbol: 'Zn', name: 'Zinc',        a0: 2.6649, structure: 'HCP', c_over_a: 1.8563 },
];

// === Monolayer Material Presets ===

export const MONOLAYER_PRESETS: MonolayerMaterial[] = [
  // Hexagonal monolayers (a = b, gamma = 120)
  { name: 'hBN',          a: 2.504, b: 2.504, gamma: 120, atoms_per_cell: 2, crystal_system: 'hexagonal' },
  { name: 'Graphene',     a: 2.461, b: 2.461, gamma: 120, atoms_per_cell: 2, crystal_system: 'hexagonal' },
  { name: 'MoS2',         a: 3.160, b: 3.160, gamma: 120, atoms_per_cell: 3, crystal_system: 'hexagonal' },
  { name: 'MoSe2',        a: 3.289, b: 3.289, gamma: 120, atoms_per_cell: 3, crystal_system: 'hexagonal' },
  { name: 'WS2',          a: 3.153, b: 3.153, gamma: 120, atoms_per_cell: 3, crystal_system: 'hexagonal' },
  { name: 'WSe2',         a: 3.282, b: 3.282, gamma: 120, atoms_per_cell: 3, crystal_system: 'hexagonal' },
  { name: 'Silicene',     a: 3.866, b: 3.866, gamma: 120, atoms_per_cell: 2, crystal_system: 'hexagonal' },
  { name: 'Germanene',    a: 4.063, b: 4.063, gamma: 120, atoms_per_cell: 2, crystal_system: 'hexagonal' },
  { name: 'Stanene',      a: 4.670, b: 4.670, gamma: 120, atoms_per_cell: 2, crystal_system: 'hexagonal' },
  { name: 'Borophene',    a: 2.866, b: 2.866, gamma: 120, atoms_per_cell: 2, crystal_system: 'hexagonal' },
  { name: 'GaSe',         a: 3.755, b: 3.755, gamma: 120, atoms_per_cell: 4, crystal_system: 'hexagonal' },
  { name: 'InSe',         a: 4.002, b: 4.002, gamma: 120, atoms_per_cell: 4, crystal_system: 'hexagonal' },
  { name: 'h-BAs',        a: 3.385, b: 3.385, gamma: 120, atoms_per_cell: 2, crystal_system: 'hexagonal' },
  { name: 'Bi2Se3 (QL)',  a: 4.138, b: 4.138, gamma: 120, atoms_per_cell: 5, crystal_system: 'hexagonal' },

  // Rectangular monolayers (gamma = 90)
  { name: 'Phosphorene',  a: 3.314, b: 4.376, gamma: 90, atoms_per_cell: 4, crystal_system: 'rectangular' },
  { name: 'GeS',          a: 3.640, b: 4.299, gamma: 90, atoms_per_cell: 4, crystal_system: 'rectangular' },
  { name: 'SnS',          a: 3.980, b: 4.340, gamma: 90, atoms_per_cell: 4, crystal_system: 'rectangular' },
  { name: 'SnSe',         a: 4.190, b: 4.530, gamma: 90, atoms_per_cell: 4, crystal_system: 'rectangular' },
];

export function getMetalBySymbol(symbol: string): MetalEntry | undefined {
  return METALS.find(m => m.symbol === symbol);
}

export function getMonolayerByName(name: string): MonolayerMaterial | undefined {
  return MONOLAYER_PRESETS.find(m => m.name === name);
}
