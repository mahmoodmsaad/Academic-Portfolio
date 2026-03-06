import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Atom,
  Calculator,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Play,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { MONOLAYER_PRESETS, METALS, getMonolayerByName } from '../utils/monolayerDatabase';
import { parseCIFLatticeParams } from '../utils/matrixMath';
import type { BaseAtom, MonolayerMaterial, WizardStep, ZSLResult } from '../utils/matrixOptimizerTypes';

const DEFAULT_SURFACE_API_URL = 'https://oy34w61rc6.execute-api.us-east-1.amazonaws.com/prod/surface-targets';
const configuredSurfaceApi = import.meta.env.VITE_SURFACE_API;
const SURFACE_API_URL =
  configuredSurfaceApi === undefined ? DEFAULT_SURFACE_API_URL : configuredSurfaceApi.trim();
const SURFACE_API_PYMATGEN_URL = import.meta.env.VITE_SURFACE_API_PYMATGEN?.trim() || '';
const ZSL_API_URL = import.meta.env.VITE_ZSL_API?.trim() || '';
const INTERFACE_MATCH_API_URL = import.meta.env.VITE_INTERFACE_MATCH_API?.trim() || '';

const TIER_STYLES: Record<string, string> = {
  excellent: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  good: 'bg-teal-100 text-teal-800 border-teal-300',
  acceptable: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  marginal: 'bg-orange-100 text-orange-800 border-orange-300',
};

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'surface', label: 'Surface' },
  { id: 'monolayer', label: 'hBN / Film' },
  { id: 'optimize', label: 'Match' },
  { id: 'results', label: 'Results' },
];

const STEP_ORDER: WizardStep[] = ['surface', 'monolayer', 'optimize', 'results'];

type InterfaceMatchResponse = {
  success?: boolean;
  status?: 'ok' | 'no_match_under_threshold';
  summary?: {
    selected_repeat?: number | null;
    num_candidates?: number;
    max_mismatch?: number;
    max_area?: number;
    message?: string;
  };
  matches?: ZSLResult[];
  error?: string;
};

type SurfaceApiResponse = {
  success?: boolean;
  backend?: 'ase' | 'pymatgen';
  targets?: Array<{
    label?: string;
    a: number;
    b: number;
    gamma: number;
  }>;
  bulk_info?: {
    lattice_a?: number;
  };
  error?: string;
};

type ZslApiResponse = {
  success?: boolean;
  matches?: ZSLResult[];
  total_candidates?: number;
  error?: string;
};

const MatrixOptimizer: React.FC = () => {
  const [step, setStep] = useState<WizardStep>('surface');

  const [elementMode, setElementMode] = useState<'preset' | 'custom'>('preset');
  const [selectedMetal, setSelectedMetal] = useState('Pt');
  const [customElement, setCustomElement] = useState('');
  const [supercellBackend, setSupercellBackend] = useState<'ase' | 'pymatgen'>('ase');
  const [millerH, setMillerH] = useState(8);
  const [millerK, setMillerK] = useState(8);
  const [millerL, setMillerL] = useState(1);

  const [substrateLayers, setSubstrateLayers] = useState(16);
  const [substrateVacuum, setSubstrateVacuum] = useState(15);
  const [substrateRepeatMax, setSubstrateRepeatMax] = useState(3);
  const [substrateLatticeA, setSubstrateLatticeA] = useState('');

  const [monolayerMode, setMonolayerMode] = useState<'preset' | 'custom' | 'cif'>('preset');
  const [selectedPreset, setSelectedPreset] = useState('hBN');
  const [customA, setCustomA] = useState('2.50');
  const [customB, setCustomB] = useState('2.50');
  const [customGamma, setCustomGamma] = useState('120');
  const [customAtomsPerCell, setCustomAtomsPerCell] = useState('2');
  const [cifParsed, setCifParsed] = useState<{ a: number; b: number; gamma: number; atoms: BaseAtom[] } | null>(null);
  const [cifError, setCifError] = useState('');

  const [hbnVacuum, setHbnVacuum] = useState(15);
  const [maxMismatchPct, setMaxMismatchPct] = useState(5.0);
  const [maxArea, setMaxArea] = useState(400);
  const [topK, setTopK] = useState(5);
  const [minInplaneAngle, setMinInplaneAngle] = useState(45);
  const [maxAspectRatio, setMaxAspectRatio] = useState(8);
  const [gap, setGap] = useState(3.2);

  const [isMatching, setIsMatching] = useState(false);
  const [surfaceError, setSurfaceError] = useState('');
  const [matchError, setMatchError] = useState('');
  const [summaryMessage, setSummaryMessage] = useState('');
  const [matches, setMatches] = useState<ZSLResult[] | null>(null);
  const [totalCandidates, setTotalCandidates] = useState<number | null>(null);
  const [selectedRepeat, setSelectedRepeat] = useState<number | null>(null);
  const [selectedMonolayer, setSelectedMonolayer] = useState<MonolayerMaterial | null>(null);

  const activeElement = useMemo(
    () => (elementMode === 'custom' ? customElement.trim() : selectedMetal),
    [elementMode, customElement, selectedMetal],
  );
  const selectedMetalEntry = useMemo(
    () => METALS.find((metal) => metal.symbol === selectedMetal) || null,
    [selectedMetal],
  );

  const currentStepIdx = STEP_ORDER.indexOf(step);

  const buildMonolayerFromState = (): MonolayerMaterial | null => {
    if (monolayerMode === 'preset') {
      return getMonolayerByName(selectedPreset) || null;
    }

    if (monolayerMode === 'custom') {
      const a = parseFloat(customA);
      const b = parseFloat(customB);
      const gamma = parseFloat(customGamma);
      const atoms = parseInt(customAtomsPerCell);
      if (isNaN(a) || isNaN(b) || isNaN(gamma) || a <= 0 || b <= 0 || gamma <= 0 || gamma >= 180) {
        return null;
      }
      return {
        name: 'Custom',
        a,
        b,
        gamma,
        atoms_per_cell: isNaN(atoms) ? 2 : atoms,
        crystal_system:
          Math.abs(gamma - 120) < 1 ? 'hexagonal' : Math.abs(gamma - 90) < 1 ? 'rectangular' : 'oblique',
      };
    }

    if (monolayerMode === 'cif' && cifParsed) {
      return {
        name: 'CIF Upload',
        a: cifParsed.a,
        b: cifParsed.b,
        gamma: cifParsed.gamma,
        atoms_per_cell: Math.max(1, cifParsed.atoms.length || 2),
        crystal_system:
          Math.abs(cifParsed.gamma - 120) < 1
            ? 'hexagonal'
            : Math.abs(cifParsed.gamma - 90) < 1
              ? 'rectangular'
              : 'oblique',
        baseAtoms: cifParsed.atoms.length ? cifParsed.atoms : undefined,
      };
    }

    return null;
  };

  const handleCifUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCifError('');
    setCifParsed(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const parsed = parseCIFLatticeParams(content);
        setCifParsed(parsed);
      } catch (err) {
        setCifError(err instanceof Error ? err.message : 'Failed to parse CIF');
      }
    };
    reader.readAsText(file);
  };

  const goToMonolayerStep = () => {
    setSurfaceError('');
    if (!activeElement) {
      setSurfaceError('Please select or enter a substrate element.');
      return;
    }
    if (millerH === 0 && millerK === 0 && millerL === 0) {
      setSurfaceError('Miller indices cannot all be zero.');
      return;
    }
    if (substrateLayers < 1 || substrateVacuum <= 0 || substrateRepeatMax < 1) {
      setSurfaceError('Please enter valid substrate build parameters.');
      return;
    }

    setStep('monolayer');
  };

  const runInterfaceMatch = async () => {
    setMatchError('');
    setSummaryMessage('');
    const monolayer = buildMonolayerFromState();

    if (!monolayer) {
      setMatchError('Please provide valid monolayer inputs before matching.');
      return;
    }

    if (!activeElement) {
      setMatchError('Missing substrate element.');
      return;
    }

    setSelectedMonolayer(monolayer);
    setMatches(null);
    setTotalCandidates(null);
    setSelectedRepeat(null);
    setIsMatching(true);
    setStep('optimize');

    const latticeA = parseFloat(substrateLatticeA);
    const effectiveLatticeA =
      Number.isFinite(latticeA)
        ? latticeA
        : elementMode === 'preset'
          ? selectedMetalEntry?.a0 ?? null
          : null;
    const payload = {
      element: activeElement,
      h: millerH,
      k: millerK,
      l: millerL,
      backend: supercellBackend,
      substrate: {
        layers: substrateLayers,
        vacuum: substrateVacuum,
        repeat_max: substrateRepeatMax,
        lattice_a: effectiveLatticeA,
      },
      film: {
        name: monolayer.name,
        a: monolayer.a,
        b: monolayer.b,
        gamma: monolayer.gamma,
        atoms_per_cell: monolayer.atoms_per_cell,
        base_atoms: monolayer.baseAtoms || [],
        vacuum: hbnVacuum,
      },
      matching: {
        max_mismatch: maxMismatchPct / 100,
        max_area: maxArea,
        top_k: topK,
        min_inplane_angle: minInplaneAngle,
        max_aspect_ratio: maxAspectRatio,
        gap,
      },
    };

    try {
      if (INTERFACE_MATCH_API_URL) {
        const response = await fetch(INTERFACE_MATCH_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = (await response.json().catch(() => ({}))) as InterfaceMatchResponse;
        if (!response.ok || !data.success) {
          throw new Error(data.error || `Interface match API error ${response.status}`);
        }

        setMatches(data.matches || []);
        setTotalCandidates(data.summary?.num_candidates ?? null);
        setSelectedRepeat(data.summary?.selected_repeat ?? null);
        if (data.status === 'no_match_under_threshold') {
          setSummaryMessage('No match was found under your mismatch threshold. Showing best available candidates.');
        } else {
          setSummaryMessage(data.summary?.message || 'Interface matching complete.');
        }
        setStep('results');
      } else {
        const surfaceEndpoint =
          supercellBackend === 'pymatgen' && SURFACE_API_PYMATGEN_URL
            ? SURFACE_API_PYMATGEN_URL
            : SURFACE_API_URL;

        if (!surfaceEndpoint) {
          throw new Error('Surface API endpoint is missing. Set VITE_SURFACE_API (or VITE_SURFACE_API_PYMATGEN).');
        }
        if (!ZSL_API_URL) {
          throw new Error('ZSL API endpoint is missing. Set VITE_ZSL_API or deploy VITE_INTERFACE_MATCH_API.');
        }

        const surfaceResp = await fetch(surfaceEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ element: activeElement, h: millerH, k: millerK, l: millerL, backend: supercellBackend }),
        });
        const surfaceData = (await surfaceResp.json().catch(() => ({}))) as SurfaceApiResponse;
        if (!surfaceResp.ok || !surfaceData.success || !surfaceData.targets?.length) {
          throw new Error(surfaceData.error || `Surface API error ${surfaceResp.status}`);
        }

        const primitive = surfaceData.targets[0];
        let baseA = Number(primitive.a);
        let baseB = Number(primitive.b);
        const baseGamma = Number(primitive.gamma);

        if (!Number.isFinite(baseA) || !Number.isFinite(baseB) || !Number.isFinite(baseGamma)) {
          throw new Error('Surface API returned invalid primitive cell parameters.');
        }

        const bulkLatticeA = Number(surfaceData.bulk_info?.lattice_a);
        if (typeof effectiveLatticeA === 'number' && effectiveLatticeA > 0 && Number.isFinite(bulkLatticeA) && bulkLatticeA > 0) {
          const scale = effectiveLatticeA / bulkLatticeA;
          baseA *= scale;
          baseB *= scale;
        }

        const strictMismatch = maxMismatchPct / 100;
        const relaxedMismatch = Math.max(strictMismatch, Math.min(0.2, strictMismatch * 2));

        const fetchZsl = async (
          repeat: number,
          mismatchFraction: number,
          requestTopK: number,
        ): Promise<{ matches: ZSLResult[]; total: number }> => {
          const zslResp = await fetch(ZSL_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              substrate_a: baseA * repeat,
              substrate_b: baseB * repeat,
              substrate_gamma: baseGamma,
              film_a: monolayer.a,
              film_b: monolayer.b,
              film_gamma: monolayer.gamma,
              max_area: maxArea,
              max_mismatch: mismatchFraction,
              min_inplane_angle: minInplaneAngle,
              max_aspect_ratio: maxAspectRatio,
              top_k: requestTopK,
            }),
          });

          const zslData = (await zslResp.json().catch(() => ({}))) as ZslApiResponse;
          if (!zslResp.ok || !zslData.success) {
            throw new Error(zslData.error || `ZSL API error ${zslResp.status}`);
          }
          return {
            matches: zslData.matches || [],
            total: zslData.total_candidates ?? 0,
          };
        };

        const fallbackCandidates: ZSLResult[] = [];
        let strictTotalCandidates = 0;
        let selectedStrictRepeat: number | null = null;
        let strictMatches: ZSLResult[] | null = null;

        for (let repeat = 1; repeat <= substrateRepeatMax; repeat += 1) {
          const strictResult = await fetchZsl(repeat, strictMismatch, topK);
          strictTotalCandidates += strictResult.total;

          if (strictResult.matches.length > 0) {
            selectedStrictRepeat = repeat;
            strictMatches = strictResult.matches.map((m) => ({ ...m, pt_repeat: repeat }));
            break;
          }

          if (relaxedMismatch > strictMismatch) {
            const relaxedResult = await fetchZsl(repeat, relaxedMismatch, Math.max(topK, 12));
            fallbackCandidates.push(...relaxedResult.matches.map((m) => ({ ...m, pt_repeat: repeat })));
          }
        }

        if (strictMatches && strictMatches.length > 0) {
          setMatches(strictMatches);
          setTotalCandidates(strictTotalCandidates);
          setSelectedRepeat(selectedStrictRepeat);
          setSummaryMessage(`Match found using adaptive repeat ${selectedStrictRepeat}x${selectedStrictRepeat}.`);
        } else if (fallbackCandidates.length > 0) {
          const ranked = [...fallbackCandidates]
            .sort((a, b) => {
              if (a.mismatch_pct !== b.mismatch_pct) return a.mismatch_pct - b.mismatch_pct;
              if (a.von_mises_strain_pct !== b.von_mises_strain_pct) return a.von_mises_strain_pct - b.von_mises_strain_pct;
              return a.interface_area_ang2 - b.interface_area_ang2;
            })
            .slice(0, topK)
            .map((m, index) => ({ ...m, rank: index + 1 }));

          setMatches(ranked);
          setTotalCandidates(strictTotalCandidates || fallbackCandidates.length);
          setSelectedRepeat(null);
          setSummaryMessage(
            `No match under ${maxMismatchPct.toFixed(2)}% mismatch. Showing best relaxed candidates (up to ${(relaxedMismatch * 100).toFixed(2)}%).`,
          );
        } else {
          throw new Error('No interface candidates found under current geometry/area constraints.');
        }

        setStep('results');
      }
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : 'Failed to run interface matching workflow.');
      setStep('monolayer');
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <section id="tools" className="py-20 bg-gradient-to-br from-slate-50 to-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 mb-4">Computational Tools</h2>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            Pt881-style direct interface workflow: build substrate slab, build hBN/film, then find the best lattice fit in one pipeline.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-academic-100 rounded-lg">
                <Calculator className="w-8 h-8 text-academic-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Direct Interface Matcher</h3>
                <p className="text-slate-600">Validated structure-based workflow with adaptive substrate repeat and real slab matching.</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">Workflow:</p>
                <p>Build the real substrate slab, build the film, then run the same structure-based matching flow used in the validated pt881 workspace.</p>
              </div>
            </div>

            <div className="flex items-center gap-1 mb-8 overflow-x-auto">
              {STEPS.map((s, i) => (
                <React.Fragment key={s.id}>
                  {i > 0 && <div className={`flex-shrink-0 w-8 h-0.5 ${i <= currentStepIdx ? 'bg-academic-500' : 'bg-slate-200'}`} />}
                  <button
                    type="button"
                    onClick={() => {
                      if (i < currentStepIdx && !isMatching) setStep(s.id);
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

            {step === 'surface' && (
              <div className="space-y-6">
                <h4 className="text-lg font-bold text-slate-900">Substrate Build Settings</h4>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Element</label>
                  <div className="flex gap-2 mb-3">
                    {([['preset', 'Common Metals'], ['custom', 'Any Element']] as const).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setElementMode(mode)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          elementMode === mode ? 'bg-academic-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {elementMode === 'preset' ? (
                    <select
                      value={selectedMetal}
                      onChange={(e) => setSelectedMetal(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-academic-500 bg-white"
                    >
                      {METALS.map((m) => (
                        <option key={m.symbol} value={m.symbol}>{m.symbol} - {m.name} ({m.structure})</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={customElement}
                      onChange={(e) => setCustomElement(e.target.value)}
                      placeholder="e.g. Pt, Cu, Ni, Ag"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-academic-500"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Builder Backend</label>
                  <div className="flex gap-2">
                    {([['ase', 'ASE'], ['pymatgen', 'Pymatgen']] as const).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSupercellBackend(id)}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium border-2 ${
                          supercellBackend === id
                            ? 'border-academic-500 bg-academic-50 text-academic-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Miller Indices (hkl)</label>
                  <div className="grid grid-cols-3 gap-3">
                    <input type="number" value={millerH} onChange={(e) => setMillerH(parseInt(e.target.value) || 0)} className="px-3 py-3 border border-slate-300 rounded-lg text-center" />
                    <input type="number" value={millerK} onChange={(e) => setMillerK(parseInt(e.target.value) || 0)} className="px-3 py-3 border border-slate-300 rounded-lg text-center" />
                    <input type="number" value={millerL} onChange={(e) => setMillerL(parseInt(e.target.value) || 0)} className="px-3 py-3 border border-slate-300 rounded-lg text-center" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Slab Layers</label>
                    <input type="number" min={1} value={substrateLayers} onChange={(e) => setSubstrateLayers(parseInt(e.target.value) || 1)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Substrate Vacuum (A)</label>
                    <input type="number" step="0.1" min={1} value={substrateVacuum} onChange={(e) => setSubstrateVacuum(parseFloat(e.target.value) || 15)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Adaptive Repeat Max</label>
                    <input type="number" min={1} max={10} value={substrateRepeatMax} onChange={(e) => setSubstrateRepeatMax(parseInt(e.target.value) || 3)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Lattice a (optional)</label>
                    <input type="number" step="0.001" value={substrateLatticeA} onChange={(e) => setSubstrateLatticeA(e.target.value)} placeholder="default from backend" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                    {elementMode === 'preset' && selectedMetalEntry && !substrateLatticeA && (
                      <p className="mt-1 text-xs text-slate-500">
                        Using validated preset default: {selectedMetalEntry.a0.toFixed(4)} A
                      </p>
                    )}
                  </div>
                </div>

                {surfaceError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5" /> {surfaceError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={goToMonolayerStep}
                  className="w-full bg-academic-600 text-white py-3 rounded-lg font-semibold hover:bg-academic-700 transition-colors flex items-center justify-center gap-2"
                >
                  Next: Configure hBN / Film <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {step === 'monolayer' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setStep('surface')} className="text-academic-600 hover:text-academic-700" aria-label="Back to surface">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h4 className="text-lg font-bold text-slate-900">Film + Matching Settings</h4>
                </div>

                <div className="flex gap-2">
                  {([['preset', 'Preset'], ['custom', 'Custom'], ['cif', 'CIF']] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setMonolayerMode(mode)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        monolayerMode === mode ? 'bg-academic-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {monolayerMode === 'preset' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {MONOLAYER_PRESETS.map((mat) => (
                      <button
                        key={mat.name}
                        type="button"
                        onClick={() => setSelectedPreset(mat.name)}
                        className={`p-3 rounded-lg border-2 text-left ${
                          selectedPreset === mat.name ? 'border-academic-500 bg-academic-50' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Atom className="w-4 h-4 text-academic-600" />
                          <span className="font-semibold text-sm text-slate-900">{mat.name}</span>
                        </div>
                        <div className="text-xs text-slate-500">a={mat.a}, b={mat.b}, g={mat.gamma}</div>
                      </button>
                    ))}
                  </div>
                )}

                {monolayerMode === 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-semibold text-slate-700 mb-1">a (A)</label><input type="number" step="0.001" value={customA} onChange={(e) => setCustomA(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></div>
                    <div><label className="block text-sm font-semibold text-slate-700 mb-1">b (A)</label><input type="number" step="0.001" value={customB} onChange={(e) => setCustomB(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></div>
                    <div><label className="block text-sm font-semibold text-slate-700 mb-1">gamma (deg)</label><input type="number" step="0.1" value={customGamma} onChange={(e) => setCustomGamma(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></div>
                    <div><label className="block text-sm font-semibold text-slate-700 mb-1">Atoms/cell</label><input type="number" step="1" value={customAtomsPerCell} onChange={(e) => setCustomAtomsPerCell(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></div>
                  </div>
                )}

                {monolayerMode === 'cif' && (
                  <div className="space-y-3">
                    <label className="block border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-academic-400 hover:bg-academic-50/30 transition-colors">
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">Upload film CIF</p>
                      <input type="file" accept=".cif" className="hidden" onChange={handleCifUpload} />
                    </label>
                    {cifError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{cifError}</div>}
                    {cifParsed && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                        Parsed: a={cifParsed.a.toFixed(3)} A, b={cifParsed.b.toFixed(3)} A, gamma={cifParsed.gamma.toFixed(1)} deg, atoms={cifParsed.atoms.length}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-semibold text-slate-700 mb-1">Film Vacuum (A)</label><input type="number" step="0.1" min={1} value={hbnVacuum} onChange={(e) => setHbnVacuum(parseFloat(e.target.value) || 15)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></div>
                  <div><label className="block text-sm font-semibold text-slate-700 mb-1">Gap (A)</label><input type="number" step="0.1" min={0.5} value={gap} onChange={(e) => setGap(parseFloat(e.target.value) || 3.2)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></div>
                  <div><label className="block text-sm font-semibold text-slate-700 mb-1">Max Mismatch (%)</label><input type="number" step="0.5" min={0.5} max={20} value={maxMismatchPct} onChange={(e) => setMaxMismatchPct(parseFloat(e.target.value) || 5)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></div>
                  <div><label className="block text-sm font-semibold text-slate-700 mb-1">Max Area (A2)</label><input type="number" step="50" min={50} max={5000} value={maxArea} onChange={(e) => setMaxArea(parseFloat(e.target.value) || 400)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></div>
                  <div><label className="block text-sm font-semibold text-slate-700 mb-1">Top K</label><input type="number" step="1" min={1} max={20} value={topK} onChange={(e) => setTopK(parseInt(e.target.value) || 5)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></div>
                  <div><label className="block text-sm font-semibold text-slate-700 mb-1">Min In-plane Angle</label><input type="number" step="1" min={10} max={80} value={minInplaneAngle} onChange={(e) => setMinInplaneAngle(parseFloat(e.target.value) || 45)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></div>
                  <div className="col-span-2"><label className="block text-sm font-semibold text-slate-700 mb-1">Max Aspect Ratio</label><input type="number" step="0.5" min={1.5} max={20} value={maxAspectRatio} onChange={(e) => setMaxAspectRatio(parseFloat(e.target.value) || 8)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></div>
                </div>

                {matchError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5" /> {matchError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={runInterfaceMatch}
                  disabled={isMatching}
                  className="w-full bg-academic-600 text-white py-3 rounded-lg font-semibold hover:bg-academic-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Play className="w-5 h-5" /> Build Surface + Build Film + Find Best Fit
                </button>
              </div>
            )}

            {step === 'optimize' && (
              <div className="py-16 text-center space-y-4">
                <Loader2 className="w-12 h-12 text-academic-600 animate-spin mx-auto" />
                <h4 className="text-lg font-bold text-slate-900">Running Interface Workflow</h4>
                <p className="text-slate-600 text-sm">Building substrate, building hBN/film, then matching best interface candidates...</p>
              </div>
            )}

            {step === 'results' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-lg font-bold text-slate-900">Best Fit Results</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setMatches(null);
                      setTotalCandidates(null);
                      setSelectedRepeat(null);
                      setSummaryMessage('');
                      setMatchError('');
                      setStep('surface');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-academic-100 hover:bg-academic-200 text-academic-700 rounded-lg transition-colors text-sm"
                  >
                    <RotateCcw className="w-4 h-4" /> New Search
                  </button>
                </div>

                <div className="bg-academic-50 border border-academic-200 rounded-lg p-3 text-sm text-academic-800">
                  Surface: <strong>{activeElement}({millerH}{millerK}{millerL})</strong> | Film: <strong>{selectedMonolayer?.name || '-'}</strong>
                  {' '}| Candidates: <strong>{totalCandidates ?? 0}</strong>
                  {' '}| Selected repeat: <strong>{selectedRepeat ?? '-'}</strong>
                </div>

                {summaryMessage && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">{summaryMessage}</div>
                )}

                {!matches || matches.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <p>No matches returned for current constraints.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left">
                          <th className="px-3 py-2 font-semibold text-slate-700">#</th>
                          <th className="px-3 py-2 font-semibold text-slate-700">Film Matrix</th>
                          <th className="px-3 py-2 font-semibold text-slate-700 text-right">Mismatch%</th>
                          <th className="px-3 py-2 font-semibold text-slate-700 text-right">Von Mises%</th>
                          <th className="px-3 py-2 font-semibold text-slate-700 text-right">Rotation</th>
                          <th className="px-3 py-2 font-semibold text-slate-700 text-right">Area (A2)</th>
                          <th className="px-3 py-2 font-semibold text-slate-700 text-right">gamma</th>
                          <th className="px-3 py-2 font-semibold text-slate-700 text-right">Film Atoms</th>
                          <th className="px-3 py-2 font-semibold text-slate-700 text-right">Repeat</th>
                          <th className="px-3 py-2 font-semibold text-slate-700">Tier</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matches.map((m) => (
                          <tr key={`${m.rank}-${m.film_matrix[0][0]}-${m.film_matrix[1][1]}-${m.mismatch_pct}`} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-2 font-bold text-academic-600">{m.rank}</td>
                            <td className="px-3 py-2 font-mono text-xs">[{m.film_matrix[0][0]},{m.film_matrix[0][1]}|{m.film_matrix[1][0]},{m.film_matrix[1][1]}]</td>
                            <td className="px-3 py-2 text-right font-mono">{m.mismatch_pct.toFixed(3)}</td>
                            <td className="px-3 py-2 text-right font-mono">{m.von_mises_strain_pct.toFixed(3)}</td>
                            <td className="px-3 py-2 text-right font-mono">{m.rotation_deg.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-mono">{m.interface_area_ang2.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-mono">{m.gamma_deg.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-mono">{m.film_supercell_atoms}</td>
                            <td className="px-3 py-2 text-right font-mono">{typeof m.pt_repeat === 'number' ? m.pt_repeat : '-'}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${TIER_STYLES[m.tier] || TIER_STYLES.acceptable}`}>
                                {m.tier}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
