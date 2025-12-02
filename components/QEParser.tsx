import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, AlertCircle, CheckCircle, Atom, ArrowRightLeft, Sparkles, Copy, Check } from 'lucide-react';

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
}

interface ConversionResult {
  cif?: string;
  xyz?: string;
  poscar?: string;
}

const QEParser: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParsedStructure | null>(null);
  const [conversionResults, setConversionResults] = useState<ConversionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'structure' | 'cif' | 'xyz' | 'poscar'>('structure');
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const parseQEOutput = (content: string): ParsedStructure => {
    const lines = content.split('\n');
    
    // Extract cell parameters
    let cellVectors: number[][] = [];
    let atoms: Array<{symbol: string; x: number; y: number; z: number}> = [];
    
    // Find CELL_PARAMETERS block (last occurrence)
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().toUpperCase().startsWith('CELL_PARAMETERS')) {
        const unit = lines[i].includes('bohr') ? 0.529177 : 1; // Convert bohr to angstrom
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
    
    // Find ATOMIC_POSITIONS block (last occurrence)
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
            
            // Convert fractional to cartesian if needed
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
      throw new Error('Could not find valid CELL_PARAMETERS block');
    }
    if (atoms.length === 0) {
      throw new Error('Could not find valid ATOMIC_POSITIONS block');
    }
    
    // Calculate cell parameters from vectors
    const a = Math.sqrt(cellVectors[0][0]**2 + cellVectors[0][1]**2 + cellVectors[0][2]**2);
    const b = Math.sqrt(cellVectors[1][0]**2 + cellVectors[1][1]**2 + cellVectors[1][2]**2);
    const c = Math.sqrt(cellVectors[2][0]**2 + cellVectors[2][1]**2 + cellVectors[2][2]**2);
    
    const dot = (v1: number[], v2: number[]) => v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2];
    const alpha = Math.acos(dot(cellVectors[1], cellVectors[2]) / (b * c)) * 180 / Math.PI;
    const beta = Math.acos(dot(cellVectors[0], cellVectors[2]) / (a * c)) * 180 / Math.PI;
    const gamma = Math.acos(dot(cellVectors[0], cellVectors[1]) / (a * b)) * 180 / Math.PI;
    
    // Get chemical formula
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
      cellVectors
    };
  };

  const generateCIF = (data: ParsedStructure): string => {
    const { cellParams, atoms, cellVectors } = data;
    
    // Calculate fractional coordinates
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
    
    // Group atoms by element
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
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const parsed = parseQEOutput(fileContent);
      setParsedData(parsed);
      
      // Generate all formats
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

  return (
    <section id="qe-parser" className="py-20 bg-gradient-to-br from-white to-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 mb-4">
            QE Structure Converter
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Parse Quantum ESPRESSO output files and convert structures to CIF, XYZ, or POSCAR formats
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
            {/* Tool Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-purple-100 rounded-lg">
                <ArrowRightLeft className="w-8 h-8 text-purple-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Structure Format Converter</h3>
                <p className="text-slate-600">Upload QE output and get CIF, XYZ, POSCAR instantly</p>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 flex gap-3">
              <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-purple-800">
                <strong>Supported formats:</strong> Quantum ESPRESSO input (.in, .pw) and output (.out) files. 
                Extracts CELL_PARAMETERS and ATOMIC_POSITIONS blocks and converts to standard crystallographic formats.
              </div>
            </div>

            {/* File Upload Area */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
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
              <div onClick={() => fileInputRef.current?.click()}>
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

            {/* Parse Button */}
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

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {/* Results */}
            {parsedData && conversionResults && (
              <div className="mt-8">
                {/* Tabs */}
                <div className="flex border-b border-slate-200 mb-6">
                  {(['structure', 'cif', 'xyz', 'poscar'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-6 py-3 font-medium transition-colors relative
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

                {/* Tab Content */}
                {activeTab === 'structure' && (
                  <div className="space-y-6">
                    {/* Summary Card */}
                    <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-6 text-white">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-lg">
                          <Atom className="w-8 h-8" />
                        </div>
                        <div>
                          <h4 className="text-2xl font-bold">{parsedData.formula}</h4>
                          <p className="text-purple-100">{parsedData.numAtoms} atoms</p>
                        </div>
                      </div>
                    </div>

                    {/* Cell Parameters */}
                    <div className="bg-slate-50 rounded-xl p-6">
                      <h4 className="font-semibold text-slate-900 mb-4">Cell Parameters</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-lg border border-slate-200">
                          <p className="text-sm text-slate-500">a</p>
                          <p className="text-lg font-mono font-semibold text-slate-900">
                            {parsedData.cellParams.a.toFixed(4)} Å
                          </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-slate-200">
                          <p className="text-sm text-slate-500">b</p>
                          <p className="text-lg font-mono font-semibold text-slate-900">
                            {parsedData.cellParams.b.toFixed(4)} Å
                          </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-slate-200">
                          <p className="text-sm text-slate-500">c</p>
                          <p className="text-lg font-mono font-semibold text-slate-900">
                            {parsedData.cellParams.c.toFixed(4)} Å
                          </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-slate-200">
                          <p className="text-sm text-slate-500">α</p>
                          <p className="text-lg font-mono font-semibold text-slate-900">
                            {parsedData.cellParams.alpha.toFixed(2)}°
                          </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-slate-200">
                          <p className="text-sm text-slate-500">β</p>
                          <p className="text-lg font-mono font-semibold text-slate-900">
                            {parsedData.cellParams.beta.toFixed(2)}°
                          </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-slate-200">
                          <p className="text-sm text-slate-500">γ</p>
                          <p className="text-lg font-mono font-semibold text-slate-900">
                            {parsedData.cellParams.gamma.toFixed(2)}°
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Atomic Positions */}
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
      </div>
    </section>
  );
};

export default QEParser;
