"""
AWS Lambda function for ZSL-style Lattice Matching (pure numpy).

Implements the Zur-McGill (1984) supercell matching algorithm using
Hermite Normal Form (HNF) enumeration — no matplotlib or full pymatgen required.

Inputs (POST JSON):
  substrate_a, substrate_b, substrate_gamma  (Angstrom, degrees)
  film_a, film_b, film_gamma                 (Angstrom, degrees)
  max_area        — max interface area in Ang^2 (default 400)
  max_mismatch    — fractional mismatch threshold 0–1 (default 0.05 = 5%)
  min_inplane_angle — minimum in-plane angle in degrees (default 45)
  max_aspect_ratio  — maximum cell aspect ratio (default 8.0)
  top_k           — number of results to return (default 5)

Outputs (JSON):
  success, matches (list), total_candidates, algorithm
"""
import json
import numpy as np


# ── Lattice helpers ────────────────────────────────────────────────────────────

def build_2d_vectors(a: float, b: float, gamma_deg: float) -> np.ndarray:
    """2D lattice vectors as (2, 3) array from primitive cell parameters."""
    g = np.radians(gamma_deg)
    return np.array([
        [a, 0.0, 0.0],
        [b * np.cos(g), b * np.sin(g), 0.0],
    ])


def cell_params(v1: np.ndarray, v2: np.ndarray):
    """Return (length_a, length_b, gamma_deg) of a 2D supercell."""
    a = float(np.linalg.norm(v1))
    b = float(np.linalg.norm(v2))
    if a < 1e-10 or b < 1e-10:
        return a, b, 90.0
    cos_g = float(np.dot(v1, v2) / (a * b))
    cos_g = max(-1.0, min(1.0, cos_g))
    return a, b, float(np.degrees(np.arccos(cos_g)))


# ── HNF supercell enumeration ─────────────────────────────────────────────────

def hnf_matrices(max_det: int):
    """
    Yield all 2×2 Hermite Normal Form integer matrices with det 1..max_det.
    HNF form: [[a, 0], [c, d]]  with  a*d = det,  0 <= c < a,  a,d > 0.
    This covers all inequivalent 2D supercell expansions.
    """
    for det in range(1, max_det + 1):
        for a in range(1, det + 1):
            if det % a != 0:
                continue
            d = det // a
            for c in range(a):
                yield np.array([[a, 0], [c, d]], dtype=float)


def apply_transform(M: np.ndarray, prim: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Apply 2×2 integer matrix M to primitive 2D vectors (2,3)."""
    v1 = M[0, 0] * prim[0] + M[0, 1] * prim[1]
    v2 = M[1, 0] * prim[0] + M[1, 1] * prim[1]
    return v1, v2


# ── Matching ──────────────────────────────────────────────────────────────────

def compute_von_mises(a_sub, b_sub, a_film, b_film):
    """Biaxial von Mises strain approximation for 2D systems."""
    eps_a = (a_film - a_sub) / a_sub if a_sub > 0 else 0.0
    eps_b = (b_film - b_sub) / b_sub if b_sub > 0 else 0.0
    return float(abs(np.sqrt(max(0.0, eps_a ** 2 + eps_b ** 2 - eps_a * eps_b))))


def classify_tier(pct: float) -> str:
    if pct < 1.0:
        return "excellent"
    elif pct < 3.0:
        return "good"
    elif pct < 5.0:
        return "acceptable"
    return "marginal"


def run_zsl_match(
    substrate_a, substrate_b, substrate_gamma,
    film_a, film_b, film_gamma,
    max_area=400.0,
    max_mismatch=0.05,
    min_inplane_angle=45.0,
    max_aspect_ratio=8.0,
    top_k=5,
):
    """
    ZSL-style matching via HNF enumeration (pure numpy, no pymatgen).
    Returns (matches_list, total_candidates_count).
    """
    sub_prim = build_2d_vectors(substrate_a, substrate_b, substrate_gamma)
    film_prim = build_2d_vectors(film_a, film_b, film_gamma)

    # Primitive cell areas
    area_sub  = abs(float(substrate_a * substrate_b * np.sin(np.radians(substrate_gamma))))
    area_film = abs(float(film_a      * film_b      * np.sin(np.radians(film_gamma))))

    max_det_sub  = max(1, int(np.ceil(max_area / area_sub)))
    max_det_film = max(1, int(np.ceil(max_area / area_film)))

    # Cap to avoid exponential blow-up (det ~ 50 gives ~200 substrate matrices)
    max_det_sub  = min(max_det_sub,  60)
    max_det_film = min(max_det_film, 60)

    # Pre-build film supercell table: (a, b, gamma, det, M)
    film_table = []
    for Mf in hnf_matrices(max_det_film):
        v1f, v2f = apply_transform(Mf, film_prim)
        af, bf, gf = cell_params(v1f, v2f)
        if af < 0.1 or bf < 0.1:
            continue
        area_f = af * bf * abs(np.sin(np.radians(gf)))
        if area_f > max_area:
            continue
        film_table.append((af, bf, gf, int(round(Mf[0, 0] * Mf[1, 1])), Mf))

    candidates = []

    for Ms in hnf_matrices(max_det_sub):
        v1s, v2s = apply_transform(Ms, sub_prim)
        a_s, b_s, g_s = cell_params(v1s, v2s)
        if a_s < 0.1 or b_s < 0.1:
            continue

        area_s = a_s * b_s * abs(np.sin(np.radians(g_s)))
        if area_s > max_area:
            continue

        # Geometry filters on substrate supercell
        if g_s < min_inplane_angle or g_s > (180.0 - min_inplane_angle):
            continue
        asp_s = max(a_s / b_s, b_s / a_s)
        if asp_s > max_aspect_ratio:
            continue

        det_s = int(round(Ms[0, 0] * Ms[1, 1]))

        for af, bf, gf, det_f, Mf in film_table:
            # Geometry filters on film supercell
            if gf < min_inplane_angle or gf > (180.0 - min_inplane_angle):
                continue
            asp_f = max(af / bf, bf / af)
            if asp_f > max_aspect_ratio:
                continue

            # Mismatch between film and substrate supercells
            mm_a = abs(af - a_s) / a_s if a_s > 0 else 0.0
            mm_b = abs(bf - b_s) / b_s if b_s > 0 else 0.0
            mm_g = abs(gf - g_s) / 180.0
            mismatch = max(mm_a, mm_b, mm_g)

            if mismatch > max_mismatch:
                continue

            mismatch_pct = round(mismatch * 100, 3)
            von_mises_pct = round(compute_von_mises(a_s, b_s, af, bf) * 100, 3)

            # Rotation angle: angle of substrate supercell a-vector
            angle_sub = float(np.degrees(np.arctan2(float(v1s[1]), float(v1s[0]))))
            rotation_deg = round(angle_sub % 360, 2)

            candidates.append({
                "mismatch_pct": mismatch_pct,
                "von_mises_strain_pct": von_mises_pct,
                "rotation_deg": rotation_deg,
                "interface_area_ang2": round(area_s, 2),
                "film_sl_a": round(af, 4),
                "film_sl_b": round(bf, 4),
                "substrate_sl_a": round(a_s, 4),
                "substrate_sl_b": round(b_s, 4),
                "gamma_deg": round(g_s, 2),
                "film_supercell_atoms": det_f * 2,
                "substrate_supercell_atoms": det_s,
                "film_matrix": [
                    [int(Mf[0, 0]), int(Mf[0, 1])],
                    [int(Mf[1, 0]), int(Mf[1, 1])],
                ],
                "tier": classify_tier(mismatch_pct),
            })

    # Deduplicate near-identical results by mismatch bucket
    seen = set()
    deduped = []
    for c in sorted(candidates, key=lambda x: x["mismatch_pct"]):
        key = (
            round(c["mismatch_pct"], 1),
            c["film_supercell_atoms"],
            c["substrate_supercell_atoms"],
        )
        if key not in seen:
            seen.add(key)
            deduped.append(c)

    total = len(deduped)
    results = []
    for i, c in enumerate(deduped[:top_k]):
        c["rank"] = i + 1
        results.append(c)

    return results, total


# ── Lambda handler ─────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    cors = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors, "body": ""}

    try:
        raw = event.get("body", event)
        body = json.loads(raw) if isinstance(raw, str) else raw

        substrate_a     = float(body.get("substrate_a", 2.77))
        substrate_b     = float(body.get("substrate_b", 2.77))
        substrate_gamma = float(body.get("substrate_gamma", 120.0))
        film_a          = float(body.get("film_a", 2.50))
        film_b          = float(body.get("film_b", 2.50))
        film_gamma      = float(body.get("film_gamma", 120.0))
        max_area        = min(float(body.get("max_area", 400.0)), 2000.0)
        max_mismatch    = min(float(body.get("max_mismatch", 0.05)), 0.20)
        min_angle       = float(body.get("min_inplane_angle", 45.0))
        max_aspect      = float(body.get("max_aspect_ratio", 8.0))
        top_k           = min(int(body.get("top_k", 5)), 20)

        matches, total = run_zsl_match(
            substrate_a, substrate_b, substrate_gamma,
            film_a, film_b, film_gamma,
            max_area=max_area, max_mismatch=max_mismatch,
            min_inplane_angle=min_angle, max_aspect_ratio=max_aspect,
            top_k=top_k,
        )

        return {
            "statusCode": 200,
            "headers": cors,
            "body": json.dumps({
                "success": True,
                "matches": matches,
                "total_candidates": total,
                "algorithm": "ZSL-HNF",
            }),
        }

    except Exception as exc:
        return {
            "statusCode": 500,
            "headers": cors,
            "body": json.dumps({"success": False, "error": str(exc)}),
        }


# ── Local test ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # hBN on Pt(111): Pt a=2.77 Å γ=120°, hBN a=2.50 Å γ=120°
    import time
    t0 = time.time()
    result = lambda_handler({
        "substrate_a": 2.77, "substrate_b": 2.77, "substrate_gamma": 120.0,
        "film_a": 2.50, "film_b": 2.50, "film_gamma": 120.0,
        "max_area": 400.0, "max_mismatch": 0.05, "top_k": 5,
    }, None)
    print(json.dumps(json.loads(result["body"]), indent=2))
    print(f"Elapsed: {time.time()-t0:.2f}s")
