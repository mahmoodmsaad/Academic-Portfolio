import { describe, it, expect } from 'vitest';
import {
  detectFormat,
  cellParamsToVectors,
  vectorsToCellParams,
  calculateVolume,
  parseCIF,
  parseXYZ,
  parsePOSCAR,
  parseQEFormat,
  parseStructure
} from '../qeParserUtils';

describe('detectFormat', () => {
  describe('detection by file extension', () => {
    it('should detect CIF format from .cif extension', () => {
      const content = 'random content';
      expect(detectFormat(content, 'structure.cif')).toBe('cif');
      expect(detectFormat(content, 'STRUCTURE.CIF')).toBe('cif');
    });

    it('should detect XYZ format from .xyz extension', () => {
      const content = 'random content';
      expect(detectFormat(content, 'structure.xyz')).toBe('xyz');
      expect(detectFormat(content, 'STRUCTURE.XYZ')).toBe('xyz');
    });

    it('should detect POSCAR format from .vasp or .poscar extension', () => {
      const content = 'random content';
      expect(detectFormat(content, 'structure.vasp')).toBe('poscar');
      expect(detectFormat(content, 'POSCAR')).toBe('poscar');
      expect(detectFormat(content, 'structure.poscar')).toBe('poscar');
    });

    it('should detect QE format from .in, .pw, or .out extension', () => {
      const content = 'random content';
      expect(detectFormat(content, 'structure.in')).toBe('qe');
      expect(detectFormat(content, 'structure.pw')).toBe('qe');
      expect(detectFormat(content, 'structure.out')).toBe('qe');
    });
  });

  describe('detection by file content', () => {
    it('should detect CIF format from _cell_length_a marker', () => {
      const content = `data_structure
_cell_length_a    5.0
_cell_length_b    5.0`;
      expect(detectFormat(content)).toBe('cif');
    });

    it('should detect CIF format from data_ marker', () => {
      const content = 'data_some_structure\nloop_';
      expect(detectFormat(content)).toBe('cif');
    });

    it('should detect XYZ format from atom count in first line', () => {
      const content = '  3  \nComment line\nC 0.0 0.0 0.0';
      expect(detectFormat(content)).toBe('xyz');
    });

    it('should detect QE format from cell_parameters marker', () => {
      const content = `CELL_PARAMETERS angstrom
5.0 0.0 0.0
0.0 5.0 0.0`;
      expect(detectFormat(content)).toBe('qe');
    });

    it('should detect QE format from atomic_positions marker', () => {
      const content = `ATOMIC_POSITIONS crystal
Si 0.0 0.0 0.0`;
      expect(detectFormat(content)).toBe('qe');
    });

    it('should detect POSCAR format from numeric second line', () => {
      const content = `Comment\n1.0\n5.0 0.0 0.0\n0.0 5.0 0.0`;
      expect(detectFormat(content)).toBe('poscar');
    });

    it('should default to qe format when unable to detect', () => {
      const content = 'unknown format content';
      expect(detectFormat(content)).toBe('qe');
    });
  });
});

describe('cellParamsToVectors', () => {
  it('should convert orthogonal cell parameters to vectors', () => {
    const vectors = cellParamsToVectors(5.0, 6.0, 7.0, 90, 90, 90);

    expect(vectors[0]).toEqual([5.0, 0, 0]);
    expect(vectors[1][0]).toBeCloseTo(0, 5);
    expect(vectors[1][1]).toBeCloseTo(6.0, 5);
    expect(vectors[1][2]).toBeCloseTo(0, 5);
    expect(vectors[2][0]).toBeCloseTo(0, 5);
    expect(vectors[2][1]).toBeCloseTo(0, 5);
    expect(vectors[2][2]).toBeCloseTo(7.0, 5);
  });

  it('should convert cubic cell parameters to vectors', () => {
    const vectors = cellParamsToVectors(5.0, 5.0, 5.0, 90, 90, 90);

    expect(vectors[0]).toEqual([5.0, 0, 0]);
    expect(vectors[1][1]).toBeCloseTo(5.0, 5);
    expect(vectors[2][2]).toBeCloseTo(5.0, 5);
  });

  it('should convert hexagonal cell parameters to vectors', () => {
    const vectors = cellParamsToVectors(5.0, 5.0, 10.0, 90, 90, 120);

    expect(vectors[0]).toEqual([5.0, 0, 0]);
    expect(vectors[1][0]).toBeCloseTo(-2.5, 5); // 5 * cos(120°) = -2.5
    expect(vectors[1][1]).toBeCloseTo(4.33, 2); // 5 * sin(120°) ≈ 4.33
    expect(vectors[2][2]).toBeCloseTo(10.0, 5);
  });
});

describe('vectorsToCellParams', () => {
  it('should convert orthogonal vectors to cell parameters', () => {
    const vectors = [
      [5.0, 0, 0],
      [0, 6.0, 0],
      [0, 0, 7.0]
    ];

    const params = vectorsToCellParams(vectors);

    expect(params.a).toBeCloseTo(5.0, 5);
    expect(params.b).toBeCloseTo(6.0, 5);
    expect(params.c).toBeCloseTo(7.0, 5);
    expect(params.alpha).toBeCloseTo(90, 5);
    expect(params.beta).toBeCloseTo(90, 5);
    expect(params.gamma).toBeCloseTo(90, 5);
  });

  it('should convert cubic vectors to cell parameters', () => {
    const vectors = [
      [5.0, 0, 0],
      [0, 5.0, 0],
      [0, 0, 5.0]
    ];

    const params = vectorsToCellParams(vectors);

    expect(params.a).toBeCloseTo(5.0, 5);
    expect(params.b).toBeCloseTo(5.0, 5);
    expect(params.c).toBeCloseTo(5.0, 5);
    expect(params.alpha).toBeCloseTo(90, 5);
    expect(params.beta).toBeCloseTo(90, 5);
    expect(params.gamma).toBeCloseTo(90, 5);
  });

  it('should be inverse of cellParamsToVectors for orthogonal cells', () => {
    const origParams = { a: 5.0, b: 6.0, c: 7.0, alpha: 90, beta: 90, gamma: 90 };
    const vectors = cellParamsToVectors(origParams.a, origParams.b, origParams.c,
                                       origParams.alpha, origParams.beta, origParams.gamma);
    const params = vectorsToCellParams(vectors);

    expect(params.a).toBeCloseTo(origParams.a, 5);
    expect(params.b).toBeCloseTo(origParams.b, 5);
    expect(params.c).toBeCloseTo(origParams.c, 5);
    expect(params.alpha).toBeCloseTo(origParams.alpha, 5);
    expect(params.beta).toBeCloseTo(origParams.beta, 5);
    expect(params.gamma).toBeCloseTo(origParams.gamma, 5);
  });
});

describe('calculateVolume', () => {
  it('should calculate volume for cubic cell', () => {
    const vectors = [
      [5.0, 0, 0],
      [0, 5.0, 0],
      [0, 0, 5.0]
    ];

    const volume = calculateVolume(vectors);
    expect(volume).toBeCloseTo(125.0, 5); // 5^3 = 125
  });

  it('should calculate volume for rectangular cell', () => {
    const vectors = [
      [5.0, 0, 0],
      [0, 6.0, 0],
      [0, 0, 7.0]
    ];

    const volume = calculateVolume(vectors);
    expect(volume).toBeCloseTo(210.0, 5); // 5 * 6 * 7 = 210
  });

  it('should calculate volume for unit cell', () => {
    const vectors = [
      [1.0, 0, 0],
      [0, 1.0, 0],
      [0, 0, 1.0]
    ];

    const volume = calculateVolume(vectors);
    expect(volume).toBeCloseTo(1.0, 5);
  });
});

describe('parseCIF', () => {
  it('should parse a simple cubic CIF structure', () => {
    const content = `data_structure
_cell_length_a    5.0
_cell_length_b    5.0
_cell_length_c    5.0
_cell_angle_alpha 90.0
_cell_angle_beta  90.0
_cell_angle_gamma 90.0
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Si1 Si 0.0 0.0 0.0
Si2 Si 0.5 0.5 0.5`;

    const result = parseCIF(content);

    expect(result.formula).toBe('Si2');
    expect(result.numAtoms).toBe(2);
    expect(result.cellParams.a).toBeCloseTo(5.0, 5);
    expect(result.cellParams.b).toBeCloseTo(5.0, 5);
    expect(result.cellParams.c).toBeCloseTo(5.0, 5);
    expect(result.atoms).toHaveLength(2);
    expect(result.atoms[0].symbol).toBe('Si');
    expect(result.atoms[0].x).toBeCloseTo(0.0, 5);
    expect(result.atoms[1].x).toBeCloseTo(2.5, 5);
    expect(result.elements).toEqual(['Si']);
    expect(result.volume).toBeCloseTo(125.0, 5);
  });

  it('should throw error for CIF without cell parameters', () => {
    const content = `data_structure
loop_
_atom_site_label
Si1 Si 0.0 0.0 0.0`;

    expect(() => parseCIF(content)).toThrow('Could not find valid cell parameters');
  });

  it('should throw error for CIF without atomic positions', () => {
    const content = `data_structure
_cell_length_a    5.0
_cell_length_b    5.0
_cell_length_c    5.0`;

    expect(() => parseCIF(content)).toThrow('Could not find valid atomic positions');
  });

  it('should handle CIF with mixed elements', () => {
    const content = `data_structure
_cell_length_a    5.0
_cell_length_b    5.0
_cell_length_c    5.0
_cell_angle_alpha 90.0
_cell_angle_beta  90.0
_cell_angle_gamma 90.0
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Si1 Si 0.0 0.0 0.0
O1 O 0.5 0.5 0.5
O2 O 0.25 0.25 0.25`;

    const result = parseCIF(content);

    expect(result.formula).toBe('SiO2');
    expect(result.numAtoms).toBe(3);
    expect(result.elements).toEqual(['Si', 'O']);
  });
});

describe('parseXYZ', () => {
  it('should parse XYZ file without lattice vectors', () => {
    const content = `3
Comment line
C 0.0 0.0 0.0
H 1.0 0.0 0.0
H 0.0 1.0 0.0`;

    const result = parseXYZ(content);

    expect(result.numAtoms).toBe(3);
    expect(result.atoms).toHaveLength(3);
    expect(result.atoms[0].symbol).toBe('C');
    expect(result.atoms[0].x).toBe(0.0);
    expect(result.atoms[1].symbol).toBe('H');
    expect(result.formula).toBe('CH2');
    expect(result.elements).toEqual(['C', 'H']);
  });

  it('should parse XYZ file with lattice vectors', () => {
    const content = `2
Lattice="5.0 0.0 0.0 0.0 5.0 0.0 0.0 0.0 5.0"
C 0.0 0.0 0.0
C 2.5 2.5 2.5`;

    const result = parseXYZ(content);

    expect(result.numAtoms).toBe(2);
    expect(result.cellParams.a).toBeCloseTo(5.0, 5);
    expect(result.cellParams.b).toBeCloseTo(5.0, 5);
    expect(result.cellParams.c).toBeCloseTo(5.0, 5);
    expect(result.formula).toBe('C2');
  });

  it('should throw error for empty XYZ file', () => {
    const content = `3
Comment line`;

    expect(() => parseXYZ(content)).toThrow('Could not parse atomic positions');
  });

  it('should estimate cell vectors when not provided', () => {
    const content = `2
Comment
C 0.0 0.0 0.0
C 10.0 10.0 10.0`;

    const result = parseXYZ(content);

    // Should have estimated cell with padding
    expect(result.cellParams.a).toBeGreaterThan(10.0);
    expect(result.cellVectors).toHaveLength(3);
  });
});

describe('parsePOSCAR', () => {
  it('should parse POSCAR with element names (VASP 5+)', () => {
    const content = `Silicon
1.0
5.0 0.0 0.0
0.0 5.0 0.0
0.0 0.0 5.0
Si
2
Direct
0.0 0.0 0.0
0.5 0.5 0.5`;

    const result = parsePOSCAR(content);

    expect(result.numAtoms).toBe(2);
    expect(result.atoms[0].symbol).toBe('Si');
    expect(result.formula).toBe('Si2');
    expect(result.cellParams.a).toBeCloseTo(5.0, 5);
  });

  it('should parse POSCAR without element names (old VASP)', () => {
    const content = `Structure
1.0
5.0 0.0 0.0
0.0 5.0 0.0
0.0 0.0 5.0
2
Direct
0.0 0.0 0.0
0.5 0.5 0.5`;

    const result = parsePOSCAR(content);

    expect(result.numAtoms).toBe(2);
    expect(result.atoms[0].symbol).toBe('El1');
    expect(result.formula).toBe('El12');
  });

  it('should handle scaling factor', () => {
    const content = `Silicon
2.0
2.5 0.0 0.0
0.0 2.5 0.0
0.0 0.0 2.5
Si
1
Direct
0.0 0.0 0.0`;

    const result = parsePOSCAR(content);

    // Vectors should be scaled by 2.0
    expect(result.cellParams.a).toBeCloseTo(5.0, 5);
    expect(result.cellParams.b).toBeCloseTo(5.0, 5);
    expect(result.cellParams.c).toBeCloseTo(5.0, 5);
  });

  it('should convert direct (fractional) coordinates to Cartesian', () => {
    const content = `Silicon
1.0
10.0 0.0 0.0
0.0 10.0 0.0
0.0 0.0 10.0
Si
1
Direct
0.5 0.5 0.5`;

    const result = parsePOSCAR(content);

    expect(result.atoms[0].x).toBeCloseTo(5.0, 5);
    expect(result.atoms[0].y).toBeCloseTo(5.0, 5);
    expect(result.atoms[0].z).toBeCloseTo(5.0, 5);
  });
});

describe('parseQEFormat', () => {
  it('should parse QE format with CELL_PARAMETERS and ATOMIC_POSITIONS', () => {
    const content = `CELL_PARAMETERS angstrom
5.0 0.0 0.0
0.0 5.0 0.0
0.0 0.0 5.0

ATOMIC_POSITIONS angstrom
Si 0.0 0.0 0.0
Si 2.5 2.5 2.5`;

    const result = parseQEFormat(content);

    expect(result.numAtoms).toBe(2);
    expect(result.atoms[0].symbol).toBe('Si');
    expect(result.atoms[0].x).toBe(0.0);
    expect(result.formula).toBe('Si2');
    expect(result.cellParams.a).toBeCloseTo(5.0, 5);
  });

  it('should convert bohr units to angstrom', () => {
    const content = `CELL_PARAMETERS bohr
9.448 0.0 0.0
0.0 9.448 0.0
0.0 0.0 9.448

ATOMIC_POSITIONS angstrom
Si 0.0 0.0 0.0`;

    const result = parseQEFormat(content);

    // 9.448 bohr * 0.529177 = ~5.0 angstrom
    expect(result.cellParams.a).toBeCloseTo(5.0, 1);
  });

  it('should convert crystal (fractional) coordinates', () => {
    const content = `CELL_PARAMETERS angstrom
10.0 0.0 0.0
0.0 10.0 0.0
0.0 0.0 10.0

ATOMIC_POSITIONS crystal
Si 0.5 0.5 0.5`;

    const result = parseQEFormat(content);

    expect(result.atoms[0].x).toBeCloseTo(5.0, 5);
    expect(result.atoms[0].y).toBeCloseTo(5.0, 5);
    expect(result.atoms[0].z).toBeCloseTo(5.0, 5);
  });

  it('should throw error without CELL_PARAMETERS', () => {
    const content = `ATOMIC_POSITIONS angstrom
Si 0.0 0.0 0.0`;

    expect(() => parseQEFormat(content)).toThrow('Could not find valid CELL_PARAMETERS block');
  });

  it('should throw error without ATOMIC_POSITIONS', () => {
    const content = `CELL_PARAMETERS angstrom
5.0 0.0 0.0
0.0 5.0 0.0
0.0 0.0 5.0`;

    expect(() => parseQEFormat(content)).toThrow('Could not find valid ATOMIC_POSITIONS block');
  });
});

describe('parseStructure', () => {
  it('should auto-detect and parse CIF format', () => {
    const content = `data_structure
_cell_length_a    5.0
_cell_length_b    5.0
_cell_length_c    5.0
_cell_angle_alpha 90.0
_cell_angle_beta  90.0
_cell_angle_gamma 90.0
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Si1 Si 0.0 0.0 0.0`;

    const result = parseStructure(content, 'test.cif');

    expect(result.formula).toBe('Si');
    expect(result.numAtoms).toBe(1);
  });

  it('should auto-detect and parse XYZ format', () => {
    const content = `1
Comment
C 0.0 0.0 0.0`;

    const result = parseStructure(content, 'test.xyz');

    expect(result.formula).toBe('C');
    expect(result.numAtoms).toBe(1);
  });

  it('should auto-detect and parse POSCAR format', () => {
    const content = `Silicon
1.0
5.0 0.0 0.0
0.0 5.0 0.0
0.0 0.0 5.0
Si
1
Direct
0.0 0.0 0.0`;

    const result = parseStructure(content, 'POSCAR');

    expect(result.formula).toBe('Si');
    expect(result.numAtoms).toBe(1);
  });

  it('should auto-detect and parse QE format', () => {
    const content = `CELL_PARAMETERS angstrom
5.0 0.0 0.0
0.0 5.0 0.0
0.0 0.0 5.0

ATOMIC_POSITIONS angstrom
Si 0.0 0.0 0.0`;

    const result = parseStructure(content, 'test.in');

    expect(result.formula).toBe('Si');
    expect(result.numAtoms).toBe(1);
  });
});
