export interface ParsedStructure {
  formula: string;
  numAtoms: number;
  cellParams: {
    a: number;
    b: number;
    c: number;
    alpha: number;
    beta: number;
    gamma: number;
  };
  atoms: Array<{
    symbol: string;
    x: number;
    y: number;
    z: number;
  }>;
  cellVectors: number[][];
  elements: string[];
  volume: number;
}

// Detect file format
export const detectFormat = (content: string, filename?: string): 'cif' | 'xyz' | 'poscar' | 'qe' => {
  const lower = content.toLowerCase();
  const ext = filename?.toLowerCase().split('.').pop() || '';

  // Check by extension first
  if (ext === 'cif') return 'cif';
  if (ext === 'xyz') return 'xyz';
  if (ext === 'vasp' || ext === 'poscar') return 'poscar';
  if (ext === 'in' || ext === 'pw' || ext === 'out') return 'qe';

  // Check by content
  if (lower.includes('_cell_length_a') || lower.includes('data_')) return 'cif';
  if (content.trim().split('\n')[0].match(/^\s*\d+\s*$/)) return 'xyz';
  if (lower.includes('cell_parameters') || lower.includes('atomic_positions')) return 'qe';
  if (content.split('\n').length > 2 && !isNaN(parseFloat(content.split('\n')[1].trim()))) return 'poscar';

  return 'qe'; // default
};

// Helper: cell params to vectors
export const cellParamsToVectors = (a: number, b: number, c: number, alpha: number, beta: number, gamma: number): number[][] => {
  const alphaRad = alpha * Math.PI / 180;
  const betaRad = beta * Math.PI / 180;
  const gammaRad = gamma * Math.PI / 180;

  const v1 = [a, 0, 0];
  const v2 = [b * Math.cos(gammaRad), b * Math.sin(gammaRad), 0];
  const cx = c * Math.cos(betaRad);
  const cy = c * (Math.cos(alphaRad) - Math.cos(betaRad) * Math.cos(gammaRad)) / Math.sin(gammaRad);
  const cz = Math.sqrt(c * c - cx * cx - cy * cy);
  const v3 = [cx, cy, cz];

  return [v1, v2, v3];
};

// Helper: vectors to cell params
export const vectorsToCellParams = (cellVectors: number[][]): {a: number; b: number; c: number; alpha: number; beta: number; gamma: number} => {
  const a = Math.sqrt(cellVectors[0][0]**2 + cellVectors[0][1]**2 + cellVectors[0][2]**2);
  const b = Math.sqrt(cellVectors[1][0]**2 + cellVectors[1][1]**2 + cellVectors[1][2]**2);
  const c = Math.sqrt(cellVectors[2][0]**2 + cellVectors[2][1]**2 + cellVectors[2][2]**2);

  const dot = (v1: number[], v2: number[]) => v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2];
  const alpha = Math.acos(Math.max(-1, Math.min(1, dot(cellVectors[1], cellVectors[2]) / (b * c)))) * 180 / Math.PI;
  const beta = Math.acos(Math.max(-1, Math.min(1, dot(cellVectors[0], cellVectors[2]) / (a * c)))) * 180 / Math.PI;
  const gamma = Math.acos(Math.max(-1, Math.min(1, dot(cellVectors[0], cellVectors[1]) / (a * b)))) * 180 / Math.PI;

  return { a, b, c, alpha, beta, gamma };
};

// Helper: calculate volume
export const calculateVolume = (cellVectors: number[][]): number => {
  const cross = [
    cellVectors[0][1]*cellVectors[1][2] - cellVectors[0][2]*cellVectors[1][1],
    cellVectors[0][2]*cellVectors[1][0] - cellVectors[0][0]*cellVectors[1][2],
    cellVectors[0][0]*cellVectors[1][1] - cellVectors[0][1]*cellVectors[1][0]
  ];
  return Math.abs(cross[0]*cellVectors[2][0] + cross[1]*cellVectors[2][1] + cross[2]*cellVectors[2][2]);
};

// Parse CIF format
export const parseCIF = (content: string): ParsedStructure => {
  const lines = content.split('\n');
  let a = 0, b = 0, c = 0, alpha = 90, beta = 90, gamma = 90;
  const atoms: Array<{symbol: string; x: number; y: number; z: number}> = [];

  // Parse cell parameters
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('_cell_length_a')) {
      a = parseFloat(trimmed.split(/\s+/)[1]) || 0;
    } else if (trimmed.startsWith('_cell_length_b')) {
      b = parseFloat(trimmed.split(/\s+/)[1]) || 0;
    } else if (trimmed.startsWith('_cell_length_c')) {
      c = parseFloat(trimmed.split(/\s+/)[1]) || 0;
    } else if (trimmed.startsWith('_cell_angle_alpha')) {
      alpha = parseFloat(trimmed.split(/\s+/)[1]) || 90;
    } else if (trimmed.startsWith('_cell_angle_beta')) {
      beta = parseFloat(trimmed.split(/\s+/)[1]) || 90;
    } else if (trimmed.startsWith('_cell_angle_gamma')) {
      gamma = parseFloat(trimmed.split(/\s+/)[1]) || 90;
    }
  }

  if (a === 0 || b === 0 || c === 0) {
    throw new Error('Could not find valid cell parameters in CIF file');
  }

  // Find atom site loop
  let inLoop = false;
  let labelCol = -1, symbolCol = -1, xCol = -1, yCol = -1, zCol = -1;
  let colCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === 'loop_') {
      inLoop = true;
      labelCol = -1; symbolCol = -1; xCol = -1; yCol = -1; zCol = -1;
      colCount = 0;
      continue;
    }

    if (inLoop && line.startsWith('_atom_site')) {
      if (line.includes('label')) labelCol = colCount;
      else if (line.includes('type_symbol')) symbolCol = colCount;
      else if (line.includes('fract_x')) xCol = colCount;
      else if (line.includes('fract_y')) yCol = colCount;
      else if (line.includes('fract_z')) zCol = colCount;
      colCount++;
      continue;
    }

    if (inLoop && xCol >= 0 && !line.startsWith('_') && !line.startsWith('loop_') && line.length > 0) {
      const parts = line.split(/\s+/);
      if (parts.length >= Math.max(xCol, yCol, zCol) + 1) {
        // Get symbol - prefer type_symbol, fallback to label (strip numbers)
        let symbol = symbolCol >= 0 && parts[symbolCol] ? parts[symbolCol] :
                     (labelCol >= 0 ? parts[labelCol].replace(/[0-9]/g, '') : '');

        // Clean symbol (remove charges, etc)
        symbol = symbol.replace(/[+-].*$/, '').replace(/[0-9]/g, '');

        const fx = parseFloat(parts[xCol].replace(/\(.*\)/, ''));
        const fy = parseFloat(parts[yCol].replace(/\(.*\)/, ''));
        const fz = parseFloat(parts[zCol].replace(/\(.*\)/, ''));

        if (!isNaN(fx) && !isNaN(fy) && !isNaN(fz) && symbol) {
          // Convert fractional to Cartesian
          const cellVectors = cellParamsToVectors(a, b, c, alpha, beta, gamma);
          const x = fx * cellVectors[0][0] + fy * cellVectors[1][0] + fz * cellVectors[2][0];
          const y = fx * cellVectors[0][1] + fy * cellVectors[1][1] + fz * cellVectors[2][1];
          const z = fx * cellVectors[0][2] + fy * cellVectors[1][2] + fz * cellVectors[2][2];
          atoms.push({ symbol, x, y, z });
        }
      }
    }

    // End of atom loop
    if (inLoop && xCol >= 0 && (line.startsWith('loop_') || line.startsWith('_') && !line.startsWith('_atom'))) {
      if (atoms.length > 0) break;
    }
  }

  if (atoms.length === 0) {
    throw new Error('Could not find valid atomic positions in CIF file');
  }

  const cellVectors = cellParamsToVectors(a, b, c, alpha, beta, gamma);
  const volume = calculateVolume(cellVectors);

  const elementCounts: {[key: string]: number} = {};
  atoms.forEach(atom => {
    elementCounts[atom.symbol] = (elementCounts[atom.symbol] || 0) + 1;
  });
  const formula = Object.entries(elementCounts)
    .map(([el, count]) => count > 1 ? `${el}${count}` : el)
    .join('');
  const elements = [...new Set(atoms.map(a => a.symbol))];

  return {
    formula,
    numAtoms: atoms.length,
    cellParams: { a, b, c, alpha, beta, gamma },
    atoms,
    cellVectors,
    elements,
    volume
  };
};

// Parse XYZ format
export const parseXYZ = (content: string): ParsedStructure => {
  const lines = content.split('\n').filter(l => l.trim());
  const numAtoms = parseInt(lines[0].trim());
  const atoms: Array<{symbol: string; x: number; y: number; z: number}> = [];

  // Try to extract cell from comment line (various formats)
  let cellVectors: number[][] = [];
  const comment = lines[1] || '';
  const latticeMatch = comment.match(/Lattice="([^"]+)"/i);

  if (latticeMatch) {
    const vals = latticeMatch[1].split(/\s+/).map(parseFloat);
    if (vals.length === 9) {
      cellVectors = [
        [vals[0], vals[1], vals[2]],
        [vals[3], vals[4], vals[5]],
        [vals[6], vals[7], vals[8]]
      ];
    }
  }

  for (let i = 2; i < lines.length && atoms.length < numAtoms; i++) {
    const parts = lines[i].trim().split(/\s+/);
    if (parts.length >= 4) {
      const symbol = parts[0].replace(/[0-9]/g, '');
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
        atoms.push({ symbol, x, y, z });
      }
    }
  }

  if (atoms.length === 0) {
    throw new Error('Could not parse atomic positions from XYZ file');
  }

  // If no cell, estimate from atomic positions
  if (cellVectors.length !== 3) {
    const xs = atoms.map(a => a.x);
    const ys = atoms.map(a => a.y);
    const zs = atoms.map(a => a.z);
    const padding = 5;
    const ax = Math.max(...xs) - Math.min(...xs) + padding;
    const ay = Math.max(...ys) - Math.min(...ys) + padding;
    const az = Math.max(...zs) - Math.min(...zs) + padding;
    cellVectors = [[ax, 0, 0], [0, ay, 0], [0, 0, az]];
  }

  const { a, b, c, alpha, beta, gamma } = vectorsToCellParams(cellVectors);
  const volume = calculateVolume(cellVectors);

  const elementCounts: {[key: string]: number} = {};
  atoms.forEach(atom => {
    elementCounts[atom.symbol] = (elementCounts[atom.symbol] || 0) + 1;
  });
  const formula = Object.entries(elementCounts)
    .map(([el, count]) => count > 1 ? `${el}${count}` : el)
    .join('');
  const elements = [...new Set(atoms.map(a => a.symbol))];

  return {
    formula,
    numAtoms: atoms.length,
    cellParams: { a, b, c, alpha, beta, gamma },
    atoms,
    cellVectors,
    elements,
    volume
  };
};

// Parse POSCAR/VASP format
export const parsePOSCAR = (content: string): ParsedStructure => {
  const lines = content.split('\n');
  const scale = parseFloat(lines[1].trim());

  const cellVectors: number[][] = [];
  for (let i = 2; i <= 4; i++) {
    const parts = lines[i].trim().split(/\s+/).map(x => parseFloat(x) * scale);
    cellVectors.push([parts[0], parts[1], parts[2]]);
  }

  // Element names (line 5 or 6)
  let elementLine = 5;
  let countLine = 6;
  const elements: string[] = [];
  const counts: number[] = [];

  const line5parts = lines[5].trim().split(/\s+/);
  if (isNaN(parseInt(line5parts[0]))) {
    // VASP 5+ format with element names
    elements.push(...line5parts);
    counts.push(...lines[6].trim().split(/\s+/).map(x => parseInt(x)));
    elementLine = 5;
    countLine = 6;
  } else {
    // Old VASP format without element names - use generic
    counts.push(...line5parts.map(x => parseInt(x)));
    for (let i = 0; i < counts.length; i++) {
      elements.push(`El${i + 1}`);
    }
    countLine = 5;
  }

  // Find coordinate start
  let coordStart = countLine + 1;
  const coordType = lines[coordStart].trim().toLowerCase();
  if (coordType.startsWith('s')) coordStart++; // Skip Selective dynamics
  const isDirect = lines[coordStart].trim().toLowerCase().startsWith('d');
  coordStart++;

  const atoms: Array<{symbol: string; x: number; y: number; z: number}> = [];
  let atomIdx = 0;
  let elementIdx = 0;
  let countInElement = 0;

  for (let i = coordStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 3) break;

    let x = parseFloat(parts[0]);
    let y = parseFloat(parts[1]);
    let z = parseFloat(parts[2]);

    if (isDirect) {
      const fx = x, fy = y, fz = z;
      x = fx * cellVectors[0][0] + fy * cellVectors[1][0] + fz * cellVectors[2][0];
      y = fx * cellVectors[0][1] + fy * cellVectors[1][1] + fz * cellVectors[2][1];
      z = fx * cellVectors[0][2] + fy * cellVectors[1][2] + fz * cellVectors[2][2];
    }

    // Get current element
    while (elementIdx < elements.length && countInElement >= counts[elementIdx]) {
      elementIdx++;
      countInElement = 0;
    }

    if (elementIdx < elements.length) {
      atoms.push({ symbol: elements[elementIdx], x, y, z });
      countInElement++;
      atomIdx++;
    }
  }

  const { a, b, c, alpha, beta, gamma } = vectorsToCellParams(cellVectors);
  const volume = calculateVolume(cellVectors);

  const elementCounts: {[key: string]: number} = {};
  atoms.forEach(atom => {
    elementCounts[atom.symbol] = (elementCounts[atom.symbol] || 0) + 1;
  });
  const formula = Object.entries(elementCounts)
    .map(([el, count]) => count > 1 ? `${el}${count}` : el)
    .join('');

  return {
    formula,
    numAtoms: atoms.length,
    cellParams: { a, b, c, alpha, beta, gamma },
    atoms,
    cellVectors,
    elements: [...new Set(atoms.map(a => a.symbol))],
    volume
  };
};

// Parse QE format
export const parseQEFormat = (content: string): ParsedStructure => {
  const lines = content.split('\n');

  let cellVectors: number[][] = [];
  let atoms: Array<{symbol: string; x: number; y: number; z: number}> = [];

  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim().toUpperCase().startsWith('CELL_PARAMETERS')) {
      const unit = lines[i].includes('bohr') ? 0.529177 : 1;
      cellVectors = [];
      for (let j = 1; j <= 3; j++) {
        if (i + j < lines.length) {
          const parts = lines[i + j].trim().split(/\s+/).map(x => parseFloat(x) * unit);
          if (parts.length >= 3 && !isNaN(parts[0])) {
            cellVectors.push([parts[0], parts[1], parts[2]]);
          }
        }
      }
      if (cellVectors.length === 3) break;
    }
  }

  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim().toUpperCase().startsWith('ATOMIC_POSITIONS')) {
      const isCrystal = lines[i].toLowerCase().includes('crystal');
      atoms = [];
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j].trim();
        if (!line || line.toUpperCase().startsWith('CELL_PARAMETERS') ||
            line.toUpperCase().startsWith('END') || line.startsWith('!')) break;

        const parts = line.split(/\s+/);
        if (parts.length >= 4) {
          const symbol = parts[0];
          let x = parseFloat(parts[1]);
          let y = parseFloat(parts[2]);
          let z = parseFloat(parts[3]);

          if (isCrystal && cellVectors.length === 3) {
            const fx = x, fy = y, fz = z;
            x = fx * cellVectors[0][0] + fy * cellVectors[1][0] + fz * cellVectors[2][0];
            y = fx * cellVectors[0][1] + fy * cellVectors[1][1] + fz * cellVectors[2][1];
            z = fx * cellVectors[0][2] + fy * cellVectors[1][2] + fz * cellVectors[2][2];
          }

          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            atoms.push({ symbol, x, y, z });
          }
        }
      }
      if (atoms.length > 0) break;
    }
  }

  if (cellVectors.length !== 3) {
    throw new Error('Could not find valid CELL_PARAMETERS block. Make sure your file contains QE format with CELL_PARAMETERS and ATOMIC_POSITIONS blocks.');
  }
  if (atoms.length === 0) {
    throw new Error('Could not find valid ATOMIC_POSITIONS block');
  }

  const { a, b, c, alpha, beta, gamma } = vectorsToCellParams(cellVectors);
  const volume = calculateVolume(cellVectors);

  const elementCounts: {[key: string]: number} = {};
  atoms.forEach(atom => {
    elementCounts[atom.symbol] = (elementCounts[atom.symbol] || 0) + 1;
  });
  const formula = Object.entries(elementCounts)
    .map(([el, count]) => count > 1 ? `${el}${count}` : el)
    .join('');
  const elements = [...new Set(atoms.map(a => a.symbol))];

  return {
    formula,
    numAtoms: atoms.length,
    cellParams: { a, b, c, alpha, beta, gamma },
    atoms,
    cellVectors,
    elements,
    volume
  };
};

// Main parser - auto-detect format
export const parseStructure = (content: string, filename?: string): ParsedStructure => {
  const format = detectFormat(content, filename);

  switch (format) {
    case 'cif':
      return parseCIF(content);
    case 'xyz':
      return parseXYZ(content);
    case 'poscar':
      return parsePOSCAR(content);
    case 'qe':
    default:
      return parseQEFormat(content);
  }
};
