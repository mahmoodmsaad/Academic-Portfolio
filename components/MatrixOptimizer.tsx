import React, { useState } from 'react';
import { Calculator, Download, Info, Loader } from 'lucide-react';

interface OptimizationResult {
  matrix: number[][];
  lattice_a: number;
  lattice_b: number;
  lattice_c: number;
  alpha: number;
  beta: number;
  gamma: number;
  num_atoms: number;
  score: number;
}

const MatrixOptimizer: React.FC = () => {
  const [targetA, setTargetA] = useState('22.0');
  const [targetB, setTargetB] = useState('22.0');
  const [targetGamma, setTargetGamma] = useState('80.0');
  const [maxVal, setMaxVal] = useState('12');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [results, setResults] = useState<OptimizationResult[]>([]);
  const [error, setError] = useState('');

  const optimizeMatrix = async () => {
    setIsOptimizing(true);
    setError('');
    setResults([]);

    try {
      // Simulated optimization (in production, this would call a backend API)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock results for demonstration
      const mockResults: OptimizationResult[] = [
        {
          matrix: [[7, 0, 0], [0, 7, 0], [0, 0, 1]],
          lattice_a: 21.98,
          lattice_b: 22.03,
          lattice_c: 5.24,
          alpha: 90.0,
          beta: 90.0,
          gamma: 79.8,
          num_atoms: 98,
          score: 0.024
        },
        {
          matrix: [[6, 1, 0], [-1, 6, 0], [0, 0, 1]],
          lattice_a: 21.87,
          lattice_b: 21.92,
          lattice_c: 5.24,
          alpha: 90.1,
          beta: 90.0,
          gamma: 80.3,
          num_atoms: 74,
          score: 0.031
        },
        {
          matrix: [[5, 2, 0], [2, 5, 0], [0, 0, 1]],
          lattice_a: 22.15,
          lattice_b: 22.10,
          lattice_c: 5.24,
          alpha: 89.9,
          beta: 90.1,
          gamma: 79.6,
          num_atoms: 58,
          score: 0.038
        }
      ];

      setResults(mockResults);
    } catch (err) {
      setError('Optimization failed. Please check your parameters.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const downloadResults = () => {
    const resultsText = results.map((r, i) => 
      `Result ${i + 1}:\nMatrix: [${r.matrix.map(row => `[${row.join(', ')}]`).join(', ')}]\n` +
      `Lattice: a=${r.lattice_a.toFixed(2)}Å, b=${r.lattice_b.toFixed(2)}Å, c=${r.lattice_c.toFixed(2)}Å\n` +
      `Angles: α=${r.alpha.toFixed(1)}°, β=${r.beta.toFixed(1)}°, γ=${r.gamma.toFixed(1)}°\n` +
      `Atoms: ${r.num_atoms}, Score: ${r.score.toFixed(4)}\n\n`
    ).join('');

    const blob = new Blob([resultsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'matrix_optimization_results.txt';
    a.click();
  };

  return (
    <section id="tools" className="py-20 bg-gradient-to-br from-slate-50 to-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 mb-4">
            Computational Tools
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Interactive scientific computing tools for materials research
          </p>
        </div>

        {/* Matrix Optimizer Tool */}
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-academic-100 rounded-lg">
                <Calculator className="w-8 h-8 text-academic-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Supercell Matrix Optimizer</h3>
                <p className="text-slate-600">Find optimal supercell matrices for 2D materials (hBN/Phosphorene)</p>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">About this tool:</p>
                <p>This optimizer searches for supercell transformation matrices that minimize lattice mismatch between substrate and 2D materials. 
                   It's particularly useful for heterostructure design and epitaxial growth studies.</p>
              </div>
            </div>

            {/* Input Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Target Lattice a (Å)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={targetA}
                  onChange={(e) => setTargetA(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-academic-500 focus:border-academic-500"
                  placeholder="22.0"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Target Lattice b (Å)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={targetB}
                  onChange={(e) => setTargetB(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-academic-500 focus:border-academic-500"
                  placeholder="22.0"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Target Gamma (°)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={targetGamma}
                  onChange={(e) => setTargetGamma(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-academic-500 focus:border-academic-500"
                  placeholder="80.0"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Max Matrix Value
                </label>
                <input
                  type="number"
                  step="1"
                  value={maxVal}
                  onChange={(e) => setMaxVal(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-academic-500 focus:border-academic-500"
                  placeholder="12"
                />
              </div>
            </div>

            {/* Optimize Button */}
            <button
              onClick={optimizeMatrix}
              disabled={isOptimizing}
              className="w-full bg-academic-600 text-white py-4 rounded-lg font-semibold hover:bg-academic-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-academic-600/30"
            >
              {isOptimizing ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Calculator className="w-5 h-5" />
                  Run Optimization
                </>
              )}
            </button>

            {/* Error Message */}
            {error && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                {error}
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xl font-bold text-slate-900">Optimization Results (Top {results.length})</h4>
                  <button
                    onClick={downloadResults}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>

                <div className="space-y-4">
                  {results.map((result, index) => (
                    <div key={index} className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-academic-100 text-academic-700 w-10 h-10 rounded-full flex items-center justify-center font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">Score: {result.score.toFixed(4)}</p>
                            <p className="text-sm text-slate-600">{result.num_atoms} atoms</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-700 mb-2">Transformation Matrix:</p>
                          <div className="bg-white p-3 rounded border border-slate-200 font-mono text-sm">
                            {result.matrix.map((row, i) => (
                              <div key={i}>[{row.join(', ')}]</div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-slate-700 mb-2">Lattice Parameters:</p>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div className="bg-white p-2 rounded border border-slate-200">
                              <p className="text-xs text-slate-500">a</p>
                              <p className="font-semibold">{result.lattice_a.toFixed(2)} Å</p>
                            </div>
                            <div className="bg-white p-2 rounded border border-slate-200">
                              <p className="text-xs text-slate-500">b</p>
                              <p className="font-semibold">{result.lattice_b.toFixed(2)} Å</p>
                            </div>
                            <div className="bg-white p-2 rounded border border-slate-200">
                              <p className="text-xs text-slate-500">c</p>
                              <p className="font-semibold">{result.lattice_c.toFixed(2)} Å</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div className="bg-white p-2 rounded border border-slate-200">
                              <p className="text-xs text-slate-500">α</p>
                              <p className="font-semibold">{result.alpha.toFixed(1)}°</p>
                            </div>
                            <div className="bg-white p-2 rounded border border-slate-200">
                              <p className="text-xs text-slate-500">β</p>
                              <p className="font-semibold">{result.beta.toFixed(1)}°</p>
                            </div>
                            <div className="bg-white p-2 rounded border border-slate-200">
                              <p className="text-xs text-slate-500">γ</p>
                              <p className="font-semibold">{result.gamma.toFixed(1)}°</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
                  <p className="font-semibold mb-1">Note:</p>
                  <p>This is a client-side demonstration. For actual calculations with your structure files, 
                     the backend API integration is required. Contact me to enable full functionality with your specific materials.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MatrixOptimizer;
