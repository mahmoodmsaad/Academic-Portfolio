import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, AlertCircle, CheckCircle, Atom, ArrowRightLeft, Sparkles, Copy, Check, Brain, Zap, Settings, ChevronDown } from 'lucide-react';

interface ParsedStructure {
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

interface ConversionResult {
  cif?: string;
  xyz?: string;
  poscar?: string;
}

const QEParser: React.FC = () => {
  // Main tool selection
  const [activeTool, setActiveTool] = useState<'converter' | 'dft-assistant'>('converter');
  
  // Converter state
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParsedStructure | null>(null);
  const [conversionResults, setConversionResults] = useState<ConversionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'structure' | 'cif' | 'xyz' | 'poscar'>('structure');
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // DFT Assistant state
  const [dftFile, setDftFile] = useState<File | null>(null);
  const [dftFileContent, setDftFileContent] = useState<string>('');
  const [dftParsedData, setDftParsedData] = useState<ParsedStructure | null>(null);
  const [calcType, setCalcType] = useState<string>('scf');
  const [functional, setFunctional] = useState<string>('PBE');
  const [apiKey, setApiKey] = useState<string>('');
  const [dftAdvice, setDftAdvice] = useState<string>('');
  const [qeTemplate, setQeTemplate] = useState<string>('');
  const [isDftProcessing, setIsDftProcessing] = useState(false);
  const [dftError, setDftError] = useState<string>('');
  const [generateTemplate, setGenerateTemplate] = useState<boolean>(true);
  const dftFileInputRef = useRef<HTMLInputElement>(null);

  // File handling for converter
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setError('');
      setParsedData(null);
      setConversionResults(null);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setFileContent(content);
      };
      reader.readAsText(uploadedFile);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError('');
      setParsedData(null);
      setConversionResults(null);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setFileContent(content);
      };
      reader.readAsText(droppedFile);
    }
  };

  // File handling for DFT assistant
  const handleDftFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setDftFile(uploadedFile);
      setDftError('');
      setDftParsedData(null);
      setDftAdvice('');
      setQeTemplate('');
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setDftFileContent(content);
        try {
          const parsed = parseStructure(content, uploadedFile.name);
          setDftParsedData(parsed);
          setDftError('');
        } catch (err) {
          setDftError(err instanceof Error ? err.message : 'Failed to parse structure file');
        }
      };
      reader.readAsText(uploadedFile);
    }
  };

  const handleDftDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setDftFile(droppedFile);
      setDftError('');
      setDftParsedData(null);
      setDftAdvice('');
      setQeTemplate('');
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setDftFileContent(content);
        try {
          const parsed = parseStructure(content, droppedFile.name);
          setDftParsedData(parsed);
          setDftError('');
        } catch (err) {
          setDftError(err instanceof Error ? err.message : 'Failed to parse structure file');
        }
      };
      reader.readAsText(droppedFile);
    }
  };

  // Detect file format
  const detectFormat = (content: string, filename?: string): 'cif' | 'xyz' | 'poscar' | 'qe' => {
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

  // Parse CIF format
  const parseCIF = (content: string): ParsedStructure => {
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
  const parseXYZ = (content: string): ParsedStructure => {
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
  const parsePOSCAR = (content: string): ParsedStructure => {
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
  const parseQEFormat = (content: string): ParsedStructure => {
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

  // Helper: cell params to vectors
  const cellParamsToVectors = (a: number, b: number, c: number, alpha: number, beta: number, gamma: number): number[][] => {
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
  const vectorsToCellParams = (cellVectors: number[][]): {a: number; b: number; c: number; alpha: number; beta: number; gamma: number} => {
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
  const calculateVolume = (cellVectors: number[][]): number => {
    const cross = [
      cellVectors[0][1]*cellVectors[1][2] - cellVectors[0][2]*cellVectors[1][1],
      cellVectors[0][2]*cellVectors[1][0] - cellVectors[0][0]*cellVectors[1][2],
      cellVectors[0][0]*cellVectors[1][1] - cellVectors[0][1]*cellVectors[1][0]
    ];
    return Math.abs(cross[0]*cellVectors[2][0] + cross[1]*cellVectors[2][1] + cross[2]*cellVectors[2][2]);
  };

  // Main parser - auto-detect format
  const parseStructure = (content: string, filename?: string): ParsedStructure => {
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

  // Keep old name for backward compatibility
  const parseQEOutput = (content: string, filename?: string): ParsedStructure => {
    return parseStructure(content, filename);
  };

  const generateCIF = (data: ParsedStructure): string => {
    const { cellParams, atoms, cellVectors } = data;
    const inv = invertMatrix(cellVectors);
    
    let cif = `data_structure\n`;
    cif += `_cell_length_a    ${cellParams.a.toFixed(6)}\n`;
    cif += `_cell_length_b    ${cellParams.b.toFixed(6)}\n`;
    cif += `_cell_length_c    ${cellParams.c.toFixed(6)}\n`;
    cif += `_cell_angle_alpha ${cellParams.alpha.toFixed(4)}\n`;
    cif += `_cell_angle_beta  ${cellParams.beta.toFixed(4)}\n`;
    cif += `_cell_angle_gamma ${cellParams.gamma.toFixed(4)}\n\n`;
    cif += `loop_\n`;
    cif += `_atom_site_label\n`;
    cif += `_atom_site_type_symbol\n`;
    cif += `_atom_site_fract_x\n`;
    cif += `_atom_site_fract_y\n`;
    cif += `_atom_site_fract_z\n`;
    
    atoms.forEach((atom, i) => {
      const fx = inv[0][0]*atom.x + inv[0][1]*atom.y + inv[0][2]*atom.z;
      const fy = inv[1][0]*atom.x + inv[1][1]*atom.y + inv[1][2]*atom.z;
      const fz = inv[2][0]*atom.x + inv[2][1]*atom.y + inv[2][2]*atom.z;
      cif += `${atom.symbol}${i+1} ${atom.symbol} ${fx.toFixed(6)} ${fy.toFixed(6)} ${fz.toFixed(6)}\n`;
    });
    
    return cif;
  };

  const generateXYZ = (data: ParsedStructure): string => {
    let xyz = `${data.numAtoms}\n`;
    xyz += `${data.formula}\n`;
    data.atoms.forEach(atom => {
      xyz += `${atom.symbol}  ${atom.x.toFixed(8)}  ${atom.y.toFixed(8)}  ${atom.z.toFixed(8)}\n`;
    });
    return xyz;
  };

  const generatePOSCAR = (data: ParsedStructure): string => {
    const { atoms, cellVectors } = data;
    
    const elementOrder: string[] = [];
    const elementCounts: {[key: string]: number} = {};
    const sortedAtoms: typeof atoms = [];
    
    atoms.forEach(atom => {
      if (!elementCounts[atom.symbol]) {
        elementOrder.push(atom.symbol);
        elementCounts[atom.symbol] = 0;
      }
      elementCounts[atom.symbol]++;
    });
    
    elementOrder.forEach(el => {
      atoms.filter(a => a.symbol === el).forEach(a => sortedAtoms.push(a));
    });
    
    let poscar = `${data.formula}\n`;
    poscar += `1.0\n`;
    cellVectors.forEach(v => {
      poscar += `  ${v[0].toFixed(10)}  ${v[1].toFixed(10)}  ${v[2].toFixed(10)}\n`;
    });
    poscar += `  ${elementOrder.join('  ')}\n`;
    poscar += `  ${elementOrder.map(el => elementCounts[el]).join('  ')}\n`;
    poscar += `Cartesian\n`;
    sortedAtoms.forEach(atom => {
      poscar += `  ${atom.x.toFixed(10)}  ${atom.y.toFixed(10)}  ${atom.z.toFixed(10)}\n`;
    });
    
    return poscar;
  };

  const generateQEInputTemplate = (data: ParsedStructure): string => {
    const { formula, atoms, cellVectors, elements, numAtoms } = data;
    
    const atomicMasses: {[key: string]: number} = {
      'H': 1.008, 'He': 4.003, 'Li': 6.941, 'Be': 9.012, 'B': 10.81, 'C': 12.01,
      'N': 14.01, 'O': 16.00, 'F': 19.00, 'Ne': 20.18, 'Na': 22.99, 'Mg': 24.31,
      'Al': 26.98, 'Si': 28.09, 'P': 30.97, 'S': 32.07, 'Cl': 35.45, 'Ar': 39.95,
      'K': 39.10, 'Ca': 40.08, 'Sc': 44.96, 'Ti': 47.87, 'V': 50.94, 'Cr': 52.00,
      'Mn': 54.94, 'Fe': 55.85, 'Co': 58.93, 'Ni': 58.69, 'Cu': 63.55, 'Zn': 65.38,
      'Ga': 69.72, 'Ge': 72.63, 'As': 74.92, 'Se': 78.97, 'Br': 79.90, 'Kr': 83.80
    };
    
    const lines: string[] = [];
    
    lines.push('&CONTROL');
    lines.push(`  calculation = '${calcType}'`);
    lines.push(`  prefix = '${formula.toLowerCase()}'`);
    lines.push("  outdir = './tmp'");
    lines.push("  pseudo_dir = './pseudo'");
    lines.push("  verbosity = 'high'");
    if (calcType === 'relax' || calcType === 'vc-relax') {
      lines.push("  tprnfor = .true.");
      lines.push("  tstress = .true.");
    }
    lines.push('/\n');
    
    lines.push('&SYSTEM');
    lines.push('  ibrav = 0');
    lines.push(`  nat = ${numAtoms}`);
    lines.push(`  ntyp = ${elements.length}`);
    lines.push('  ecutwfc = 60.0');
    lines.push('  ecutrho = 480.0');
    lines.push("  occupations = 'smearing'");
    lines.push("  smearing = 'gaussian'");
    lines.push('  degauss = 0.01');
    lines.push('/\n');
    
    lines.push('&ELECTRONS');
    lines.push('  conv_thr = 1.0d-8');
    lines.push('  mixing_beta = 0.7');
    lines.push('/\n');
    
    if (calcType === 'relax' || calcType === 'vc-relax') {
      lines.push('&IONS');
      lines.push("  ion_dynamics = 'bfgs'");
      lines.push('/\n');
    }
    
    if (calcType === 'vc-relax') {
      lines.push('&CELL');
      lines.push("  cell_dynamics = 'bfgs'");
      lines.push('/\n');
    }
    
    lines.push('ATOMIC_SPECIES');
    elements.forEach(el => {
      const mass = atomicMasses[el] || 1.0;
      lines.push(`  ${el}  ${mass.toFixed(4)}  ${el}.UPF`);
    });
    lines.push('');
    
    lines.push('CELL_PARAMETERS angstrom');
    cellVectors.forEach(v => {
      lines.push(`  ${v[0].toFixed(10)} ${v[1].toFixed(10)} ${v[2].toFixed(10)}`);
    });
    lines.push('');
    
    const inv = invertMatrix(cellVectors);
    lines.push('ATOMIC_POSITIONS crystal');
    atoms.forEach(atom => {
      const fx = inv[0][0]*atom.x + inv[0][1]*atom.y + inv[0][2]*atom.z;
      const fy = inv[1][0]*atom.x + inv[1][1]*atom.y + inv[1][2]*atom.z;
      const fz = inv[2][0]*atom.x + inv[2][1]*atom.y + inv[2][2]*atom.z;
      lines.push(`  ${atom.symbol}  ${fx.toFixed(10)} ${fy.toFixed(10)} ${fz.toFixed(10)}`);
    });
    lines.push('');
    
    lines.push('K_POINTS automatic');
    lines.push('  4 4 4 0 0 0');
    
    return lines.join('\n');
  };

  const invertMatrix = (m: number[][]): number[][] => {
    const det = m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1]) 
              - m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0]) 
              + m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
    
    if (Math.abs(det) < 1e-10) {
      throw new Error('Matrix is singular');
    }
    
    return [
      [(m[1][1]*m[2][2]-m[1][2]*m[2][1])/det, (m[0][2]*m[2][1]-m[0][1]*m[2][2])/det, (m[0][1]*m[1][2]-m[0][2]*m[1][1])/det],
      [(m[1][2]*m[2][0]-m[1][0]*m[2][2])/det, (m[0][0]*m[2][2]-m[0][2]*m[2][0])/det, (m[0][2]*m[1][0]-m[0][0]*m[1][2])/det],
      [(m[1][0]*m[2][1]-m[1][1]*m[2][0])/det, (m[0][1]*m[2][0]-m[0][0]*m[2][1])/det, (m[0][0]*m[1][1]-m[0][1]*m[1][0])/det]
    ];
  };

  const processFile = async () => {
    if (!fileContent) {
      setError('Please upload a file first');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const parsed = parseQEOutput(fileContent);
      setParsedData(parsed);
      
      setConversionResults({
        cif: generateCIF(parsed),
        xyz: generateXYZ(parsed),
        poscar: generatePOSCAR(parsed)
      });
      
      setActiveTab('structure');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setIsProcessing(false);
    }
  };

  const getDftAdvice = async () => {
    if (!dftFileContent) {
      setDftError('Please upload a structure file first');
      return;
    }

    setIsDftProcessing(true);
    setDftError('');
    setDftAdvice('');
    setQeTemplate('');

    try {
      let structureData = dftParsedData;
      if (!structureData) {
        structureData = parseStructure(dftFileContent, dftFile?.name);
        setDftParsedData(structureData);
      }

      const volumePerAtom = structureData.volume / structureData.numAtoms;
      const prompt = `I need help setting up a Quantum ESPRESSO DFT calculation with these parameters:

**Structure Information:**
- Chemical formula: ${structureData.formula}
- Elements present: ${structureData.elements.join(', ')}
- Number of atoms: ${structureData.numAtoms}
- Cell dimensions (Å): a=${structureData.cellParams.a.toFixed(3)}, b=${structureData.cellParams.b.toFixed(3)}, c=${structureData.cellParams.c.toFixed(3)}
- Cell angles (°): α=${structureData.cellParams.alpha.toFixed(1)}, β=${structureData.cellParams.beta.toFixed(1)}, γ=${structureData.cellParams.gamma.toFixed(1)}
- Volume per atom: ${volumePerAtom.toFixed(2)} Å³

**Calculation Settings:**
- Calculation type: ${calcType}
- XC Functional: ${functional}

Please provide specific recommendations for:

1. **K-point grid**: Recommend optimal k-point mesh based on cell size and calculation type.
2. **Cutoff energies**: Recommend ecutwfc and ecutrho values appropriate for the elements present.
3. **Pseudopotentials**: Recommend specific pseudopotential types (NC, US, PAW) from SSSP or PseudoDojo.
4. **Convergence parameters**: Suggest conv_thr for SCF, and forc_conv_thr/press_conv_thr for relaxations.
5. **Smearing**: Recommend smearing type and degauss value based on material type.
6. **Additional tips**: Element-specific considerations (DFT+U, SOC, vdW corrections).`;

      const effectiveApiKey = apiKey;

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${effectiveApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: 'You are an expert in Density Functional Theory (DFT) calculations using Quantum ESPRESSO. Provide detailed, practical recommendations for setting up calculations. Be specific with numerical values.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      setDftAdvice(data.choices[0].message.content);

      if (generateTemplate) {
        setQeTemplate(generateQEInputTemplate(structureData));
      }

    } catch (err) {
      setDftError(err instanceof Error ? err.message : 'Failed to get DFT recommendations');
    } finally {
      setIsDftProcessing(false);
    }
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async (content: string, format: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedFormat(format);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const baseName = file?.name.replace(/\.[^/.]+$/, '') || 'structure';
  const dftBaseName = dftFile?.name.replace(/\.[^/.]+$/, '') || 'structure';

  return (
    <section id="qe-parser" className="py-20 bg-gradient-to-br from-white to-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 mb-4">
            Quantum ESPRESSO Tools
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Structure conversion and AI-powered DFT setup assistance for computational materials science
          </p>
        </div>

        <div className="max-w-5xl mx-auto mb-8">
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setActiveTool('converter')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-medium transition-all
                ${activeTool === 'converter' 
                  ? 'bg-white text-purple-600 shadow-md' 
                  : 'text-slate-600 hover:text-slate-900'}`}
            >
              <ArrowRightLeft className="w-5 h-5" />
              Structure Converter
            </button>
            <button
              onClick={() => setActiveTool('dft-assistant')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-medium transition-all
                ${activeTool === 'dft-assistant' 
                  ? 'bg-white text-purple-600 shadow-md' 
                  : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Brain className="w-5 h-5" />
              DFT Setup Assistant
            </button>
          </div>
        </div>

        {activeTool === 'converter' && (
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <ArrowRightLeft className="w-8 h-8 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Structure Format Converter</h3>
                  <p className="text-slate-600">Upload QE output and get CIF, XYZ, POSCAR instantly</p>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 flex gap-3">
                <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-purple-800">
                  <strong>Supported formats:</strong> Quantum ESPRESSO input (.in, .pw) and output (.out) files. 
                  Extracts CELL_PARAMETERS and ATOMIC_POSITIONS blocks and converts to standard crystallographic formats.
                </div>
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                  ${file ? 'border-purple-400 bg-purple-50' : 'border-slate-300 hover:border-purple-400 hover:bg-purple-50'}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  accept="*"
                  className="hidden"
                  title="Upload QE file"
                  aria-label="Upload Quantum ESPRESSO file"
                />
                <div>
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-8 h-8 text-purple-600" />
                      <div>
                        <p className="font-medium text-slate-900">{file.name}</p>
                        <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 font-medium">Drop your QE file here or click to browse</p>
                      <p className="text-sm text-slate-400 mt-2">Supports .in, .pw, .out files</p>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={processFile}
                disabled={!file || isProcessing}
                className={`w-full mt-6 py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all
                  ${!file || isProcessing 
                    ? 'bg-slate-300 cursor-not-allowed' 
                    : 'bg-purple-600 hover:bg-purple-700 shadow-lg hover:shadow-xl'}`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Atom className="w-5 h-5" />
                    Parse & Convert
                  </>
                )}
              </button>

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700">{error}</p>
                </div>
              )}

              {parsedData && conversionResults && (
                <div className="mt-8">
                  <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
                    {(['structure', 'cif', 'xyz', 'poscar'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 font-medium transition-colors relative whitespace-nowrap
                          ${activeTab === tab 
                            ? 'text-purple-600' 
                            : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        {tab.toUpperCase()}
                        {activeTab === tab && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
                        )}
                      </button>
                    ))}
                  </div>

                  {activeTab === 'structure' && (
                    <div className="space-y-6">
                      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-6 text-white">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white/20 rounded-lg">
                            <Atom className="w-8 h-8" />
                          </div>
                          <div>
                            <h4 className="text-2xl font-bold">{parsedData.formula}</h4>
                            <p className="text-purple-100">{parsedData.numAtoms} atoms • {parsedData.elements.join(', ')}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-6">
                        <h4 className="font-semibold text-slate-900 mb-4">Cell Parameters</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {[
                            { label: 'a', value: parsedData.cellParams.a, unit: 'Å' },
                            { label: 'b', value: parsedData.cellParams.b, unit: 'Å' },
                            { label: 'c', value: parsedData.cellParams.c, unit: 'Å' },
                            { label: 'α', value: parsedData.cellParams.alpha, unit: '°' },
                            { label: 'β', value: parsedData.cellParams.beta, unit: '°' },
                            { label: 'γ', value: parsedData.cellParams.gamma, unit: '°' },
                          ].map(({ label, value, unit }) => (
                            <div key={label} className="bg-white p-4 rounded-lg border border-slate-200">
                              <p className="text-sm text-slate-500">{label}</p>
                              <p className="text-lg font-mono font-semibold text-slate-900">
                                {value.toFixed(4)} {unit}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-6">
                        <h4 className="font-semibold text-slate-900 mb-4">Atomic Positions (Cartesian, Å)</h4>
                        <div className="max-h-64 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-200 sticky top-0">
                              <tr>
                                <th className="px-4 py-2 text-left">#</th>
                                <th className="px-4 py-2 text-left">Element</th>
                                <th className="px-4 py-2 text-right">X</th>
                                <th className="px-4 py-2 text-right">Y</th>
                                <th className="px-4 py-2 text-right">Z</th>
                              </tr>
                            </thead>
                            <tbody>
                              {parsedData.atoms.map((atom, i) => (
                                <tr key={i} className="border-b border-slate-200 hover:bg-slate-100">
                                  <td className="px-4 py-2 text-slate-500">{i + 1}</td>
                                  <td className="px-4 py-2 font-medium">{atom.symbol}</td>
                                  <td className="px-4 py-2 text-right font-mono">{atom.x.toFixed(6)}</td>
                                  <td className="px-4 py-2 text-right font-mono">{atom.y.toFixed(6)}</td>
                                  <td className="px-4 py-2 text-right font-mono">{atom.z.toFixed(6)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab !== 'structure' && conversionResults[activeTab] && (
                    <div>
                      <div className="flex gap-2 mb-4">
                        <button
                          onClick={() => downloadFile(conversionResults[activeTab]!, `${baseName}.${activeTab}`)}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download {activeTab.toUpperCase()}
                        </button>
                        <button
                          onClick={() => copyToClipboard(conversionResults[activeTab]!, activeTab)}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                        >
                          {copiedFormat === activeTab ? (
                            <>
                              <Check className="w-4 h-4 text-green-600" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="bg-slate-900 text-slate-100 p-6 rounded-xl overflow-x-auto text-sm font-mono max-h-96 overflow-y-auto">
                        {conversionResults[activeTab]}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTool === 'dft-assistant' && (
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">DFT Setup Assistant</h3>
                  <p className="text-slate-600">AI-powered parameter recommendations using Perplexity</p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 mb-6 flex gap-3">
                <Zap className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-purple-800">
                  <strong>Powered by Perplexity AI:</strong> Get intelligent recommendations for k-points, cutoff energies, 
                  pseudopotentials, convergence parameters, and element-specific settings based on your structure.
                </div>
              </div>

              <div
                onDrop={handleDftDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => dftFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all mb-6
                  ${dftFile ? 'border-purple-400 bg-purple-50' : 'border-slate-300 hover:border-purple-400 hover:bg-purple-50'}`}
              >
                <input
                  ref={dftFileInputRef}
                  type="file"
                  onChange={handleDftFileUpload}
                  accept="*"
                  className="hidden"
                  title="Upload structure file"
                  aria-label="Upload structure file for DFT"
                />
                <div>
                  {dftFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-8 h-8 text-purple-600" />
                      <div>
                        <p className="font-medium text-slate-900">{dftFile.name}</p>
                        <p className="text-sm text-slate-500">
                          {dftParsedData ? `${dftParsedData.formula} • ${dftParsedData.numAtoms} atoms` : dftError ? 'Parse error' : 'Parsing...'}
                        </p>
                      </div>
                      {dftParsedData && <CheckCircle className="w-6 h-6 text-green-500" />}
                      {dftError && <AlertCircle className="w-6 h-6 text-red-500" />}
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 font-medium">Upload structure file</p>
                      <p className="text-sm text-slate-400 mt-2">Supports CIF, XYZ, POSCAR, QE (.in, .pw, .out)</p>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Settings className="w-4 h-4 inline mr-1" />
                    Calculation Type
                  </label>
                  <div className="relative">
                    <select
                      value={calcType}
                      onChange={(e) => setCalcType(e.target.value)}
                      title="Select calculation type"
                      className="w-full p-3 border border-slate-300 rounded-lg appearance-none bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="scf">SCF (Self-Consistent Field)</option>
                      <option value="relax">Relax (Atomic Positions)</option>
                      <option value="vc-relax">VC-Relax (Variable Cell)</option>
                      <option value="bands">Bands (Band Structure)</option>
                      <option value="nscf">NSCF (Non-SCF)</option>
                      <option value="dos">DOS (Density of States)</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Atom className="w-4 h-4 inline mr-1" />
                    XC Functional
                  </label>
                  <div className="relative">
                    <select
                      value={functional}
                      onChange={(e) => setFunctional(e.target.value)}
                      title="Select XC functional"
                      className="w-full p-3 border border-slate-300 rounded-lg appearance-none bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="PBE">PBE</option>
                      <option value="PBEsol">PBEsol</option>
                      <option value="LDA">LDA</option>
                      <option value="SCAN">SCAN</option>
                      <option value="r2SCAN">r2SCAN</option>
                      <option value="HSE">HSE (Hybrid)</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Perplexity API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="pplx-..."
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Get your API key from <a href="https://www.perplexity.ai/settings/api" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">perplexity.ai/settings/api</a>
                </p>
              </div>

              <div className="flex items-center gap-2 mb-6">
                <input
                  type="checkbox"
                  id="generateTemplate"
                  checked={generateTemplate}
                  onChange={(e) => setGenerateTemplate(e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="generateTemplate" className="text-sm text-slate-700">
                  Also generate QE input template
                </label>
              </div>

              <button
                onClick={getDftAdvice}
                disabled={!dftFile || !dftParsedData || isDftProcessing || !apiKey}
                className={`w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all
                  ${!dftFile || !dftParsedData || isDftProcessing || !apiKey
                    ? 'bg-slate-300 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'}`}
              >
                {isDftProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Getting AI Recommendations...
                  </>
                ) : (
                  <>
                    <Brain className="w-5 h-5" />
                    Get DFT Recommendations
                  </>
                )}
              </button>
              
              {!apiKey && dftFile && (
                <p className="text-sm text-amber-600 mt-2 text-center">
                  ⚠️ Please enter your Perplexity API key to get recommendations
                </p>
              )}

              {dftError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700">{dftError}</p>
                </div>
              )}

              {dftAdvice && (
                <div className="mt-8 space-y-6">
                  <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-4 text-white flex items-center gap-3">
                    <Brain className="w-6 h-6" />
                    <h4 className="text-lg font-semibold">AI-Generated DFT Recommendations</h4>
                  </div>
                  
                  <div className="bg-slate-50 rounded-xl p-6">
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => downloadFile(dftAdvice, `${dftBaseName}_dft_advice.md`)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download Advice
                      </button>
                      <button
                        onClick={() => copyToClipboard(dftAdvice, 'advice')}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                      >
                        {copiedFormat === 'advice' ? (
                          <>
                            <Check className="w-4 h-4 text-green-600" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm bg-white p-4 rounded-lg border border-slate-200 max-h-96 overflow-y-auto">
                      {dftAdvice}
                    </pre>
                  </div>
                </div>
              )}

              {qeTemplate && (
                <div className="mt-6">
                  <div className="bg-slate-800 text-white rounded-xl p-4 flex items-center gap-3 mb-4">
                    <FileText className="w-6 h-6" />
                    <h4 className="text-lg font-semibold">Generated QE Input Template</h4>
                  </div>
                  
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => downloadFile(qeTemplate, `${dftBaseName}_${calcType}.in`)}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download .in File
                    </button>
                    <button
                      onClick={() => copyToClipboard(qeTemplate, 'template')}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                    >
                      {copiedFormat === 'template' ? (
                        <>
                          <Check className="w-4 h-4 text-green-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="bg-slate-900 text-slate-100 p-6 rounded-xl overflow-x-auto text-sm font-mono max-h-96 overflow-y-auto">
                    {qeTemplate}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default QEParser;
