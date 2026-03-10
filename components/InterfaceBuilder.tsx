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

// ── API endpoint (same as MatrixOptimizer) ────────────────────────────────────
const INTERFACE_MATCH_API_URL = import.meta.env.VITE_INTERFACE_MATCH_API?.trim() || '';

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

  const selectedMetal = METALS.find((m) => m.symbol === metal);
  const selectedMonolayer = MONOLAYER_PRESETS.find((m) => m.name === monolayer);

  const reset = () => {
    setResults(null);
    setError('');
    setMatchStatus(null);
    setTotalCandidates(null);
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
    if (!INTERFACE_MATCH_API_URL) {
      setError('API endpoint not configured. Set VITE_INTERFACE_MATCH_API in your .env file.');
      return;
    }

    const ml = MONOLAYER_PRESETS.find((m) => m.name === monolayer);
    if (!ml) { setError('Unknown monolayer selection.'); return; }

    setRunning(true);
    try {
      const payload = {
        element: metal,
        h: millerH,
        k: millerK,
        l: millerL,
        backend: 'ase',
        substrate: {
          layers,
          vacuum: subVacuum,
          repeat_max: repeatMax,
          lattice_a: selectedMetal?.a0 ?? null,
        },
        film: {
          name: ml.name,
          a: ml.a,
          b: ml.b,
          gamma: ml.gamma,
          atoms_per_cell: ml.atoms_per_cell,
          base_atoms: ml.baseAtoms || [],
          vacuum: mlVacuum,
        },
        matching: {
          max_mismatch: maxMismatch / 100,
          max_area: maxArea,
          top_k: topK,
          min_inplane_angle: minAngle,
          max_aspect_ratio: maxAspect,
          gap,
        },
      };

      const res = await fetch(INTERFACE_MATCH_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMatchStatus(data.status ?? (data.matches?.length ? 'ok' : 'no_match_under_threshold'));
      setTotalCandidates(data.summary?.num_candidates ?? null);
      setResults(data.matches ?? []);
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
            using the pymatgen ZSL algorithm with adaptive substrate repeat.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {['ASE builders', 'pymatgen ZSL', 'Adaptive repeat', 'Strain analysis'].map((tag) => (
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

                      {/* Film matrix */}
                      {match.film_matrix && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-medium text-slate-600">Film supercell matrix:</span>
                          <code className="bg-slate-100 px-2 py-0.5 rounded font-mono text-xs">
                            [[{match.film_matrix[0][0]}, {match.film_matrix[0][1]}], [{match.film_matrix[1][0]}, {match.film_matrix[1][1]}]]
                          </code>
                        </div>
                      )}
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

            {/* Download note */}
            {results.length > 0 && (
              <div className="mt-4 flex items-start gap-2 bg-academic-50 border border-academic-200 rounded-xl px-4 py-3 text-sm text-academic-700">
                <Download size={16} className="mt-0.5 flex-shrink-0" />
                <span>
                  To download CIF / POSCAR structure files, run the full workflow locally via the{' '}
                  <code className="bg-academic-100 px-1.5 py-0.5 rounded text-xs font-mono">Streamlit app</code>
                  {' '}or the Python CLI in the pt881-hbn-interface repository.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default InterfaceBuilder;
