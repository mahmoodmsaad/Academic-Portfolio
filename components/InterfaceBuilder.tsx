import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { METALS, MONOLAYER_PRESETS } from '../utils/monolayerDatabase';
import type { ZSLResult } from '../utils/matrixOptimizerTypes';

// ── API endpoints ─────────────────────────────────────────────────────────────
// interface-match is only used when explicitly configured (it times out at 29s).
// Default path: surface-targets → zsl-match (two fast calls, same as MatrixOptimizer).
const INTERFACE_MATCH_API_URL = import.meta.env.VITE_INTERFACE_MATCH_API?.trim() || '';
const SURFACE_API_URL = import.meta.env.VITE_SURFACE_API?.trim()
  || 'https://oy34w61rc6.execute-api.us-east-1.amazonaws.com/prod/surface-targets';
const ZSL_API_URL = import.meta.env.VITE_ZSL_API?.trim()
  || 'https://oy34w61rc6.execute-api.us-east-1.amazonaws.com/prod/zsl-match';

interface SurfaceApiResponse {
  success: boolean;
  error?: string;
  targets?: Array<{ a: number; b: number; gamma: number; cif?: string }>;
  bulk_info?: { lattice_a: number };
}

// ── CIF generators ────────────────────────────────────────────────────────────
interface BaseAtom { symbol: string; x: number; y: number; z: number }

/** Generate a CIF for the film supercell from ZSL film_matrix + monolayer params */
function generateFilmCIF(
  filmMatrix: [[number, number], [number, number]],
  a: number, b: number, gammaMonolayer: number,
  basis: BaseAtom[],
  monolayerName: string,
): string {
  const [m00, m01] = filmMatrix[0];
  const [m10, m11] = filmMatrix[1];
  const det = m00 * m11 - m01 * m10;

  const gRad = (gammaMonolayer * Math.PI) / 180;
  // Primitive cell Cartesian vectors
  const a1 = [a, 0];
  const a2 = [b * Math.cos(gRad), b * Math.sin(gRad)];
  // Supercell Cartesian vectors
  const S1 = [m00 * a1[0] + m01 * a2[0], m00 * a1[1] + m01 * a2[1]];
  const S2 = [m10 * a1[0] + m11 * a2[0], m10 * a1[1] + m11 * a2[1]];
  const lenS1 = Math.hypot(S1[0], S1[1]);
  const lenS2 = Math.hypot(S2[0], S2[1]);
  const cosG = (S1[0] * S2[0] + S1[1] * S2[1]) / (lenS1 * lenS2);
  const gammaDeg = (Math.acos(Math.max(-1, Math.min(1, cosG))) * 180) / Math.PI;
  const c = 20.0; // vacuum along z

  // Inverse matrix for fractional coord conversion
  const invDet = 1 / det;
  const inv = [[m11 * invDet, -m01 * invDet], [-m10 * invDet, m00 * invDet]];

  const atoms: (BaseAtom & { label: string })[] = [];
  const range = Math.ceil(Math.abs(m00) + Math.abs(m01) + Math.abs(m10) + Math.abs(m11)) + 1;
  const counts: Record<string, number> = {};

  for (let i = -range; i <= range; i++) {
    for (let j = -range; j <= range; j++) {
      const fi = inv[0][0] * i + inv[0][1] * j;
      const fj = inv[1][0] * i + inv[1][1] * j;
      if (fi >= -1e-8 && fi < 1 - 1e-8 && fj >= -1e-8 && fj < 1 - 1e-8) {
        for (const atom of basis) {
          const sf = inv[0][0] * (atom.x + i) + inv[0][1] * (atom.y + j);
          const sg = inv[1][0] * (atom.x + i) + inv[1][1] * (atom.y + j);
          const sfW = ((sf % 1) + 1) % 1;
          const sgW = ((sg % 1) + 1) % 1;
          counts[atom.symbol] = (counts[atom.symbol] ?? 0) + 1;
          atoms.push({ symbol: atom.symbol, label: `${atom.symbol}${counts[atom.symbol]}`, x: sfW, y: sgW, z: atom.z });
        }
      }
    }
  }

  const formula = Object.entries(counts).map(([s, n]) => `${s}${n}`).join('');
  let cif = `data_${monolayerName}_supercell\n`;
  cif += `_chemical_formula_structural       ${formula}\n`;
  cif += `_chemical_formula_sum              "${formula}"\n`;
  cif += `_cell_length_a       ${lenS1.toFixed(6)}\n`;
  cif += `_cell_length_b       ${lenS2.toFixed(6)}\n`;
  cif += `_cell_length_c       ${c.toFixed(6)}\n`;
  cif += `_cell_angle_alpha    90.0\n_cell_angle_beta     90.0\n`;
  cif += `_cell_angle_gamma    ${gammaDeg.toFixed(6)}\n\n`;
  cif += `_space_group_name_H-M_alt    "P 1"\n_space_group_IT_number       1\n\n`;
  cif += `loop_\n  _space_group_symop_operation_xyz\n  'x, y, z'\n\n`;
  cif += `loop_\n  _atom_site_type_symbol\n  _atom_site_label\n`;
  cif += `  _atom_site_symmetry_multiplicity\n  _atom_site_fract_x\n`;
  cif += `  _atom_site_fract_y\n  _atom_site_fract_z\n  _atom_site_occupancy\n`;
  atoms.forEach((at) => {
    cif += `  ${at.symbol}  ${at.label.padEnd(8)} 1.0  ${at.x.toFixed(10)}  ${at.y.toFixed(10)}  ${at.z.toFixed(6)}  1.0000\n`;
  });
  return cif;
}

function triggerDownload(content: string, filename: string, mime = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
interface ZslApiResponse {
  success: boolean;
  error?: string;
  matches?: ZSLResult[];
  total_candidates?: number;
}

// ── Tier helpers ──────────────────────────────────────────────────────────────
function mismatchTier(pct: number): { label: string; cls: string } {
  if (pct <= 1) return { label: 'Excellent', cls: 'bg-emerald-100 text-emerald-800 border border-emerald-300' };
  if (pct <= 3) return { label: 'Good', cls: 'bg-teal-100 text-teal-800 border border-teal-300' };
  if (pct <= 5) return { label: 'Acceptable', cls: 'bg-yellow-100 text-yellow-800 border border-yellow-300' };
  return { label: 'Marginal', cls: 'bg-orange-100 text-orange-800 border border-orange-300' };
}

// ── Label helper ──────────────────────────────────────────────────────────────
const Label: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <label className={`block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 ${className}`}>
    {children}
  </label>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800
      focus:outline-none focus:ring-2 focus:ring-academic-400 focus:border-transparent
      placeholder-slate-400 transition ${props.className ?? ''}`}
  />
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ children, ...props }) => (
  <select
    {...props}
    className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800
      focus:outline-none focus:ring-2 focus:ring-academic-400 focus:border-transparent
      transition appearance-none cursor-pointer ${props.className ?? ''}`}
  >
    {children}
  </select>
);

// ── Main Component ────────────────────────────────────────────────────────────
const InterfaceBuilder: React.FC = () => {
  // Substrate state
  const [metal, setMetal] = useState('Pt');
  const [millerH, setMillerH] = useState(1);
  const [millerK, setMillerK] = useState(1);
  const [millerL, setMillerL] = useState(1);
  const [layers, setLayers] = useState(16);
  const [subVacuum, setSubVacuum] = useState(15);

  // Monolayer state
  const [monolayer, setMonolayer] = useState('hBN');
  const [mlVacuum, setMlVacuum] = useState(15);

  // Matching state
  const [maxMismatch, setMaxMismatch] = useState(5.0);
  const [repeatMax, setRepeatMax] = useState(3);
  const [topK, setTopK] = useState(3);
  const [gap, setGap] = useState(3.2);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxArea, setMaxArea] = useState(400);
  const [minAngle, setMinAngle] = useState(45);
  const [maxAspect, setMaxAspect] = useState(8.0);

  // Run state
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<ZSLResult[] | null>(null);
  const [totalCandidates, setTotalCandidates] = useState<number | null>(null);
  const [matchStatus, setMatchStatus] = useState<'ok' | 'no_match_under_threshold' | null>(null);
  const [substrateCif, setSubstrateCif] = useState<string | null>(null);

  const selectedMetal = METALS.find((m) => m.symbol === metal);
  const selectedMonolayer = MONOLAYER_PRESETS.find((m) => m.name === monolayer);

  const reset = () => {
    setResults(null);
    setError('');
    setMatchStatus(null);
    setTotalCandidates(null);
    setSubstrateCif(null);
  };

  const run = async () => {
    setError('');
    setResults(null);
    setMatchStatus(null);
    setTotalCandidates(null);

    if (millerH === 0 && millerK === 0 && millerL === 0) {
      setError('Miller indices cannot all be zero.');
      return;
    }
    const ml = MONOLAYER_PRESETS.find((m) => m.name === monolayer);
    if (!ml) { setError('Unknown monolayer selection.'); return; }

    setRunning(true);
    try {
      // ── Path 2: surface-targets → zsl-match (fast two-step) ─────────────
      const runTwoStep = async () => {
        if (!SURFACE_API_URL || !ZSL_API_URL) {
          throw new Error('API endpoint not configured. Set VITE_SURFACE_API + VITE_ZSL_API.');
        }
        const surfaceResp = await fetch(SURFACE_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ element: metal, h: millerH, k: millerK, l: millerL, backend: 'ase' }),
        });
        const surfaceData = (await surfaceResp.json().catch(() => ({}))) as SurfaceApiResponse;
        if (!surfaceResp.ok || !surfaceData.success || !surfaceData.targets?.length) {
          throw new Error(surfaceData.error || `Surface API error ${surfaceResp.status}`);
        }
        // Store substrate CIF (1×1 primitive slab) for per-match download
        if (surfaceData.targets[0]?.cif) setSubstrateCif(surfaceData.targets[0].cif);
        // Use the 2×2 supercell (targets[1]) for ZSL input — its area (~27 Å²) keeps the
        // ZSL search space small (max_area/cell_area ≤ 15) and avoids Lambda 503 timeouts.
        // The 1×1 cell (targets[0], a≈2.77 Å, area≈6.6 Å²) forces ZSL to enumerate
        // up to det=60 matrices, exhausting the 29 s API Gateway limit.
        const zslTarget = surfaceData.targets.length > 1 ? surfaceData.targets[1] : surfaceData.targets[0];
        const baseA = Number(zslTarget.a);
        const baseB = Number(zslTarget.b);
        const baseGamma = Number(zslTarget.gamma);
        const strictMismatch  = maxMismatch / 100;
        const relaxedMismatch = Math.max(strictMismatch, Math.min(0.2, strictMismatch * 2));
        const fetchZsl = async (repeat: number, mismatchFraction: number, requestTopK: number) => {
          const zslResp = await fetch(ZSL_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              substrate_a: baseA * repeat, substrate_b: baseB * repeat, substrate_gamma: baseGamma,
              film_a: ml!.a, film_b: ml!.b, film_gamma: ml!.gamma,
              film_atoms_per_cell: ml!.atoms_per_cell,
              max_area: maxArea, max_mismatch: mismatchFraction,
              min_inplane_angle: minAngle, max_aspect_ratio: maxAspect, top_k: requestTopK,
            }),
          });
          const zslData = (await zslResp.json().catch(() => ({}))) as ZslApiResponse;
          if (!zslResp.ok || !zslData.success) throw new Error(zslData.error || `ZSL API error ${zslResp.status}`);
          return { matches: zslData.matches ?? [], total: zslData.total_candidates ?? 0 };
        };
        const fallbackCandidates: ZSLResult[] = [];
        let totalCandidatesCount = 0;
        let strictMatches: ZSLResult[] | null = null;
        for (let repeat = 1; repeat <= repeatMax; repeat++) {
          const strict = await fetchZsl(repeat, strictMismatch, topK);
          totalCandidatesCount += strict.total;
          if (strict.matches.length > 0) { strictMatches = strict.matches.map((m) => ({ ...m, pt_repeat: repeat })); break; }
          if (relaxedMismatch > strictMismatch) {
            const relaxed = await fetchZsl(repeat, relaxedMismatch, Math.max(topK, 12));
            fallbackCandidates.push(...relaxed.matches.map((m) => ({ ...m, pt_repeat: repeat })));
          }
        }
        if (strictMatches && strictMatches.length > 0) {
          setResults(strictMatches); setTotalCandidates(totalCandidatesCount); setMatchStatus('ok');
        } else if (fallbackCandidates.length > 0) {
          const ranked = [...fallbackCandidates]
            .sort((a, b) => a.mismatch_pct - b.mismatch_pct || a.interface_area_ang2 - b.interface_area_ang2)
            .slice(0, topK).map((m, i) => ({ ...m, rank: i + 1 }));
          setResults(ranked); setTotalCandidates(totalCandidatesCount || fallbackCandidates.length);
          setMatchStatus('no_match_under_threshold');
        } else {
          throw new Error('No interface candidates found under current geometry/area constraints.');
        }
      };

      if (INTERFACE_MATCH_API_URL) {
        // ── Path 1: single-endpoint (fast if available, else falls back) ────
        const res = await fetch(INTERFACE_MATCH_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            element: metal, h: millerH, k: millerK, l: millerL, backend: 'ase',
            substrate: { layers, vacuum: subVacuum, repeat_max: repeatMax, lattice_a: selectedMetal?.a0 ?? null },
            film: { name: ml.name, a: ml.a, b: ml.b, gamma: ml.gamma, atoms_per_cell: ml.atoms_per_cell, base_atoms: ml.baseAtoms || [], vacuum: mlVacuum },
            matching: { max_mismatch: maxMismatch / 100, max_area: maxArea, top_k: topK, min_inplane_angle: minAngle, max_aspect_ratio: maxAspect, gap },
          }),
        });
        // 5xx (e.g. Lambda timeout) → silently fall back to two-step
        if (res.status >= 500 && SURFACE_API_URL && ZSL_API_URL) {
          await runTwoStep();
        } else if (!res.ok) {
          const text = await res.text();
          throw new Error(`Server error ${res.status}: ${text.slice(0, 200)}`);
        } else {
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          setMatchStatus(data.status ?? (data.matches?.length ? 'ok' : 'no_match_under_threshold'));
          setTotalCandidates(data.summary?.num_candidates ?? null);
          setResults(data.matches ?? []);
        }
      } else {
        await runTwoStep();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error occurred.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <section id="interface-builder" className="py-20 bg-gradient-to-br from-slate-50 via-academic-50/30 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Section Header ──────────────────────────────────────── */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-academic-100 text-academic-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <Layers size={15} />
            Computational Tool
          </div>
          <h2 className="text-4xl font-serif font-bold text-slate-900 mb-3">
            Surface / 2D Interface Builder
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-base leading-relaxed">
            Build metallic surface slabs and 2D monolayers, then find low-mismatch epitaxial matches
            using ZSL lattice matching with adaptive substrate repeat and von Mises strain analysis.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {['ASE builders', 'ZSL-pymatgen', 'Adaptive repeat', 'Strain analysis'].map((tag) => (
              <span key={tag} className="bg-white border border-slate-200 text-slate-600 text-xs px-3 py-1 rounded-full font-medium shadow-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* ── Three-panel Input Grid ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          {/* Panel 1 — Substrate */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-lg bg-academic-600 text-white flex items-center justify-center text-xs font-bold">1</div>
              <h3 className="font-semibold text-slate-800 text-base">Substrate</h3>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Metal</Label>
                <Select value={metal} onChange={(e) => setMetal(e.target.value)}>
                  {METALS.filter((m) => ['FCC', 'BCC'].includes(m.structure)).map((m) => (
                    <option key={m.symbol} value={m.symbol}>
                      {m.symbol} — {m.name} ({m.structure}, a₀ = {m.a0.toFixed(4)} Å)
                    </option>
                  ))}
                </Select>
                {selectedMetal && (
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedMetal.structure} lattice · a₀ = {selectedMetal.a0.toFixed(4)} Å
                  </p>
                )}
              </div>

              <div>
                <Label>Surface orientation (h k l)</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([['h', millerH, setMillerH], ['k', millerK, setMillerK], ['l', millerL, setMillerL]] as const).map(
                    ([label, val, setter]) => (
                      <div key={label}>
                        <span className="text-xs text-slate-400 mb-1 block text-center">{label}</span>
                        <Input
                          type="number"
                          value={val}
                          onChange={(e) => setter(parseInt(e.target.value) || 0)}
                          className="text-center"
                        />
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Layers</Label>
                  <Input type="number" min={1} value={layers} onChange={(e) => setLayers(parseInt(e.target.value) || 1)} />
                </div>
                <div>
                  <Label>Vacuum (Å)</Label>
                  <Input type="number" min={0} step={0.5} value={subVacuum} onChange={(e) => setSubVacuum(parseFloat(e.target.value) || 0)} />
                </div>
              </div>
            </div>
          </div>

          {/* Panel 2 — Monolayer */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-lg bg-academic-600 text-white flex items-center justify-center text-xs font-bold">2</div>
              <h3 className="font-semibold text-slate-800 text-base">2D Monolayer</h3>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Material</Label>
                <Select value={monolayer} onChange={(e) => setMonolayer(e.target.value)}>
                  {MONOLAYER_PRESETS.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name} · {m.crystal_system} · a = {m.a.toFixed(3)} Å
                    </option>
                  ))}
                </Select>
              </div>

              {selectedMonolayer && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Crystal system</span>
                    <span className="font-medium capitalize">{selectedMonolayer.crystal_system}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">a</span>
                    <span className="font-medium">{selectedMonolayer.a.toFixed(4)} Å</span>
                  </div>
                  {selectedMonolayer.b !== selectedMonolayer.a && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">b</span>
                      <span className="font-medium">{selectedMonolayer.b.toFixed(4)} Å</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">γ</span>
                    <span className="font-medium">{selectedMonolayer.gamma}°</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Atoms/cell</span>
                    <span className="font-medium">{selectedMonolayer.atoms_per_cell}</span>
                  </div>
                </div>
              )}

              <div>
                <Label>Vacuum (Å)</Label>
                <Input type="number" min={0} step={0.5} value={mlVacuum} onChange={(e) => setMlVacuum(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          {/* Panel 3 — Matching */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-lg bg-academic-600 text-white flex items-center justify-center text-xs font-bold">3</div>
              <h3 className="font-semibold text-slate-800 text-base">Matching</h3>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Max mismatch (%)</Label>
                <Input
                  type="number"
                  min={0.1}
                  max={30}
                  step={0.5}
                  value={maxMismatch}
                  onChange={(e) => setMaxMismatch(parseFloat(e.target.value) || 5)}
                />
                <p className="text-xs text-slate-400 mt-1">e.g. 5 = allow up to 5% in-plane strain</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Top results</Label>
                  <Input type="number" min={1} max={20} value={topK} onChange={(e) => setTopK(parseInt(e.target.value) || 3)} />
                </div>
                <div>
                  <Label>Substrate repeats</Label>
                  <Input type="number" min={1} max={10} value={repeatMax} onChange={(e) => setRepeatMax(parseInt(e.target.value) || 3)} />
                </div>
              </div>

              <div>
                <Label>Interface gap (Å)</Label>
                <Input type="number" min={0.5} step={0.1} value={gap} onChange={(e) => setGap(parseFloat(e.target.value) || 3.2)} />
                <p className="text-xs text-slate-400 mt-1">Initial substrate–monolayer separation</p>
              </div>

              {/* Advanced toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-1 text-xs text-academic-600 font-medium hover:text-academic-800 transition"
              >
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Advanced settings
              </button>

              {showAdvanced && (
                <div className="space-y-3 pt-1">
                  <div>
                    <Label>Max area (Å²)</Label>
                    <Input type="number" min={1} step={10} value={maxArea} onChange={(e) => setMaxArea(parseFloat(e.target.value) || 400)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Min angle (°)</Label>
                      <Input type="number" min={1} max={89} value={minAngle} onChange={(e) => setMinAngle(parseFloat(e.target.value) || 45)} />
                    </div>
                    <div>
                      <Label>Max aspect</Label>
                      <Input type="number" min={1} step={0.5} value={maxAspect} onChange={(e) => setMaxAspect(parseFloat(e.target.value) || 8)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Run / Reset buttons ──────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <button
            onClick={run}
            disabled={running}
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl
              bg-academic-700 hover:bg-academic-800 disabled:bg-academic-300
              text-white font-semibold text-sm shadow-md hover:shadow-lg
              transition-all duration-200 min-w-[220px]"
          >
            {running ? (
              <><Loader2 size={17} className="animate-spin" /> Building &amp; Matching…</>
            ) : (
              <><Play size={16} /> Find Interface Matches</>
            )}
          </button>
          {(results !== null || error) && (
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl
                border border-slate-300 text-slate-600 hover:border-academic-400 hover:text-academic-700
                font-semibold text-sm transition-all duration-200"
            >
              <RotateCcw size={15} /> Reset
            </button>
          )}
        </div>

        {/* ── Error banner ────────────────────────────────────────── */}
        {error && (
          <div className="max-w-3xl mx-auto mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Results ─────────────────────────────────────────────── */}
        {results !== null && (
          <div className="max-w-6xl mx-auto">

            {/* Status bar */}
            {matchStatus === 'ok' ? (
              <div className="flex flex-wrap items-center gap-3 mb-6 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3">
                <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
                <span className="text-emerald-800 font-semibold text-sm">
                  {results.length} interface match{results.length !== 1 ? 'es' : ''} found
                </span>
                {totalCandidates !== null && (
                  <span className="text-emerald-600 text-xs">
                    ({totalCandidates} candidates evaluated)
                  </span>
                )}
                <span className="ml-auto text-xs text-emerald-600">
                  {metal}({millerH}{millerK}{millerL}) / {monolayer}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3 mb-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
                <AlertCircle size={20} className="text-amber-600 flex-shrink-0" />
                <span className="text-amber-800 font-semibold text-sm">
                  No match found under {maxMismatch}% mismatch threshold.
                  {totalCandidates !== null && ` (${totalCandidates} candidates evaluated)`}
                </span>
              </div>
            )}

            {/* Match cards */}
            {results.length > 0 && (
              <div className="space-y-3 mb-6">
                {results.map((match, i) => {
                  const tier = mismatchTier(match.mismatch_pct);
                  return (
                    <div
                      key={i}
                      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <span className="w-8 h-8 rounded-lg bg-academic-100 text-academic-700 font-bold text-sm flex items-center justify-center">
                          #{match.rank ?? i + 1}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${tier.cls}`}>
                          {tier.label}
                        </span>
                        <span className="ml-auto text-xs text-slate-400">
                          <Zap size={12} className="inline mr-1" />
                          {(match.mismatch_pct ?? 0).toFixed(4)}% mismatch
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {[
                          { label: 'Mismatch', value: `${(match.mismatch_pct ?? 0).toFixed(4)}%` },
                          { label: 'Rotation', value: `${(match.rotation_deg ?? 0).toFixed(2)}°` },
                          { label: 'Von Mises', value: `${(match.von_mises_strain_pct ?? 0).toFixed(3)}%` },
                          { label: 'Interface Area', value: `${(match.interface_area_ang2 ?? 0).toFixed(1)} Å²` },
                          { label: 'Film atoms', value: match.film_supercell_atoms ?? '—' },
                          { label: 'Substrate atoms', value: match.substrate_supercell_atoms ?? '—' },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-slate-50 rounded-lg px-3 py-2 text-center">
                            <div className="text-xs text-slate-400 mb-0.5">{label}</div>
                            <div className="text-sm font-semibold text-slate-800">{value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Film matrix + CIF download */}
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {match.film_matrix && (
                          <div className="flex items-center gap-2 text-xs text-slate-500 flex-1">
                            <span className="font-medium text-slate-600">Film matrix:</span>
                            <code className="bg-slate-100 px-2 py-0.5 rounded font-mono text-xs">
                              [[{match.film_matrix[0][0]}, {match.film_matrix[0][1]}], [{match.film_matrix[1][0]}, {match.film_matrix[1][1]}]]
                            </code>
                          </div>
                        )}
                        <div className="flex gap-2 ml-auto flex-wrap">
                          {match.film_matrix && selectedMonolayer && (
                            <button
                              onClick={() => {
                                const basis: BaseAtom[] = selectedMonolayer.baseAtoms?.length
                                  ? selectedMonolayer.baseAtoms.map((a) => ({ ...a, z: 0.5 }))
                                  : [{ symbol: 'B', x: 0, y: 0, z: 0.5 }, { symbol: 'N', x: 1/3, y: 2/3, z: 0.5 }];
                                const cif = generateFilmCIF(match.film_matrix!, selectedMonolayer.a, selectedMonolayer.b, selectedMonolayer.gamma, basis, monolayer);
                                triggerDownload(cif, `film_${monolayer}_rank${match.rank ?? i+1}_${metal}${millerH}${millerK}${millerL}.cif`);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-academic-700 hover:bg-academic-800 text-white text-xs font-semibold transition"
                            >
                              <Download size={12} /> Film CIF
                            </button>
                          )}
                          {substrateCif && (
                            <button
                              onClick={() => triggerDownload(substrateCif, `substrate_${metal}${millerH}${millerK}${millerL}.cif`)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-academic-400 text-academic-700 hover:bg-academic-100 text-xs font-semibold transition"
                            >
                              <Download size={12} /> Substrate CIF
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary table */}
            {results.length > 1 && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h4 className="font-semibold text-slate-700 text-sm">All Matches — Summary Table</h4>
                  <span className="text-xs text-slate-400">{results.length} results</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                        <th className="px-4 py-3 text-left font-semibold">Rank</th>
                        <th className="px-4 py-3 text-right font-semibold">Mismatch (%)</th>
                        <th className="px-4 py-3 text-right font-semibold">Rotation (°)</th>
                        <th className="px-4 py-3 text-right font-semibold">Von Mises (%)</th>
                        <th className="px-4 py-3 text-right font-semibold">Area (Å²)</th>
                        <th className="px-4 py-3 text-right font-semibold">Film atoms</th>
                        <th className="px-4 py-3 text-center font-semibold">Quality</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {results.map((m, i) => {
                        const t = mismatchTier(m.mismatch_pct);
                        return (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 font-semibold text-academic-700">#{m.rank ?? i + 1}</td>
                            <td className="px-4 py-3 text-right font-mono">{(m.mismatch_pct ?? 0).toFixed(4)}</td>
                            <td className="px-4 py-3 text-right font-mono">{(m.rotation_deg ?? 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-mono">{(m.von_mises_strain_pct ?? 0).toFixed(3)}</td>
                            <td className="px-4 py-3 text-right font-mono">{(m.interface_area_ang2 ?? 0).toFixed(1)}</td>
                            <td className="px-4 py-3 text-right font-mono">{m.film_supercell_atoms ?? '—'}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${t.cls}`}>{t.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Download buttons */}
            {results.length > 0 && (
              <div className="mt-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-academic-50 border border-academic-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-academic-700 flex-1">
                  <Download size={16} className="flex-shrink-0" />
                  <span>Download results:</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      const headers = ['Rank','Mismatch (%)','Rotation (deg)','Von Mises (%)','Area (A2)','Film Atoms','Substrate Atoms','Quality','Film Matrix'];
                      const rows = results.map((m, i) => [
                        m.rank ?? i + 1,
                        (m.mismatch_pct ?? 0).toFixed(4),
                        (m.rotation_deg ?? 0).toFixed(2),
                        (m.von_mises_strain_pct ?? 0).toFixed(3),
                        (m.interface_area_ang2 ?? 0).toFixed(1),
                        m.film_supercell_atoms ?? '',
                        m.substrate_supercell_atoms ?? '',
                        mismatchTier(m.mismatch_pct).label,
                        m.film_matrix ? `"[[${m.film_matrix[0][0]},${m.film_matrix[0][1]}],[${m.film_matrix[1][0]},${m.film_matrix[1][1]}]]"` : '',
                      ]);
                      const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                      a.download = `interface_matches_${metal}${millerH}${millerK}${millerL}_${monolayer}.csv`;
                      a.click();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-academic-700 hover:bg-academic-800 text-white text-xs font-semibold transition"
                  >
                    <Download size={13} /> CSV
                  </button>
                  <button
                    onClick={() => {
                      const payload = {
                        substrate: `${metal}(${millerH}${millerK}${millerL})`,
                        monolayer,
                        max_mismatch_pct: maxMismatch,
                        matches: results,
                      };
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
                      a.download = `interface_matches_${metal}${millerH}${millerK}${millerL}_${monolayer}.json`;
                      a.click();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-academic-400 text-academic-700 hover:bg-academic-100 text-xs font-semibold transition"
                  >
                    <Download size={13} /> JSON
                  </button>
                </div>
                <p className="text-xs text-academic-600 sm:hidden">CIF/POSCAR: run locally via Streamlit or Python CLI.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default InterfaceBuilder;
