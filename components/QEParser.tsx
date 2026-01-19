import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, AlertCircle, CheckCircle, Atom, ArrowRightLeft, Sparkles, Copy, Check, Brain, Zap, Settings, ChevronDown } from 'lucide-react';
import {
  ParsedStructure,
  detectFormat,
  parseCIF,
  parseXYZ,
  parsePOSCAR,
  parseQEFormat,
  parseStructure,
  cellParamsToVectors,
  vectorsToCellParams,
  calculateVolume
} from '../utils/qeParserUtils';

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
  const [aiProvider, setAiProvider] = useState<'perplexity' | 'deepseek'>('perplexity');
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
    const { formula, atoms, cellVectors, elements, numAtoms, cellParams } = data;
    
    // Extended atomic masses including heavier elements
    const atomicMasses: {[key: string]: number} = {
      'H': 1.008, 'He': 4.003, 'Li': 6.941, 'Be': 9.012, 'B': 10.81, 'C': 12.01,
      'N': 14.01, 'O': 16.00, 'F': 19.00, 'Ne': 20.18, 'Na': 22.99, 'Mg': 24.31,
      'Al': 26.98, 'Si': 28.09, 'P': 30.97, 'S': 32.07, 'Cl': 35.45, 'Ar': 39.95,
      'K': 39.10, 'Ca': 40.08, 'Sc': 44.96, 'Ti': 47.87, 'V': 50.94, 'Cr': 52.00,
      'Mn': 54.94, 'Fe': 55.85, 'Co': 58.93, 'Ni': 58.69, 'Cu': 63.55, 'Zn': 65.38,
      'Ga': 69.72, 'Ge': 72.63, 'As': 74.92, 'Se': 78.97, 'Br': 79.90, 'Kr': 83.80,
      'Rb': 85.47, 'Sr': 87.62, 'Y': 88.91, 'Zr': 91.22, 'Nb': 92.91, 'Mo': 95.94,
      'Tc': 98.00, 'Ru': 101.1, 'Rh': 102.9, 'Pd': 106.4, 'Ag': 107.9, 'Cd': 112.4,
      'In': 114.8, 'Sn': 118.7, 'Sb': 121.8, 'Te': 127.6, 'I': 126.9, 'Xe': 131.3,
      'Cs': 132.9, 'Ba': 137.3, 'La': 138.9, 'Ce': 140.1, 'Hf': 178.5, 'Ta': 180.9,
      'W': 183.8, 'Re': 186.2, 'Os': 190.2, 'Ir': 192.2, 'Pt': 195.1, 'Au': 197.0,
      'Hg': 200.6, 'Tl': 204.4, 'Pb': 207.2, 'Bi': 209.0
    };
    
    // Heavy elements that need higher cutoffs and may need SOC
    const heavyElements = ['Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'W', 'Re', 'Os', 'Ir', 'Ta', 'Hf'];
    const transitionMetals = ['Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
      'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd',
      'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au'];
    
    // Detect if it's a 2D system (one axis much larger than others)
    const { a, b, c } = cellParams;
    const maxAxis = Math.max(a, b, c);
    const minAxis = Math.min(a, b, c);
    const is2D = maxAxis / minAxis > 3; // If one axis is 3x larger, likely 2D/slab
    
    // Determine which axis is vacuum (for 2D systems)
    let kx = 4, ky = 4, kz = 4;
    if (is2D) {
      if (c === maxAxis) { kz = 1; kx = 6; ky = 6; }
      else if (b === maxAxis) { ky = 1; kx = 6; kz = 6; }
      else { kx = 1; ky = 6; kz = 6; }
    }
    
    // Check for heavy elements
    const hasHeavyElements = elements.some(el => heavyElements.includes(el));
    const hasTransitionMetals = elements.some(el => transitionMetals.includes(el));
    const isMetallic = hasTransitionMetals || hasHeavyElements;
    
    // Set cutoffs based on elements
    let ecutwfc = 60;
    let ecutrho = 480;
    if (hasHeavyElements) {
      ecutwfc = 70;
      ecutrho = 560;
    }
    
    // Set smearing based on system type
    const smearing = isMetallic ? 'mv' : 'gaussian';
    const mixingBeta = hasHeavyElements ? 0.3 : 0.7;
    
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
    lines.push(`  ecutwfc = ${ecutwfc}.0`);
    lines.push(`  ecutrho = ${ecutrho}.0`);
    lines.push("  occupations = 'smearing'");
    lines.push(`  smearing = '${smearing}'`);
    lines.push('  degauss = 0.01');
    if (hasHeavyElements) {
      lines.push('  ! For heavy elements, consider adding:');
      lines.push('  ! lspinorb = .true.');
      lines.push('  ! noncolin = .true.');
    }
    lines.push('/\n');
    
    lines.push('&ELECTRONS');
    lines.push('  conv_thr = 1.0d-8');
    lines.push(`  mixing_beta = ${mixingBeta}`);
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
    lines.push(`  ${kx} ${ky} ${kz} 0 0 0`);
    
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

      // Call Lambda backend (API keys are stored securely on server)
      const response = await fetch('https://b0q9fbz7nl.execute-api.us-east-1.amazonaws.com/prod/dft-advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          provider: aiProvider
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API request failed: ${response.status}`);
      }

      const data = await response.json();
      setDftAdvice(data.content);

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
                  AI Provider
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setAiProvider('perplexity')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2
                      ${aiProvider === 'perplexity'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    <Sparkles className="w-4 h-4" />
                    Perplexity AI
                  </button>
                  <button
                    onClick={() => setAiProvider('deepseek')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2
                      ${aiProvider === 'deepseek'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    <Brain className="w-4 h-4" />
                    DeepSeek
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2 text-center">
                  Choose your preferred AI model for DFT recommendations
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
                disabled={!dftFile || !dftParsedData || isDftProcessing}
                className={`w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all
                  ${!dftFile || !dftParsedData || isDftProcessing
                    ? 'bg-slate-300 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'}`}
              >
                {isDftProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Getting {aiProvider === 'deepseek' ? 'DeepSeek' : 'Perplexity'} Recommendations...
                  </>
                ) : (
                  <>
                    <Brain className="w-5 h-5" />
                    Get DFT Recommendations
                  </>
                )}
              </button>

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
