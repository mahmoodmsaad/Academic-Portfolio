/// <reference lib="webworker" />

import { classifyTier } from '../utils/matrixMath';
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
  const { targets, monolayer, duration_ms } = config;
  const startTime = performance.now();
  const endTime = startTime + duration_ms;
  let totalTested = 0;

  // Per-target result storage (keep top 50 rolling)
  const bestResults = new Map<string, MatrixResult[]>();
  for (const t of targets) {
    bestResults.set(t.label, []);
  }

  // Pre-compute monolayer constants
  const gammaRad = monolayer.gamma * Math.PI / 180;
  const baseCosG = Math.cos(gammaRad);
  const baseSinG = Math.sin(gammaRad);
  const monoA = monolayer.a;
  const monoB = monolayer.b;
  const monoArea = monoA * monoB * Math.abs(baseSinG);

  // Pre-compute target metadata for determinant filtering
  const targetMeta = targets.map(t => {
    const expectedDet = Math.round(t.area / monoArea);
    return {
      target: t,
      // Allow wide determinant range to catch more results
      minDet: Math.max(1, Math.floor(expectedDet * 0.2)),
      maxDet: Math.ceil(expectedDet * 3.0) + 20,
    };
  });

  let lastProgressTime = startTime;
  let progressCounter = 0;

  function postProgress(phase: string, force = false) {
    progressCounter++;
    if (!force && progressCounter % 50 !== 0) return;
    const now = performance.now();
    if (!force && now - lastProgressTime < 1500) return;
    lastProgressTime = now;

    const elapsed = now - startTime;
    const pct = Math.min(99.9, (elapsed / duration_ms) * 100);

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

    // Compute supercell parameters using 2D vector math inline for speed
    const sx1 = n * monoA + m * monoB * baseCosG;
    const sy1 = m * monoB * baseSinG;
    const sx2 = k * monoA + l * monoB * baseCosG;
    const sy2 = l * monoB * baseSinG;

    const a_super = Math.sqrt(sx1 * sx1 + sy1 * sy1);
    const b_super = Math.sqrt(sx2 * sx2 + sy2 * sy2);

    if (a_super < 0.01 || b_super < 0.01) return;

    const dot2d = sx1 * sx2 + sy1 * sy2;
    const cosGamma = dot2d / (a_super * b_super);
    const gamma_super = Math.acos(Math.max(-1, Math.min(1, cosGamma))) * (180 / Math.PI);

    if (isNaN(gamma_super)) return;

    const atomCount = absDet * monolayer.atoms_per_cell;

    for (const meta of targetMeta) {
      // Determinant filter
      if (absDet < meta.minDet || absDet > meta.maxDet) continue;

      const error_a_pct = Math.abs(a_super - meta.target.a) / meta.target.a * 100;
      const error_b_pct = Math.abs(b_super - meta.target.b) / meta.target.b * 100;
      const error_gamma_pct = Math.abs(gamma_super - meta.target.gamma) / meta.target.gamma * 100;

      // Only keep results with max individual error < 10%
      if (Math.max(error_a_pct, error_b_pct, error_gamma_pct) >= 10) continue;

      // Penalty for exceeding thresholds
      let penalty = 0;
      if (error_a_pct > 5) penalty += 10 * (error_a_pct - 5);
      if (error_b_pct > 5) penalty += 10 * (error_b_pct - 5);
      if (error_gamma_pct > 5) penalty += 5 * (error_gamma_pct - 5);
      const atomPenalty = (atomCount / 1000) * 0.2;
      const score = error_a_pct + error_b_pct + 1.5 * error_gamma_pct + penalty + atomPenalty;

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
  // PHASE 1: Exhaustive search with expanding radius (50% of time)
  // Keeps increasing the search radius until time runs out.
  // Each round re-scans from scratch at the new radius.
  // The exponential growth of (2R+1)^4 ensures later rounds
  // dominate computation time, making earlier redundancy negligible.
  // ============================================================
  const phase1End = startTime + duration_ms * 0.5;
  let radius = 15;

  while (!shouldStop && performance.now() < phase1End) {
    for (let n = -radius; n <= radius && !shouldStop; n++) {
      for (let m = -radius; m <= radius && !shouldStop; m++) {
        if (n === 0 && m === 0) continue;
        for (let k = -radius; k <= radius; k++) {
          for (let l = -radius; l <= radius; l++) {
            testMatrix(n, m, k, l);
          }
        }
        postProgress(`Phase 1: Exhaustive search (radius ${radius})`);
        if (performance.now() > phase1End) break;
      }
      if (performance.now() > phase1End) break;
    }
    radius += 3;
  }

  // ============================================================
  // PHASE 2: Angle-targeted search with expanding radius (30% of time)
  // Pre-filters on angle match before testing, allowing much larger
  // search radii since most candidates are skipped.
  // ============================================================
  const phase2End = startTime + duration_ms * 0.8;
  let angLimitV1 = 25;
  let angLimitV2 = 50;

  while (!shouldStop && performance.now() < phase2End) {
    for (const target of targets) {
      if (shouldStop || performance.now() > phase2End) break;

      const targetCos = Math.cos(target.gamma * Math.PI / 180);
      const compCos = Math.cos((180 - target.gamma) * Math.PI / 180);
      const tolerance = 0.06;

      for (let n = -angLimitV1; n <= angLimitV1 && !shouldStop; n++) {
        for (let m = -angLimitV1; m <= angLimitV1; m++) {
          if (n === 0 && m === 0) continue;

          const sx1 = n * monoA + m * monoB * baseCosG;
          const sy1 = m * monoB * baseSinG;
          const len1Sq = sx1 * sx1 + sy1 * sy1;
          if (len1Sq < 0.01) continue;
          const len1 = Math.sqrt(len1Sq);

          // Quick length filter: first vector should be within a factor
          // of the target 'a' parameter
          let lengthOk = false;
          for (const t of targets) {
            const ratio = len1 / t.a;
            if (ratio > 0.3 && ratio < 3.0) { lengthOk = true; break; }
          }
          if (!lengthOk) continue;

          for (let k = -angLimitV2; k <= angLimitV2; k++) {
            for (let l = -angLimitV2; l <= angLimitV2; l++) {
              if (k === 0 && l === 0) continue;

              const sx2 = k * monoA + l * monoB * baseCosG;
              const sy2 = l * monoB * baseSinG;
              const len2Sq = sx2 * sx2 + sy2 * sy2;
              if (len2Sq < 0.01) continue;

              const cosTheta = (sx1 * sx2 + sy1 * sy2) / (len1 * Math.sqrt(len2Sq));

              // Test if angle matches target or its complement
              if (Math.abs(cosTheta - targetCos) < tolerance ||
                  Math.abs(cosTheta - compCos) < tolerance) {
                testMatrix(n, m, k, l);
              }
            }
          }

          postProgress(`Phase 2: Angle matching (${angLimitV1}x${angLimitV2})`);
          if (performance.now() > phase2End) break;
        }
        if (performance.now() > phase2End) break;
      }
    }
    angLimitV1 += 5;
    angLimitV2 += 10;
  }

  // ============================================================
  // PHASE 3: Refinement around best results (20% of time)
  // Repeatedly refines around top matches with increasing
  // perturbation delta until time runs out.
  // ============================================================
  let delta = 5;

  while (!shouldStop && performance.now() < endTime) {
    for (const target of targets) {
      if (shouldStop || performance.now() > endTime) break;

      const currentBest = bestResults.get(target.label) || [];
      currentBest.sort((a, b) => a.score - b.score);

      const topN = Math.min(currentBest.length, 50);
      for (let idx = 0; idx < topN; idx++) {
        if (shouldStop || performance.now() > endTime) break;

        const [bn, bm, bk, bl] = currentBest[idx].matrix;

        for (let dn = -delta; dn <= delta; dn++) {
          for (let dm = -delta; dm <= delta; dm++) {
            for (let dk = -delta; dk <= delta; dk++) {
              for (let dl = -delta; dl <= delta; dl++) {
                testMatrix(bn + dn, bm + dm, bk + dk, bl + dl);
              }
            }
          }
          if (performance.now() > endTime) break;
        }

        postProgress(`Phase 3: Refinement (delta ${delta})`);
      }
    }
    delta += 3;
  }

  // ============================================================
  // DONE: Final sort and send results
  // ============================================================
  const allResults: TargetResults[] = targets.map(t => {
    const arr = bestResults.get(t.label) || [];
    arr.sort((a, b) => a.score - b.score);
    return { target: t, results: arr.slice(0, 20) };
  });

  // Force a final progress update
  postProgress('Complete', true);

  self.postMessage({
    type: 'result',
    data: {
      all_results: allResults,
      total_tested: totalTested,
      elapsed_ms: performance.now() - startTime,
    },
  } as WorkerResultMessage);
}
