/// <reference lib="webworker" />

import { computeSupercellParams, scoreMatrix, classifyTier } from '../utils/matrixMath';
import type {
  WorkerInMessage,
  WorkerProgressMessage,
  WorkerResultMessage,
  WorkerErrorMessage,
  SurfaceCellParams,
  MonolayerMaterial,
  MatrixResult,
  TargetResults,
} from '../utils/matrixOptimizerTypes';

declare const self: DedicatedWorkerGlobalScope;

let shouldStop = false;

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;
  if (msg.type === 'stop') {
    shouldStop = true;
    return;
  }
  if (msg.type === 'start') {
    shouldStop = false;
    try {
      runOptimization(msg.config);
    } catch (err) {
      self.postMessage({
        type: 'error',
        data: { message: err instanceof Error ? err.message : 'Unknown error' },
      } as WorkerErrorMessage);
    }
  }
};

function runOptimization(config: {
  targets: SurfaceCellParams[];
  monolayer: MonolayerMaterial;
  duration_ms: number;
  scan_limit: number;
}) {
  const { targets, monolayer, duration_ms, scan_limit } = config;
  const startTime = performance.now();
  let totalTested = 0;

  // Per-target result storage (keep top 50 rolling)
  const bestResults = new Map<string, MatrixResult[]>();
  for (const t of targets) {
    bestResults.set(t.label, []);
  }

  // Pre-compute target areas for determinant filtering
  const targetMeta = targets.map(t => {
    const monoArea = monolayer.a * monolayer.b * Math.sin(monolayer.gamma * Math.PI / 180);
    const expectedDet = Math.round(t.area / monoArea);
    return {
      target: t,
      minDet: Math.max(1, Math.floor(expectedDet * 0.3)),
      maxDet: Math.ceil(expectedDet * 2.0) + 10,
    };
  });

  let lastProgressTime = startTime;

  function postProgress(phase: string) {
    const now = performance.now();
    if (now - lastProgressTime < 2000) return;
    lastProgressTime = now;

    const elapsed = now - startTime;
    const pct = Math.min(100, (elapsed / duration_ms) * 100);

    const results: TargetResults[] = targets.map(t => ({
      target: t,
      results: (bestResults.get(t.label) || []).slice(0, 10),
    }));

    self.postMessage({
      type: 'progress',
      data: { phase, progress_pct: pct, matrices_tested: totalTested, best_results_so_far: results, elapsed_ms: elapsed },
    } as WorkerProgressMessage);
  }

  function testMatrix(n: number, m: number, k: number, l: number) {
    const det = n * l - m * k;
    const absDet = Math.abs(det);
    if (absDet === 0) return;

    totalTested++;

    // Compute supercell parameters once
    const { a_super, b_super, gamma_super } = computeSupercellParams(
      monolayer.a, monolayer.b, monolayer.gamma, n, m, k, l
    );

    if (isNaN(a_super) || isNaN(b_super) || isNaN(gamma_super)) return;

    const atomCount = absDet * monolayer.atoms_per_cell;

    for (const meta of targetMeta) {
      // Quick determinant filter
      if (absDet < meta.minDet || absDet > meta.maxDet) continue;

      const { score, error_a_pct, error_b_pct, error_gamma_pct } = scoreMatrix(
        a_super, b_super, gamma_super,
        meta.target.a, meta.target.b, meta.target.gamma,
        atomCount
      );

      // Only keep results with max individual error < 10%
      if (Math.max(error_a_pct, error_b_pct, error_gamma_pct) >= 10) continue;

      const tier = classifyTier(error_a_pct, error_b_pct, error_gamma_pct);
      const result: MatrixResult = {
        matrix: [n, m, k, l],
        achieved_a: a_super,
        achieved_b: b_super,
        achieved_gamma: gamma_super,
        error_a_pct, error_b_pct, error_gamma_pct,
        atom_count: atomCount,
        score,
        tier,
        determinant: absDet,
      };

      const arr = bestResults.get(meta.target.label)!;
      arr.push(result);

      // Keep rolling top 50
      if (arr.length > 100) {
        arr.sort((a, b) => a.score - b.score);
        arr.length = 50;
      }
    }
  }

  // ============================================================
  // PHASE 1: Dense exhaustive search (40% of time)
  // ============================================================
  const phase1End = startTime + duration_ms * 0.4;
  const limit1 = Math.min(scan_limit, 20);

  outer1:
  for (let n = -limit1; n <= limit1 && !shouldStop; n++) {
    if (n === 0) continue;
    for (let m = -limit1; m <= limit1 && !shouldStop; m++) {
      for (let k = -limit1; k <= limit1; k++) {
        for (let l = -limit1; l <= limit1; l++) {
          testMatrix(n, m, k, l);
        }
      }
      postProgress('Phase 1: Exhaustive search');
      if (performance.now() > phase1End) break outer1;
    }
  }

  // Also search n=0 with m!=0
  if (!shouldStop && performance.now() <= phase1End) {
    for (let m = -limit1; m <= limit1 && !shouldStop; m++) {
      if (m === 0) continue;
      for (let k = -limit1; k <= limit1; k++) {
        for (let l = -limit1; l <= limit1; l++) {
          testMatrix(0, m, k, l);
        }
      }
      if (performance.now() > phase1End) break;
    }
  }

  // ============================================================
  // PHASE 2: Intelligent angle matching (25% of time)
  // ============================================================
  const phase2End = startTime + duration_ms * 0.65;
  const limit2v1 = 25;
  const limit2v2 = 50;
  const gammaRad = monolayer.gamma * Math.PI / 180;
  const baseCosG = Math.cos(gammaRad);
  const baseSinG = Math.sin(gammaRad);
  const monoA = monolayer.a;
  const monoB = monolayer.b;

  for (const target of targets) {
    if (shouldStop || performance.now() > phase2End) break;

    const targetCos = Math.cos(target.gamma * Math.PI / 180);
    const tolerance = 0.08; // cos tolerance

    for (let n = -limit2v1; n <= limit2v1 && !shouldStop; n++) {
      for (let m = -limit2v1; m <= limit2v1; m++) {
        if (n === 0 && m === 0) continue;

        // Compute first vector length
        const sx1 = n * monoA + m * monoB * baseCosG;
        const sy1 = m * monoB * baseSinG;
        const len1Sq = sx1 * sx1 + sy1 * sy1;
        if (len1Sq < 0.01) continue;
        const len1 = Math.sqrt(len1Sq);

        // Quick check: is len1 within ~50% of any target a?
        const ratioA = len1 / target.a;
        if (ratioA < 0.5 || ratioA > 2.0) continue;

        for (let k = -limit2v2; k <= limit2v2; k++) {
          for (let l = -limit2v2; l <= limit2v2; l++) {
            if (k === 0 && l === 0) continue;

            const sx2 = k * monoA + l * monoB * baseCosG;
            const sy2 = l * monoB * baseSinG;
            const len2Sq = sx2 * sx2 + sy2 * sy2;
            if (len2Sq < 0.01) continue;
            const len2 = Math.sqrt(len2Sq);

            const dot2d = sx1 * sx2 + sy1 * sy2;
            const cosTheta = dot2d / (len1 * len2);

            if (Math.abs(cosTheta - targetCos) < tolerance) {
              testMatrix(n, m, k, l);
            }
          }
        }

        postProgress('Phase 2: Angle matching');
        if (performance.now() > phase2End) break;
      }
      if (performance.now() > phase2End) break;
    }
  }

  // ============================================================
  // PHASE 3: Complementary angle search (15% of time)
  // ============================================================
  const phase3End = startTime + duration_ms * 0.8;

  for (const target of targets) {
    if (shouldStop || performance.now() > phase3End) break;

    const compGamma = 180 - target.gamma;
    if (compGamma <= 0 || compGamma >= 180) continue;

    const compCos = Math.cos(compGamma * Math.PI / 180);
    const tolerance = 0.08;

    for (let n = -limit2v1; n <= limit2v1 && !shouldStop; n++) {
      for (let m = -limit2v1; m <= limit2v1; m++) {
        if (n === 0 && m === 0) continue;

        const sx1 = n * monoA + m * monoB * baseCosG;
        const sy1 = m * monoB * baseSinG;
        const len1Sq = sx1 * sx1 + sy1 * sy1;
        if (len1Sq < 0.01) continue;
        const len1 = Math.sqrt(len1Sq);

        for (let k = -limit2v2; k <= limit2v2; k++) {
          for (let l = -limit2v2; l <= limit2v2; l++) {
            if (k === 0 && l === 0) continue;

            const sx2 = k * monoA + l * monoB * baseCosG;
            const sy2 = l * monoB * baseSinG;
            const len2Sq = sx2 * sx2 + sy2 * sy2;
            if (len2Sq < 0.01) continue;
            const len2 = Math.sqrt(len2Sq);

            const dot2d = sx1 * sx2 + sy1 * sy2;
            const cosTheta = dot2d / (len1 * len2);

            if (Math.abs(cosTheta - compCos) < tolerance) {
              testMatrix(n, m, k, l);
            }
          }
        }

        postProgress('Phase 3: Complementary angle');
        if (performance.now() > phase3End) break;
      }
      if (performance.now() > phase3End) break;
    }
  }

  // ============================================================
  // PHASE 4: Refinement around best results (20% of time)
  // ============================================================
  const phase4End = startTime + duration_ms;

  for (const target of targets) {
    if (shouldStop || performance.now() > phase4End) break;

    const currentBest = bestResults.get(target.label) || [];
    currentBest.sort((a, b) => a.score - b.score);

    for (const result of currentBest.slice(0, 30)) {
      if (shouldStop || performance.now() > phase4End) break;

      const [bn, bm, bk, bl] = result.matrix;
      const delta = 5;

      for (let dn = -delta; dn <= delta; dn++) {
        for (let dm = -delta; dm <= delta; dm++) {
          for (let dk = -delta; dk <= delta; dk++) {
            for (let dl = -delta; dl <= delta; dl++) {
              testMatrix(bn + dn, bm + dm, bk + dk, bl + dl);
            }
          }
        }
      }

      postProgress('Phase 4: Refinement');
    }
  }

  // ============================================================
  // DONE: Final sort and send results
  // ============================================================
  const allResults: TargetResults[] = targets.map(t => {
    const arr = bestResults.get(t.label) || [];
    arr.sort((a, b) => a.score - b.score);
    return { target: t, results: arr.slice(0, 10) };
  });

  self.postMessage({
    type: 'result',
    data: {
      all_results: allResults,
      total_tested: totalTested,
      elapsed_ms: performance.now() - startTime,
    },
  } as WorkerResultMessage);
}
