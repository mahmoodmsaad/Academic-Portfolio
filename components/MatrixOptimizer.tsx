import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Calculator, Download, Info, ChevronRight, ChevronLeft,
  CheckCircle, AlertCircle, Upload, Play, Square, RotateCcw, Atom, Loader2, Brain,
} from 'lucide-react';
import { METALS, MONOLAYER_PRESETS, getMetalBySymbol, getMonolayerByName } from '../utils/monolayerDatabase';
import { computeSurfaceTargets } from '../utils/surfaceCalculator';
import { parseCIFLatticeParams } from '../utils/matrixMath';
import type {
  BaseAtom, WizardStep, SurfaceCellParams, MonolayerMaterial, MatrixResult,
  TargetResults, WorkerOutMessage, WorkerProgressMessage,
} from '../utils/matrixOptimizerTypes';

// Surface-target API endpoint (defaults to the hosted endpoint if env var is unset).
// Optionally set VITE_SURFACE_API_PYMATGEN to route pymatgen requests to a separate endpoint.
const DEFAULT_SURFACE_API_URL = 'https://oy34w61rc6.execute-api.us-east-1.amazonaws.com/prod/surface-targets';
const configuredSurfaceApi = import.meta.env.VITE_SURFACE_API;
const SURFACE_API_URL =
  configuredSurfaceApi === undefined ? DEFAULT_SURFACE_API_URL : configuredSurfaceApi.trim();
const SURFACE_API_PYMATGEN_URL = import.meta.env.VITE_SURFACE_API_PYMATGEN?.trim() || '';

// === Tier badge colors ===
const TIER_STYLES: Record<string, string> = {
  excellent: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  good: 'bg-teal-100 text-teal-800 border-teal-300',
  acceptable: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  marginal: 'bg-orange-100 text-orange-800 border-orange-300',
};

const TIER_LABELS: Record<string, string> = {
  excellent: '<1%',
  good: '<3%',
  acceptable: '<5%',
  marginal: '<7%',
};

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'surface', label: 'Surface Target' },
  { id: 'monolayer', label: 'Monolayer' },
  { id: 'optimize', label: 'Optimize' },
  { id: 'results', label: 'Results' },
];

const STEP_ORDER: WizardStep[] = ['surface', 'monolayer', 'optimize', 'results'];

const MatrixOptimizer: React.FC = () => {
  // === Wizard state ===
  const [step, setStep] = useState<WizardStep>('surface');

  // === Step 1: Surface target ===
  const [elementMode, setElementMode] = useState<'preset' | 'custom'>('preset');
  const [selectedMetal, setSelectedMetal] = useState('Pt');
  const [customElement, setCustomElement] = useState('');
  const [millerH, setMillerH] = useState(1);
  const [millerK, setMillerK] = useState(1);
  const [millerL, setMillerL] = useState(1);
  const [surfaceTargets, setSurfaceTargets] = useState<SurfaceCellParams[] | null>(null);
  const [surfaceError, setSurfaceError] = useState('');
  const [surfaceBackendNote, setSurfaceBackendNote] = useState('');
  const [isComputingTargets, setIsComputingTargets] = useState(false);
  const [targetMethod, setTargetMethod] = useState<'ase' | 'pymatgen' | 'analytical' | null>(null);
  const [bulkInfo, setBulkInfo] = useState<Record<string, unknown> | null>(null);
  const [supercellBackend, setSupercellBackend] = useState<'ase' | 'pymatgen'>('ase');

  // === Step 2: Monolayer ===
  const [monolayerMode, setMonolayerMode] = useState<'preset' | 'custom' | 'cif'>('preset');
  const [selectedPreset, setSelectedPreset] = useState('hBN');
  const [customA, setCustomA] = useState('');
  const [customB, setCustomB] = useState('');
  const [customGamma, setCustomGamma] = useState('120');
  const [customAtomsPerCell, setCustomAtomsPerCell] = useState('2');
  const [cifParsed, setCifParsed] = useState<{ a: number; b: number; gamma: number; atoms: BaseAtom[] } | null>(null);
  const [cifError, setCifError] = useState('');
  const [monolayer, setMonolayer] = useState<MonolayerMaterial | null>(null);

  // === Step 3: Optimization ===
  const [duration, setDuration] = useState(180); // seconds
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState<WorkerProgressMessage['data'] | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // === Step 4: Results ===
  const [results, setResults] = useState<TargetResults[] | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // === DFT Setup Assistant ===
  const [dftProvider, setDftProvider] = useState<'perplexity' | 'deepseek'>('perplexity');
  const [dftCalcType, setDftCalcType] = useState('relax');
  const [dftAdvice, setDftAdvice] = useState<string | null>(null);
  const [isDftLoading, setIsDftLoading] = useState(false);
  const [dftError, setDftError] = useState('');

  // === Blob URL tracking for memory cleanup ===
  const blobUrlsRef = useRef<string[]>([]);

  // === Reset DFT advice when switching supercell tabs ===
  useEffect(() => {
    setDftAdvice(null);
    setDftError('');
  }, [activeTab]);

  // === Cleanup worker + blob URLs on unmount ===
  useEffect(() => {
    return () => {
      if (workerRef.current) workerRef.current.terminate();
      // Revoke all tracked blob URLs to free memory
      for (const url of blobUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      blobUrlsRef.current = [];
    };
  }, []);

  // === Step 1: Compute surface targets (ASE Lambda first, then JS fallback) ===
  const computeTargets = async () => {
    setSurfaceError('');
    setSurfaceBackendNote('');
    setSurfaceTargets(null);
    setTargetMethod(null);
    setBulkInfo(null);
    setIsComputingTargets(true);

    const element = elementMode === 'custom' ? customElement.trim() : selectedMetal;
    if (!element) {
      setSurfaceError('Please enter an element symbol.');
      setIsComputingTargets(false);
      return;
    }
    if (millerH === 0 && millerK === 0 && millerL === 0) {
      setSurfaceError('Miller indices cannot all be zero.');
      setIsComputingTargets(false);
      return;
    }

    const endpoint =
      supercellBackend === 'pymatgen' && SURFACE_API_PYMATGEN_URL
        ? SURFACE_API_PYMATGEN_URL
        : SURFACE_API_URL;

    // Try surface-target API first
    if (endpoint) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ element, h: millerH, k: millerK, l: millerL, backend: supercellBackend }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `API error: ${response.status}`);
        }

        const data = await response.json();
        if (data.success && data.targets) {
          const responseBackend =
            data.backend === 'pymatgen' || data.backend === 'ase'
              ? data.backend
              : null;

          setSurfaceTargets(data.targets);
          setTargetMethod(responseBackend ?? 'ase');
          if (supercellBackend === 'pymatgen' && responseBackend !== 'pymatgen') {
            if (responseBackend === 'ase') {
              setSurfaceBackendNote('Pymatgen was selected, but the API responded with ASE. This endpoint appears ASE-only.');
            } else {
              setSurfaceBackendNote('Pymatgen was selected, but the API did not report backend information. This usually indicates an older ASE-only deployment.');
            }
          }
          if (data.bulk_info) setBulkInfo(data.bulk_info);
          setIsComputingTargets(false);
          return;
        }
        throw new Error(data.error || 'Invalid API response');
      } catch (err) {
        // API failed — fall through to JS fallback
        console.warn('Surface API unavailable, using analytical fallback:', err);
      }
    }

    // Fallback: JS analytical surface calculator
    try {
      const metal = getMetalBySymbol(element);
      if (!metal) throw new Error(`Element "${element}" not in preset database. Deploy the ASE Lambda for full element support.`);
      const targets = computeSurfaceTargets(metal, millerH, millerK, millerL);
      setSurfaceTargets(targets);
      setTargetMethod('analytical');
    } catch (err) {
      setSurfaceError(err instanceof Error ? err.message : 'Failed to compute surface cell');
    }
    setIsComputingTargets(false);
  };

  // === Step 2: Set monolayer and start optimization ===
  const confirmAndStart = () => {
    let mat: MonolayerMaterial | null = null;

    if (monolayerMode === 'preset') {
      mat = getMonolayerByName(selectedPreset) || null;
    } else if (monolayerMode === 'custom') {
      const a = parseFloat(customA);
      const b = parseFloat(customB);
      const g = parseFloat(customGamma);
      const atoms = parseInt(customAtomsPerCell);
      if (isNaN(a) || isNaN(b) || isNaN(g) || a <= 0 || b <= 0 || g <= 0 || g >= 180) return;
      mat = {
        name: 'Custom',
        a, b, gamma: g,
        atoms_per_cell: isNaN(atoms) ? 2 : atoms,
        crystal_system: Math.abs(g - 120) < 1 ? 'hexagonal' : Math.abs(g - 90) < 1 ? 'rectangular' : 'oblique',
      };
    } else if (monolayerMode === 'cif' && cifParsed) {
      const atomsPerCell = Math.max(1, cifParsed.atoms.length || 2);
      mat = {
        name: 'CIF Upload',
        a: cifParsed.a, b: cifParsed.b, gamma: cifParsed.gamma,
        atoms_per_cell: atomsPerCell,
        crystal_system: Math.abs(cifParsed.gamma - 120) < 1 ? 'hexagonal' : Math.abs(cifParsed.gamma - 90) < 1 ? 'rectangular' : 'oblique',
        baseAtoms: cifParsed.atoms.length ? cifParsed.atoms : undefined,
      };
    }

    if (mat) {
      setMonolayer(mat);
      // Start optimization immediately
      startOptimizationWithMaterial(mat);
    }
  };

  // === CIF upload handler ===
  const handleCifUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCifError('');
    setCifParsed(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const params = parseCIFLatticeParams(content);
        setCifParsed(params);
      } catch (err) {
        setCifError(err instanceof Error ? err.message : 'Failed to parse CIF');
      }
    };
    reader.readAsText(file);
  };

  // === Step 3: Start optimization ===
  const startOptimizationWithMaterial = useCallback((mat: MonolayerMaterial) => {
    if (!surfaceTargets) return;
    setIsOptimizing(true);
    setProgress(null);
    setResults(null);
    setStep('optimize');

    const worker = new Worker(
      new URL('../workers/matrixOptimizationWorker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data;
      if (msg.type === 'progress') {
        setProgress(msg.data);
      } else if (msg.type === 'result') {
        setResults(msg.data.all_results);
        setProgress(prev => prev ? { ...prev, progress_pct: 100, matrices_tested: msg.data.total_tested, elapsed_ms: msg.data.elapsed_ms } : null);
        setIsOptimizing(false);
        setStep('results');
        worker.terminate();
        workerRef.current = null;
      } else if (msg.type === 'error') {
        setIsOptimizing(false);
        setSurfaceError((msg as { type: 'error'; data: { message: string } }).data.message);
        setStep('surface');
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.postMessage({
      type: 'start',
      config: {
        targets: surfaceTargets,
        monolayer: mat,
        duration_ms: duration * 1000,
        scan_limit: 20,
        target_method: targetMethod,
      },
    });
  }, [surfaceTargets, duration, targetMethod]);

  const stopOptimization = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'stop' });
      setTimeout(() => {
        if (progress?.best_results_so_far) {
          setResults(progress.best_results_so_far);
          setStep('results');
        }
        setIsOptimizing(false);
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }
      }, 500);
    }
  }, [progress]);

  // === Download results ===
  const activeElement = elementMode === 'custom' ? customElement.trim() : selectedMetal;

  const downloadResults = () => {
    if (!results) return;
    let text = `Universal Matrix Optimizer Results\n`;
    text += `${'='.repeat(60)}\n`;
    text += `Element: ${activeElement}\n`;
    text += `Surface: (${millerH}${millerK}${millerL})\n`;
    text += `Target method: ${targetMethod === 'ase' ? 'ASE (Atomic Simulation Environment)' : targetMethod === 'pymatgen' ? 'Pymatgen (Python Materials Genomics)' : 'Analytical'}\n`;
    text += `Monolayer: ${monolayer?.name} (a=${monolayer?.a}, b=${monolayer?.b}, gamma=${monolayer?.gamma})\n`;
    text += `Date: ${new Date().toISOString()}\n\n`;

    for (const tr of results) {
      text += `${'='.repeat(60)}\n`;
      text += `Target: ${tr.target.label} (a=${tr.target.a.toFixed(4)}, b=${tr.target.b.toFixed(4)}, gamma=${tr.target.gamma.toFixed(2)})\n`;
      text += `${'='.repeat(60)}\n`;

      if (tr.results.length === 0) {
        text += `  No matches found within 10% error.\n\n`;
        continue;
      }

      for (const [i, r] of tr.results.entries()) {
        text += `#${i + 1} Matrix: [[${r.matrix[0]}, ${r.matrix[1]}, 0], [${r.matrix[2]}, ${r.matrix[3]}, 0], [0, 0, 1]]\n`;
        text += `   Params: a=${r.achieved_a.toFixed(4)} A, b=${r.achieved_b.toFixed(4)} A, gamma=${r.achieved_gamma.toFixed(2)} deg\n`;
        text += `   Errors: a=${r.error_a_pct.toFixed(2)}%, b=${r.error_b_pct.toFixed(2)}%, gamma=${r.error_gamma_pct.toFixed(2)}%\n`;
        text += `   Atoms: ${r.atom_count}, Score: ${r.score.toFixed(4)}, Tier: ${r.tier}\n\n`;
      }
    }

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    blobUrlsRef.current.push(url);
    const a = document.createElement('a');
    a.href = url;
    a.download = `matrix_optimizer_${activeElement}_${millerH}${millerK}${millerL}_${monolayer?.name || 'custom'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    blobUrlsRef.current = blobUrlsRef.current.filter(u => u !== url);
  };

  // === DFT: extract unique element symbols from monolayer ===
  const getMonolayerElements = (ml: MonolayerMaterial): string[] => {
    if (ml.baseAtoms && ml.baseAtoms.length > 0) {
      return [...new Set(ml.baseAtoms.map((a) => a.symbol))];
    }
    const nameMap: Record<string, string[]> = {
      'hBN': ['B', 'N'], 'Graphene': ['C'], 'MoS2': ['Mo', 'S'],
      'MoSe2': ['Mo', 'Se'], 'WS2': ['W', 'S'], 'WSe2': ['W', 'Se'],
      'Silicene': ['Si'], 'Germanene': ['Ge'], 'Stanene': ['Sn'],
      'Phosphorene': ['P'], 'Borophene': ['B'], 'GaSe': ['Ga', 'Se'],
      'InSe': ['In', 'Se'], 'GeS': ['Ge', 'S'], 'SnS': ['Sn', 'S'],
      'SnSe': ['Sn', 'Se'], 'h-BAs': ['B', 'As'], 'Bi2Se3 (QL)': ['Bi', 'Se'],
    };
    return nameMap[ml.name] ?? [ml.name];
  };

  // === DFT: generate AI recommendations for the optimized heterostructure ===
  const generateDFTAdvice = useCallback(async () => {
    if (!results || !monolayer) return;
    const targetResults = results[activeTab];
    const target = targetResults.target;
    const best = targetResults.results[0];
    if (!best) return;

    const element = activeElement;
    const mlElements = getMonolayerElements(monolayer);
    const allElements = [element, ...mlElements.filter((e) => e !== element)];
    const hkl = `(${millerH}${millerK}${millerL})`;
    const heavyMetals = ['Pt', 'Au', 'W', 'Ir', 'Os', 'Re', 'Hg', 'Tl', 'Pb', 'Bi', 'Ta', 'Hf'];
    const isHeavy = heavyMetals.includes(element);
    const magneticMetals = ['Fe', 'Co', 'Ni', 'Mn', 'Cr'];
    const isMagnetic = magneticMetals.includes(element);

    const prompt = `DFT setup for ${monolayer.name} on ${element}${hkl} surface using Quantum ESPRESSO (${dftCalcType}).

System: ${monolayer.name} monolayer on ${element}${hkl}. Elements: ${allElements.join(', ')}. Surface cell: a=${target.a.toFixed(3)}A b=${target.b.toFixed(3)}A gamma=${target.gamma.toFixed(1)}. Monolayer supercell matrix [[${best.matrix[0]},${best.matrix[1]}],[${best.matrix[2]},${best.matrix[3]}]], achieved a=${best.achieved_a.toFixed(3)}A, ${best.atom_count} atoms. Mismatch: a=${best.error_a_pct.toFixed(2)}% b=${best.error_b_pct.toFixed(2)}%.${isHeavy ? ' ' + element + ' is a heavy element (SOC may be needed).' : ''}${isMagnetic ? ' ' + element + ' is magnetic.' : ''}

Give specific numerical recommendations for:
1. K-point grid (exact Monkhorst-Pack mesh for this supercell size)
2. ecutwfc and ecutrho for each element (${allElements.join(', ')}) with SSSP pseudopotential names
3. Number of ${element} slab layers, how many to fix, vacuum spacing (A), interlayer distance ${monolayer.name}-${element} from literature
4. vdW correction scheme (D3, rVV10, etc.) with QE input parameters
5. Smearing type and degauss for metallic ${element}
6. conv_thr, mixing_beta${dftCalcType !== 'scf' ? ', forc_conv_thr' : ''}
7. ${monolayer.name}/${element} bonding character (physisorption/chemisorption), dipole correction needed?
8. Step-by-step workflow for this heterostructure calculation

Use specific numbers throughout. Cite relevant papers where possible.`;

    setIsDftLoading(true);
    setDftError('');
    setDftAdvice(null);

    try {
      const resp = await fetch(
        'https://b0q9fbz7nl.execute-api.us-east-1.amazonaws.com/prod/dft-advice',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, provider: dftProvider }),
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = resp.status === 503
          ? `Request timed out. ${dftProvider === 'deepseek' ? 'Try Perplexity AI instead.' : 'The AI provider is slow — please try again.'}`
          : (data as { error?: string }).error || `API error ${resp.status}`;
        throw new Error(msg);
      }
      setDftAdvice((data as { content?: string }).content || '');
    } catch (err) {
      setDftError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsDftLoading(false);
    }
  }, [results, monolayer, activeTab, dftProvider, dftCalcType, activeElement, millerH, millerK, millerL, bulkInfo]);

  // === DFT: download AI advice as markdown ===
  const downloadDFTAdvice = useCallback(() => {
    if (!dftAdvice || !monolayer) return;
    const filename = `DFT_${monolayer.name}_${activeElement}_${millerH}${millerK}${millerL}.md`;
    const blob = new Blob([dftAdvice], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [dftAdvice, monolayer, activeElement, millerH, millerK, millerL]);

  // === Download CIF for a surface target (from ASE Lambda data) ===
  const downloadTargetCIF = (target: SurfaceCellParams) => {
    if (!target.cif) return;
    const blob = new Blob([target.cif], { type: 'chemical/x-cif' });
    const url = URL.createObjectURL(blob);
    blobUrlsRef.current.push(url);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeElement}_${millerH}${millerK}${millerL}_${target.label.replace(/[^a-zA-Z0-9]/g, '_')}.cif`;
    a.click();
    URL.revokeObjectURL(url);
    blobUrlsRef.current = blobUrlsRef.current.filter(u => u !== url);
  };

  // === Generate and download CIF for best-fit monolayer supercell ===
  const downloadMonolayerCIF = (result: MatrixResult, targetLabel: string) => {
    if (!monolayer) return;
    const [n, m, k, l] = result.matrix;
    const det = n * l - m * k;
    const absDet = Math.abs(det);

    // Generate supercell atoms from base atoms using transformation matrix
    // M = [n, m; k, l] transforms old lattice to new: a' = n*a + m*b, b' = k*a + l*b
    // For fractional coords: (M^T) * [fx'; fy'] = [fx; fy], so [fx'; fy'] = (M^T)^(-1) * [fx; fy]
    // (M^T)^(-1) = (1/det) * [l, -k; -m, n]
    const supercellAtoms: { symbol: string; x: number; y: number; z: number }[] = [];
    const atomKeys = new Set<string>();

    // Get base atoms (or use defaults if not defined)
    const baseAtoms = monolayer.baseAtoms || [
      { symbol: 'X', x: 0, y: 0, z: 0.5 },
      { symbol: 'X', x: 1/3, y: 2/3, z: 0.5 },
    ];

    // Search range for tiling - need to cover all integer offsets that map into [0,1) in supercell
    const searchRange = Math.max(
      Math.abs(n) + Math.abs(m),
      Math.abs(k) + Math.abs(l)
    ) + 2;

    for (let i = -searchRange; i <= searchRange; i++) {
      for (let j = -searchRange; j <= searchRange; j++) {
        for (const atom of baseAtoms) {
          // Original fractional coords with offset
          const ox = atom.x + i;
          const oy = atom.y + j;

          // Transform to supercell fractional coordinates using (M^T)^(-1)
          const fx = (l * ox - k * oy) / det;
          const fy = (-m * ox + n * oy) / det;

          // Wrap to [0, 1) with tolerance
          const eps = 1e-6;
          let wrappedX = fx - Math.floor(fx + eps);
          let wrappedY = fy - Math.floor(fy + eps);
          if (wrappedX < 0) wrappedX += 1;
          if (wrappedY < 0) wrappedY += 1;
          if (wrappedX >= 1 - eps) wrappedX = 0;
          if (wrappedY >= 1 - eps) wrappedY = 0;

          // Check if this atom is inside the supercell [0, 1)
          if (wrappedX >= -eps && wrappedX < 1 - eps && wrappedY >= -eps && wrappedY < 1 - eps) {
            const key = `${atom.symbol}:${Math.round(wrappedX * 1e6)}:${Math.round(wrappedY * 1e6)}:${Math.round(atom.z * 1e6)}`;
            if (!atomKeys.has(key)) {
              atomKeys.add(key);
              supercellAtoms.push({ symbol: atom.symbol, x: wrappedX, y: wrappedY, z: atom.z });
            }
          }
        }
      }
    }

    // Build atom lines for CIF
    const atomLines: string[] = [];
    const atomCounts: Record<string, number> = {};
    for (const atom of supercellAtoms) {
      atomCounts[atom.symbol] = (atomCounts[atom.symbol] || 0) + 1;
      const label = `${atom.symbol}${atomCounts[atom.symbol]}`;
      atomLines.push(`  ${label.padEnd(6)} ${atom.symbol.padEnd(4)} 1.0  ${atom.x.toFixed(5)}  ${atom.y.toFixed(5)}  ${atom.z.toFixed(5)}  1.0000`);
    }

    // Build formula
    const formula = Object.entries(atomCounts).map(([sym, cnt]) => `${sym}${cnt}`).join('');

    const cif = [
      `data_${monolayer.name}_supercell`,
      `_chemical_formula_structural       ${formula}`,
      `_chemical_formula_sum              "${Object.entries(atomCounts).map(([s, c]) => `${s}${c}`).join(' ')}"`,
      `_cell_length_a       ${result.achieved_a.toFixed(6)}`,
      `_cell_length_b       ${result.achieved_b.toFixed(6)}`,
      `_cell_length_c       20.000000`,
      `_cell_angle_alpha    90.0000`,
      `_cell_angle_beta     90.0000`,
      `_cell_angle_gamma    ${result.achieved_gamma.toFixed(4)}`,
      ``,
      `_space_group_name_H-M_alt    "P 1"`,
      `_space_group_IT_number       1`,
      ``,
      `# Supercell transformation matrix: [${n},${m}|${k},${l}]`,
      `# Determinant: ${absDet}`,
      `# Monolayer: ${monolayer.name} (a=${monolayer.a}, b=${monolayer.b}, gamma=${monolayer.gamma})`,
      `# Target surface: ${activeElement}(${millerH}${millerK}${millerL}) ${targetLabel}`,
      `# Error: a=${result.error_a_pct.toFixed(2)}%, b=${result.error_b_pct.toFixed(2)}%, gamma=${result.error_gamma_pct.toFixed(2)}%`,
      ``,
      `loop_`,
      `  _space_group_symop_operation_xyz`,
      `  'x, y, z'`,
      ``,
      `loop_`,
      `  _atom_site_label`,
      `  _atom_site_type_symbol`,
      `  _atom_site_symmetry_multiplicity`,
      `  _atom_site_fract_x`,
      `  _atom_site_fract_y`,
      `  _atom_site_fract_z`,
      `  _atom_site_occupancy`,
      ...atomLines,
    ].join('\n');

    const blob = new Blob([cif], { type: 'chemical/x-cif' });
    const url = URL.createObjectURL(blob);
    blobUrlsRef.current.push(url);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${monolayer.name}_on_${activeElement}${millerH}${millerK}${millerL}_${targetLabel.replace(/[^a-zA-Z0-9]/g, '_')}_matrix_${n}${m}${k}${l}.cif`;
    a.click();
    URL.revokeObjectURL(url);
    blobUrlsRef.current = blobUrlsRef.current.filter(u => u !== url);
  };

  // === Step indicator ===
  const currentStepIdx = STEP_ORDER.indexOf(step);

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

        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
            {/* Title */}
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-academic-100 rounded-lg">
                <Calculator className="w-8 h-8 text-academic-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Universal Supercell Matrix Optimizer</h3>
                <p className="text-slate-600">Find optimal supercell matrices for 2D materials on metal surfaces</p>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">How it works:</p>
                <p>
                  1) Select a metal surface and Miller index to auto-compute target lattice parameters.
                  2) Choose a 2D monolayer material.
                  3) Run an intelligent multi-phase optimization that searches millions of supercell matrices
                  to find the best lattice match.
                </p>
              </div>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-1 mb-8 overflow-x-auto">
              {STEPS.map((s, i) => (
                <React.Fragment key={s.id}>
                  {i > 0 && <div className={`flex-shrink-0 w-8 h-0.5 ${i <= currentStepIdx ? 'bg-academic-500' : 'bg-slate-200'}`} />}
                  <button
                    onClick={() => {
                      if (i < currentStepIdx && !isOptimizing) setStep(s.id);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0
                      ${step === s.id ? 'bg-academic-100 text-academic-700' : ''}
                      ${i < currentStepIdx ? 'text-academic-600 cursor-pointer hover:bg-academic-50' : ''}
                      ${i > currentStepIdx ? 'text-slate-400 cursor-default' : ''}`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2
                      ${step === s.id ? 'bg-academic-600 text-white border-academic-600' : ''}
                      ${i < currentStepIdx ? 'bg-academic-100 text-academic-700 border-academic-300' : ''}
                      ${i > currentStepIdx ? 'bg-slate-100 text-slate-400 border-slate-200' : ''}`}
                    >
                      {i < currentStepIdx ? <CheckCircle className="w-4 h-4" /> : i + 1}
                    </div>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* ======== STEP 1: Surface Target ======== */}
            {step === 'surface' && (
              <div className="space-y-6">
                <h4 className="text-lg font-bold text-slate-900">Define Surface Target</h4>

                {/* Element Selection Mode */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Element</label>
                  <div className="flex gap-2 mb-3">
                    {([['preset', 'Common Metals'], ['custom', 'Any Element (ASE)']] as const).map(([mode, label]) => (
                      <button
                        key={mode}
                        onClick={() => { setElementMode(mode); setSurfaceTargets(null); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          elementMode === mode
                            ? 'bg-academic-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {elementMode === 'preset' ? (
                    <select
                      id="metal-select"
                      aria-label="Metal element"
                      value={selectedMetal}
                      onChange={(e) => { setSelectedMetal(e.target.value); setSurfaceTargets(null); }}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-academic-500 focus:border-academic-500 bg-white"
                    >
                      <optgroup label="FCC Metals">
                        {METALS.filter(m => m.structure === 'FCC').map(m => (
                          <option key={m.symbol} value={m.symbol}>{m.symbol} - {m.name} (a0={m.a0} A)</option>
                        ))}
                      </optgroup>
                      <optgroup label="BCC Metals">
                        {METALS.filter(m => m.structure === 'BCC').map(m => (
                          <option key={m.symbol} value={m.symbol}>{m.symbol} - {m.name} (a0={m.a0} A)</option>
                        ))}
                      </optgroup>
                      <optgroup label="HCP Metals">
                        {METALS.filter(m => m.structure === 'HCP').map(m => (
                          <option key={m.symbol} value={m.symbol}>{m.symbol} - {m.name} (a0={m.a0} A)</option>
                        ))}
                      </optgroup>
                    </select>
                  ) : (
                    <div>
                      <input
                        id="custom-element"
                        type="text"
                        value={customElement}
                        onChange={(e) => { setCustomElement(e.target.value); setSurfaceTargets(null); }}
                        placeholder="e.g. Pt, Cu, Au, Si, Ge..."
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-academic-500 focus:border-academic-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        ASE supports all elements. Lattice parameters are fetched automatically.
                      </p>
                    </div>
                  )}
                </div>

                {/* Backend Selector */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Supercell Backend</label>
                  <div className="flex gap-2">
                    {([['ase', 'ASE', 'Atomic Simulation Environment'], ['pymatgen', 'Pymatgen', 'Python Materials Genomics']] as const).map(([id, label, desc]) => (
                      <button
                        key={id}
                        onClick={() => { setSupercellBackend(id); setSurfaceTargets(null); }}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors border-2 ${
                          supercellBackend === id
                            ? 'border-academic-500 bg-academic-50 text-academic-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span className="font-semibold">{label}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Miller Indices */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Miller Indices (hkl)
                  </label>
                  <div className="flex gap-3">
                    {[
                      { label: 'h', value: millerH, set: setMillerH },
                      { label: 'k', value: millerK, set: setMillerK },
                      { label: 'l', value: millerL, set: setMillerL },
                    ].map(({ label, value, set }) => (
                      <div key={label} className="flex-1">
                        <div className="text-center text-xs text-slate-500 mb-1">{label}</div>
                        <input
                          type="number"
                          id={`miller-${label}`}
                          aria-label={`Miller index ${label}`}
                          value={value}
                          onChange={(e) => { set(parseInt(e.target.value) || 0); setSurfaceTargets(null); }}
                          className="w-full px-3 py-3 border border-slate-300 rounded-lg text-center focus:ring-2 focus:ring-academic-500 focus:border-academic-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Compute Button */}
                <button
                  onClick={computeTargets}
                  disabled={isComputingTargets}
                  className="w-full bg-academic-600 text-white py-3 rounded-lg font-semibold hover:bg-academic-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-academic-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isComputingTargets ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Computing via {supercellBackend === 'pymatgen' ? 'Pymatgen' : 'ASE'}...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-5 h-5" />
                      Compute Surface Cell Parameters
                    </>
                  )}
                </button>

                {/* Error */}
                {surfaceError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-800">{surfaceError}</p>
                  </div>
                )}
                {surfaceBackendNote && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                    <Info className="w-5 h-5 text-amber-700 flex-shrink-0" />
                    <p className="text-sm text-amber-900">{surfaceBackendNote}</p>
                  </div>
                )}

                {/* Targets Table */}
                {surfaceTargets && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h5 className="text-sm font-semibold text-slate-700">
                        {elementMode === 'custom' ? customElement : selectedMetal}({millerH}{millerK}{millerL}) Surface Cell Targets:
                      </h5>
                      {targetMethod && (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                          targetMethod === 'ase'
                            ? 'bg-green-100 text-green-800 border-green-300'
                            : targetMethod === 'pymatgen'
                            ? 'bg-purple-100 text-purple-800 border-purple-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}>
                          {targetMethod === 'ase' ? 'ASE (Python)' : targetMethod === 'pymatgen' ? 'Pymatgen (Python)' : 'Analytical (JS fallback)'}
                        </span>
                      )}
                    </div>
                    {bulkInfo && (
                      <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
                        Bulk: a={String(bulkInfo.lattice_a)} A, b={String(bulkInfo.lattice_b)} A, c={String(bulkInfo.lattice_c)} A
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="px-4 py-2 text-left font-semibold text-slate-700">Supercell</th>
                            <th className="px-4 py-2 text-right font-semibold text-slate-700">a (A)</th>
                            <th className="px-4 py-2 text-right font-semibold text-slate-700">b (A)</th>
                            <th className="px-4 py-2 text-right font-semibold text-slate-700">gamma (deg)</th>
                            <th className="px-4 py-2 text-right font-semibold text-slate-700">Area (A2)</th>
                            <th className="px-4 py-2 text-center font-semibold text-slate-700">CIF</th>
                          </tr>
                        </thead>
                        <tbody>
                          {surfaceTargets.map((t) => (
                            <tr key={t.label} className="border-t border-slate-100">
                              <td className="px-4 py-2 font-medium text-slate-900">{t.label}</td>
                              <td className="px-4 py-2 text-right font-mono">{t.a.toFixed(4)}</td>
                              <td className="px-4 py-2 text-right font-mono">{t.b.toFixed(4)}</td>
                              <td className="px-4 py-2 text-right font-mono">{t.gamma.toFixed(2)}</td>
                              <td className="px-4 py-2 text-right font-mono">{t.area.toFixed(2)}</td>
                              <td className="px-4 py-2 text-center">
                                {t.cif ? (
                                  <button
                                    type="button"
                                    onClick={() => downloadTargetCIF(t)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-academic-700 bg-academic-50 hover:bg-academic-100 rounded border border-academic-200 transition-colors"
                                    title={`Download ${activeElement}(${millerH}${millerK}${millerL}) ${t.label} slab as CIF`}
                                  >
                                    <Download className="w-3 h-3" />
                                    .cif
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400">--</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      onClick={() => setStep('monolayer')}
                      className="w-full bg-academic-600 text-white py-3 rounded-lg font-semibold hover:bg-academic-700 transition-colors flex items-center justify-center gap-2"
                    >
                      Next: Select Monolayer
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ======== STEP 2: Monolayer Selection ======== */}
            {step === 'monolayer' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={() => setStep('surface')} className="text-academic-600 hover:text-academic-700" aria-label="Go back to surface step">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h4 className="text-lg font-bold text-slate-900">Select Monolayer Material</h4>
                </div>

                {/* Mode selector */}
                <div className="flex gap-2">
                  {([['preset', 'Preset Materials'], ['custom', 'Custom Input'], ['cif', 'CIF Upload']] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setMonolayerMode(mode)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        monolayerMode === mode
                          ? 'bg-academic-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Preset grid */}
                {monolayerMode === 'preset' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {MONOLAYER_PRESETS.map((mat) => (
                      <button
                        key={mat.name}
                        onClick={() => setSelectedPreset(mat.name)}
                        className={`p-3 rounded-lg border-2 text-left transition-colors ${
                          selectedPreset === mat.name
                            ? 'border-academic-500 bg-academic-50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Atom className="w-4 h-4 text-academic-600" />
                          <span className="font-semibold text-sm text-slate-900">{mat.name}</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          a={mat.a}, b={mat.b}
                        </div>
                        <div className="text-xs text-slate-400">
                          {mat.crystal_system}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Custom input */}
                {monolayerMode === 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="custom-a">a (A)</label>
                      <input id="custom-a" type="number" step="0.001" value={customA} onChange={e => setCustomA(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-academic-500" placeholder="e.g. 2.504" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="custom-b">b (A)</label>
                      <input id="custom-b" type="number" step="0.001" value={customB} onChange={e => setCustomB(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-academic-500" placeholder="e.g. 2.504" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="custom-gamma">gamma (deg)</label>
                      <input id="custom-gamma" type="number" step="0.1" value={customGamma} onChange={e => setCustomGamma(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-academic-500" placeholder="e.g. 120" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="custom-atoms">Atoms/cell</label>
                      <input id="custom-atoms" type="number" step="1" value={customAtomsPerCell} onChange={e => setCustomAtomsPerCell(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-academic-500" placeholder="e.g. 2" />
                    </div>
                  </div>
                )}

                {/* CIF Upload */}
                {monolayerMode === 'cif' && (
                  <div className="space-y-4">
                    <label className="block border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-academic-400 hover:bg-academic-50/30 transition-colors">
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">Click to upload a CIF file</p>
                      <p className="text-xs text-slate-400 mt-1">Only a, b, gamma will be extracted</p>
                      <input type="file" accept=".cif" className="hidden" onChange={handleCifUpload} />
                    </label>
                    {cifError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{cifError}</div>
                    )}
                    {cifParsed && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                        Parsed: a={cifParsed.a.toFixed(3)} A, b={cifParsed.b.toFixed(3)} A, gamma={cifParsed.gamma.toFixed(1)} deg, atoms={cifParsed.atoms.length}
                      </div>
                    )}
                    {cifParsed && cifParsed.atoms.length === 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                        No atom sites found in CIF. CIF export will use a generic 2-atom cell.
                      </div>
                    )}
                  </div>
                )}

                {/* Duration selector */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="duration-select">
                    Optimization Duration
                  </label>
                  <select
                    id="duration-select"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-academic-500 bg-white"
                  >
                    <option value={60}>1 minute</option>
                    <option value={180}>3 minutes (recommended)</option>
                    <option value={300}>5 minutes</option>
                    <option value={600}>10 minutes (deep search)</option>
                  </select>
                </div>

                {/* Start Button */}
                <button
                  onClick={confirmAndStart}
                  disabled={
                    (monolayerMode === 'custom' && (!customA || !customB)) ||
                    (monolayerMode === 'cif' && !cifParsed)
                  }
                  className="w-full bg-academic-600 text-white py-3 rounded-lg font-semibold hover:bg-academic-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-academic-600/30"
                >
                  <Play className="w-5 h-5" />
                  Start Optimization
                </button>
              </div>
            )}

            {/* ======== STEP 3: Optimization Progress ======== */}
            {step === 'optimize' && (
              <div className="space-y-6">
                <h4 className="text-lg font-bold text-slate-900">Optimization in Progress</h4>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">{progress?.phase || 'Starting...'}</span>
                    <span className="font-mono text-academic-600">{(progress?.progress_pct ?? 0).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-academic-500 to-academic-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${progress?.progress_pct ?? 0}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-slate-900 font-mono">
                      {(progress?.matrices_tested ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Matrices Tested</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-slate-900 font-mono">
                      {((progress?.elapsed_ms ?? 0) / 1000).toFixed(0)}s
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Elapsed</p>
                  </div>
                </div>

                {/* Live preview */}
                {progress?.best_results_so_far && progress.best_results_so_far.some(tr => tr.results.length > 0) && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-700">Best matches so far:</p>
                    {progress.best_results_so_far.map((tr) => (
                      <div key={tr.target.label} className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-slate-600 mb-1">{tr.target.label} target:</p>
                        {tr.results.length > 0 ? (
                          <p className="text-sm font-mono text-slate-900">
                            Best: a-err={tr.results[0].error_a_pct.toFixed(1)}%, b-err={tr.results[0].error_b_pct.toFixed(1)}%, gamma-err={tr.results[0].error_gamma_pct.toFixed(1)}%
                            <span className={`ml-2 px-2 py-0.5 rounded text-xs border ${TIER_STYLES[tr.results[0].tier]}`}>
                              {tr.results[0].tier}
                            </span>
                          </p>
                        ) : (
                          <p className="text-sm text-slate-400">Searching...</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Stop button */}
                <button
                  onClick={stopOptimization}
                  className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Square className="w-5 h-5" />
                  Stop Early & View Results
                </button>
              </div>
            )}

            {/* ======== STEP 4: Results ======== */}
            {step === 'results' && results && (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-lg font-bold text-slate-900">Optimization Results</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={downloadResults}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    <button
                      onClick={() => { setResults(null); setProgress(null); setStep('surface'); }}
                      className="flex items-center gap-2 px-4 py-2 bg-academic-100 hover:bg-academic-200 text-academic-700 rounded-lg transition-colors text-sm"
                    >
                      <RotateCcw className="w-4 h-4" />
                      New Search
                    </button>
                  </div>
                </div>

                {/* Summary */}
                {progress && (
                  <div className="bg-academic-50 border border-academic-200 rounded-lg p-3 text-sm text-academic-800">
                    Tested <strong>{progress.matrices_tested.toLocaleString()}</strong> matrices in{' '}
                    <strong>{(progress.elapsed_ms / 1000).toFixed(1)}s</strong> | Monolayer: <strong>{monolayer?.name}</strong> | Surface: <strong>{activeElement}({millerH}{millerK}{millerL})</strong>
                  </div>
                )}

                {/* Target tabs */}
                <div className="flex gap-1 border-b border-slate-200">
                  {results.map((tr, i) => (
                    <button
                      key={tr.target.label}
                      onClick={() => setActiveTab(i)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === i
                          ? 'border-academic-600 text-academic-700'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {tr.target.label}
                      <span className="ml-1 text-xs text-slate-400">({tr.results.length})</span>
                    </button>
                  ))}
                </div>

                {/* Results table */}
                {results[activeTab] && (
                  <div className="overflow-x-auto">
                    {results[activeTab].results.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                        <p>No suitable matrices found for this target within 10% error.</p>
                        <p className="text-sm mt-1">Try increasing the optimization duration or adjusting the target.</p>
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-left">
                            <th className="px-3 py-2 font-semibold text-slate-700">#</th>
                            <th className="px-3 py-2 font-semibold text-slate-700">Matrix</th>
                            <th className="px-3 py-2 font-semibold text-slate-700 text-right">a (A)</th>
                            <th className="px-3 py-2 font-semibold text-slate-700 text-right">b (A)</th>
                            <th className="px-3 py-2 font-semibold text-slate-700 text-right">gamma</th>
                            <th className="px-3 py-2 font-semibold text-slate-700 text-right">Err a%</th>
                            <th className="px-3 py-2 font-semibold text-slate-700 text-right">Err b%</th>
                            <th className="px-3 py-2 font-semibold text-slate-700 text-right">Err g%</th>
                            <th className="px-3 py-2 font-semibold text-slate-700 text-right">Atoms</th>
                            <th className="px-3 py-2 font-semibold text-slate-700">Tier</th>
                            <th className="px-3 py-2 font-semibold text-slate-700 text-center">CIF</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results[activeTab].results.map((r, i) => (
                            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                              <td className="px-3 py-2 font-bold text-academic-600">{i + 1}</td>
                              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                                [{r.matrix[0]},{r.matrix[1]}|{r.matrix[2]},{r.matrix[3]}]
                              </td>
                              <td className="px-3 py-2 text-right font-mono">{r.achieved_a.toFixed(3)}</td>
                              <td className="px-3 py-2 text-right font-mono">{r.achieved_b.toFixed(3)}</td>
                              <td className="px-3 py-2 text-right font-mono">{r.achieved_gamma.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-mono">{r.error_a_pct.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-mono">{r.error_b_pct.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-mono">{r.error_gamma_pct.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right">{r.atom_count}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${TIER_STYLES[r.tier]}`}>
                                  {TIER_LABELS[r.tier]}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => downloadMonolayerCIF(r, results[activeTab].target.label)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors"
                                  title="Download monolayer supercell CIF"
                                >
                                  <Download className="w-3 h-3" />
                                  .cif
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Target info */}
                {results[activeTab] && (
                  <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
                    Target: a={results[activeTab].target.a.toFixed(4)} A, b={results[activeTab].target.b.toFixed(4)} A, gamma={results[activeTab].target.gamma.toFixed(2)} deg, area={results[activeTab].target.area.toFixed(2)} A2
                  </div>
                )}

                {/* ── DFT Setup Assistant ── */}
                {monolayer && results[activeTab] && (
                  <div className="border border-purple-200 rounded-xl overflow-hidden mt-4">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 flex items-center gap-2">
                      <Brain className="w-5 h-5 text-white flex-shrink-0" />
                      <div>
                        <h5 className="text-white font-semibold text-sm">DFT Setup Assistant</h5>
                        <p className="text-purple-200 text-xs">
                          {monolayer.name} / {activeElement}({millerH}{millerK}{millerL}) — AI-powered parameter recommendations
                        </p>
                      </div>
                    </div>

                    <div className="p-4 space-y-4 bg-white">
                      {/* System summary cards */}
                      {(() => {
                        const target = results[activeTab].target;
                        const best = results[activeTab].results[0];
                        return (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                                <p className="font-semibold text-slate-700 mb-1">Substrate</p>
                                <p className="text-slate-600">{activeElement}({millerH}{millerK}{millerL}) · {target.label}</p>
                                <p className="text-slate-500 font-mono mt-0.5">a={target.a.toFixed(3)} Å · γ={target.gamma.toFixed(1)}°</p>
                                <p className="text-slate-500 font-mono">Area={target.area.toFixed(1)} Å²</p>
                              </div>
                              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                                <p className="font-semibold text-slate-700 mb-1">Overlayer</p>
                                <p className="text-slate-600">{monolayer.name} · [{best ? `${best.matrix[0]},${best.matrix[1]}|${best.matrix[2]},${best.matrix[3]}` : '—'}]</p>
                                <p className="text-slate-500 font-mono mt-0.5">{best ? `a=${best.achieved_a.toFixed(3)} Å · Δa=${best.error_a_pct.toFixed(2)}%` : '—'}</p>
                                <p className="text-slate-500 font-mono">{best ? `Atoms: ${best.atom_count} · ${best.tier}` : '—'}</p>
                              </div>
                            </div>

                            {/* Mismatch summary */}
                            {best && (
                              <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-xs text-purple-700 flex flex-wrap gap-4">
                                <span>Δa = {best.error_a_pct.toFixed(2)}%</span>
                                <span>Δb = {best.error_b_pct.toFixed(2)}%</span>
                                <span>Δγ = {best.error_gamma_pct.toFixed(2)}%</span>
                                <span>Match: <strong>{best.tier}</strong></span>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* Settings row */}
                      <div className="flex flex-wrap gap-4 items-end">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Calculation Type</label>
                          <select
                            value={dftCalcType}
                            onChange={(e) => setDftCalcType(e.target.value)}
                            title="Calculation Type"
                            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                          >
                            <option value="relax">Relax (ionic positions)</option>
                            <option value="scf">SCF only</option>
                            <option value="vc-relax">VC-Relax (cell + ions)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-slate-500 mb-1">AI Provider</label>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => setDftProvider('perplexity')}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                                dftProvider === 'perplexity'
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                              }`}
                            >
                              Perplexity AI
                            </button>
                            <button
                              type="button"
                              onClick={() => setDftProvider('deepseek')}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                                dftProvider === 'deepseek'
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                              }`}
                            >
                              DeepSeek
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Generate button */}
                      <button
                        type="button"
                        onClick={generateDFTAdvice}
                        disabled={isDftLoading || results[activeTab].results.length === 0}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all"
                      >
                        {isDftLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Brain className="w-4 h-4" />
                        )}
                        {isDftLoading ? 'Generating recommendations…' : 'Generate DFT Recommendations'}
                      </button>
                      <p className="text-xs text-slate-400 text-center -mt-2">
                        Analysis may take 30–60 seconds for comprehensive results
                      </p>

                      {/* Error */}
                      {dftError && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          {dftError}
                        </div>
                      )}

                      {/* AI Response */}
                      {dftAdvice && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-700">DFT Recommendations</span>
                            <button
                              type="button"
                              onClick={downloadDFTAdvice}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors"
                            >
                              <Download className="w-3 h-3" />
                              Download .md
                            </button>
                          </div>
                          <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 overflow-auto max-h-[700px] whitespace-pre-wrap font-mono leading-relaxed">
                            {dftAdvice}
                          </pre>
                        </div>
                      )}
                    </div>
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

export default MatrixOptimizer;
