from __future__ import annotations

import math
from typing import Any

import numpy as np
from ase import Atoms
from ase.build import bulk, graphene, make_supercell, surface
from ase.data import atomic_numbers, reference_states
from pymatgen.io.ase import AseAtomsAdaptor

from local_zsl import ZSLGenerator


def _positive_float(value: Any, default: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return float(default)
    return parsed if parsed > 0 else float(default)


def _positive_int(value: Any, default: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return int(default)
    return parsed if parsed > 0 else int(default)


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _angle_deg(v1: np.ndarray, v2: np.ndarray) -> float:
    denom = np.linalg.norm(v1) * np.linalg.norm(v2)
    if denom < 1e-12:
        return 0.0
    cos_theta = float(np.dot(v1, v2) / denom)
    cos_theta = max(-1.0, min(1.0, cos_theta))
    return math.degrees(math.acos(cos_theta))


def _classify_tier(mismatch_pct: float) -> str:
    if mismatch_pct < 1.0:
        return "excellent"
    if mismatch_pct < 3.0:
        return "good"
    if mismatch_pct < 5.0:
        return "acceptable"
    return "marginal"


def _coerce_int_2x2(matrix: np.ndarray) -> np.ndarray:
    matrix = np.array(matrix, dtype=float)
    rounded = np.rint(matrix).astype(int)
    if not np.allclose(matrix, rounded, atol=1e-6):
        raise ValueError(f"Transformation matrix is not integer-like: {matrix}")
    return rounded


def _supercell_matrix_3x3(matrix_2x2: np.ndarray) -> np.ndarray:
    matrix_3x3 = np.eye(3, dtype=int)
    matrix_3x3[:2, :2] = matrix_2x2
    return matrix_3x3


def _gauss_reduce_inplane_matrix(cell: np.ndarray, max_iter: int = 32) -> np.ndarray:
    basis = np.array(cell, dtype=float)
    a = basis[0, :].copy()
    b = basis[1, :].copy()
    transform = np.eye(2, dtype=int)

    for _ in range(max_iter):
        if np.linalg.norm(b) + 1e-12 < np.linalg.norm(a):
            a, b = b, a
            transform = np.array([[0, 1], [1, 0]], dtype=int) @ transform

        denom = float(np.dot(a, a))
        if denom < 1e-12:
            break

        mu = int(np.rint(np.dot(a, b) / denom))
        if mu != 0:
            b = b - mu * a
            transform = np.array([[1, 0], [-mu, 1]], dtype=int) @ transform
            continue

        cos_theta = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
        if abs(cos_theta) <= 0.5 + 1e-8:
            break

        shift = 1 if cos_theta > 0 else -1
        b = b - shift * a
        transform = np.array([[1, 0], [-shift, 1]], dtype=int) @ transform

    det = int(round(np.linalg.det(transform)))
    if det == -1:
        transform = np.array([[1, 0], [0, -1]], dtype=int) @ transform

    return transform


def _apply_inplane_unimodular(atoms: Atoms, transform_2x2: np.ndarray) -> Atoms:
    transformed = make_supercell(atoms, _supercell_matrix_3x3(transform_2x2))
    transformed.wrap(eps=1e-12)
    transformed.pbc = atoms.pbc
    return transformed


def _inplane_vectors_from_cell(cell: np.ndarray) -> np.ndarray:
    return np.array(cell, dtype=float)[:2, :]


def _inplane_geometry(vectors: np.ndarray) -> tuple[float, float, float, float]:
    vec_a, vec_b = vectors
    len_a = float(np.linalg.norm(vec_a))
    len_b = float(np.linalg.norm(vec_b))
    angle = _angle_deg(vec_a, vec_b)
    min_len = min(len_a, len_b)
    aspect = float("inf") if min_len < 1e-12 else float(max(len_a, len_b) / min_len)
    return len_a, len_b, angle, aspect


def _inplane_mismatch(film_vectors: np.ndarray, substrate_vectors: np.ndarray) -> tuple[float, float, float, float]:
    film_a, film_b = film_vectors
    sub_a, sub_b = substrate_vectors

    mismatch_a = abs(np.linalg.norm(film_a) / np.linalg.norm(sub_a) - 1.0)
    mismatch_b = abs(np.linalg.norm(film_b) / np.linalg.norm(sub_b) - 1.0)

    angle_film = _angle_deg(film_a, film_b)
    angle_sub = _angle_deg(sub_a, sub_b)
    mismatch_angle = 0.0 if abs(angle_sub) < 1e-10 else abs(angle_film / angle_sub - 1.0)

    mismatch = max(mismatch_a, mismatch_b, mismatch_angle)
    return mismatch, mismatch_a, mismatch_b, mismatch_angle


def _derive_unimodular_reduction(current_vectors: np.ndarray, reduced_vectors: np.ndarray) -> np.ndarray:
    current_2d = np.array(current_vectors, dtype=float)[:, :2]
    reduced_2d = np.array(reduced_vectors, dtype=float)[:, :2]

    det_current = float(np.linalg.det(current_2d))
    if abs(det_current) < 1e-12:
        raise ValueError("Current in-plane basis is singular; cannot derive reduction matrix.")

    transform_float = reduced_2d @ np.linalg.inv(current_2d)
    transform_int = np.rint(transform_float).astype(int)

    if not np.allclose(transform_float, transform_int, atol=1e-6):
        raise ValueError(
            "Could not derive integer reduction matrix. "
            f"float={transform_float}, rounded={transform_int}"
        )

    det_transform = int(round(np.linalg.det(transform_int)))
    if abs(det_transform) != 1:
        raise ValueError(f"Reduction matrix is not unimodular: {transform_int}")

    return transform_int


def _rotation_from_transform(match_transform: np.ndarray) -> tuple[float, list[list[float]]]:
    inplane = np.array(match_transform[:2, :2], dtype=float)
    u, _, v_t = np.linalg.svd(inplane)
    rotation = u @ v_t
    if np.linalg.det(rotation) < 0:
        v_t[-1, :] *= -1
        rotation = u @ v_t
    angle_deg = math.degrees(math.atan2(rotation[1, 0], rotation[0, 0]))
    return angle_deg, rotation.tolist()


def _fallback_strain_from_transform(match_transform: np.ndarray) -> tuple[np.ndarray, float]:
    inplane = np.array(match_transform[:2, :2], dtype=float)
    cauchy_green = inplane.T @ inplane
    green_lagrange = 0.5 * (cauchy_green - np.eye(2))

    strain_3x3 = np.zeros((3, 3), dtype=float)
    strain_3x3[:2, :2] = green_lagrange

    e_xx = green_lagrange[0, 0]
    e_yy = green_lagrange[1, 1]
    e_xy = green_lagrange[0, 1]
    von_mises = math.sqrt(max(0.0, e_xx**2 - e_xx * e_yy + e_yy**2 + 3.0 * e_xy**2))
    return strain_3x3, von_mises


def _strain_metrics_from_match(match_obj: Any, film_pm, substrate_miller: tuple[int, int, int]) -> tuple[np.ndarray, float]:
    try:
        from pymatgen.analysis.interfaces.substrate_analyzer import SubstrateMatch

        substrate_match = SubstrateMatch.from_zsl(
            match_obj,
            film=film_pm,
            film_miller=(0, 0, 1),
            substrate_miller=substrate_miller,
        )
        return np.array(substrate_match.strain, dtype=float), float(substrate_match.von_mises_strain)
    except Exception:
        transform = np.array(match_obj.match_transformation, dtype=float)
        return _fallback_strain_from_transform(transform)


def _apply_inplane_affine(film: Atoms, target_cell: np.ndarray) -> Atoms:
    aligned = film.copy()

    source_a = np.array(aligned.cell[0][:2], dtype=float)
    source_b = np.array(aligned.cell[1][:2], dtype=float)
    target_a = np.array(target_cell[0][:2], dtype=float)
    target_b = np.array(target_cell[1][:2], dtype=float)

    source_basis = np.column_stack([source_a, source_b])
    target_basis = np.column_stack([target_a, target_b])
    if abs(np.linalg.det(source_basis)) < 1e-10:
        raise ValueError("Singular film in-plane basis; cannot apply affine map.")

    affine = target_basis @ np.linalg.inv(source_basis)
    positions = aligned.get_positions()
    positions[:, :2] = (affine @ positions[:, :2].T).T
    aligned.set_positions(positions)

    new_cell = np.array(aligned.cell)
    new_cell[0, :] = target_cell[0, :]
    new_cell[1, :] = target_cell[1, :]
    aligned.set_cell(new_cell, scale_atoms=False)
    aligned.pbc = (True, True, False)
    return aligned


def _assemble_interface(substrate: Atoms, film: Atoms, gap: float) -> Atoms:
    substrate_top = float(np.max(substrate.positions[:, 2]))
    film_bottom = float(np.min(film.positions[:, 2]))
    z_shift = substrate_top + gap - film_bottom

    shifted_film = film.copy()
    shifted_film.positions[:, 2] += z_shift

    symbols = substrate.get_chemical_symbols() + shifted_film.get_chemical_symbols()
    positions = np.vstack([substrate.get_positions(), shifted_film.get_positions()])

    bottom = float(np.min(positions[:, 2]))
    positions[:, 2] += 3.0 - bottom

    top = float(np.max(positions[:, 2]))
    cell = np.array(substrate.cell)
    cell[2, :] = np.array([0.0, 0.0, top + 15.0], dtype=float)

    return Atoms(symbols=symbols, positions=positions, cell=cell, pbc=(True, True, False))


def _candidate_sort_key(candidate: dict[str, Any]) -> tuple[float, float, int, float, float, int]:
    return (
        float(candidate["in_plane_mismatch"]),
        float(candidate["substrate_aspect_ratio"]),
        int(candidate["film_supercell_multiplier"]),
        float(candidate["von_mises_strain"]),
        abs(float(candidate["rotation_deg"])),
        int(candidate["candidate_id"]),
    )


def _pt881_default_lattice_constant(element: str, ref_state: dict[str, Any] | None) -> float | None:
    if element == "Pt":
        return 3.923
    if ref_state and ref_state.get("a") is not None:
        return float(ref_state["a"])
    return None


def _build_conventional_bulk(element: str, lattice_a_override: float | None) -> tuple[Atoms, float | None]:
    try:
        atomic_number = atomic_numbers[element]
    except KeyError as exc:
        raise ValueError(f"Unknown element: {element}") from exc

    ref_state = reference_states[atomic_number]
    lattice_a = lattice_a_override if lattice_a_override and lattice_a_override > 0 else _pt881_default_lattice_constant(element, ref_state)
    symmetry = ref_state.get("symmetry") if ref_state else None

    if symmetry == "fcc":
        return bulk(element, "fcc", a=lattice_a, cubic=True), lattice_a
    if symmetry == "bcc":
        return bulk(element, "bcc", a=lattice_a, cubic=True), lattice_a
    if symmetry == "hcp":
        c_over_a = float(ref_state.get("c/a", math.sqrt(8.0 / 3.0)))
        return bulk(element, "hcp", a=lattice_a, c=lattice_a * c_over_a), lattice_a

    atoms = bulk(element)
    if lattice_a and atoms.cell.lengths()[0] > 1e-8:
        scale = lattice_a / float(atoms.cell.lengths()[0])
        atoms.set_cell(np.array(atoms.cell) * scale, scale_atoms=True)
    return atoms, lattice_a


def _build_surface_slab(
    element: str,
    miller: tuple[int, int, int],
    layers: int,
    vacuum: float,
    lattice_a_override: float | None,
    reduce_basis: bool,
) -> tuple[Atoms, np.ndarray, float | None]:
    conventional_bulk, lattice_a = _build_conventional_bulk(element, lattice_a_override)
    slab = surface(conventional_bulk, miller, layers=layers, vacuum=vacuum)
    slab.pbc = (True, True, False)

    reduction_matrix = np.eye(2, dtype=int)
    if reduce_basis:
        reduction_matrix = _gauss_reduce_inplane_matrix(np.array(slab.cell))
        slab = _apply_inplane_unimodular(slab, reduction_matrix)

    return slab, reduction_matrix, lattice_a


def _fallback_film_basis(name: str, atoms_per_cell: int) -> tuple[list[str], list[list[float]]]:
    normalized = name.strip().lower().replace(" ", "").replace("-", "")
    if normalized in {"hbn", "hexagonalboronnitride"}:
        return ["B", "N"], [[0.0, 0.0, 0.5], [1.0 / 3.0, 2.0 / 3.0, 0.5]]

    count = max(1, atoms_per_cell)
    symbols = ["C"] * count
    coords: list[list[float]] = []
    for idx in range(count):
        coords.append([idx / count, ((2 * idx) % count) / count, 0.5])
    return symbols, coords


def _build_film_monolayer(film_data: dict[str, Any]) -> Atoms:
    film_name = str(film_data.get("name") or "Film")
    a = _positive_float(film_data.get("a"), 2.5)
    b = _positive_float(film_data.get("b"), a)
    gamma_deg = _positive_float(film_data.get("gamma"), 120.0)
    vacuum = _positive_float(film_data.get("vacuum"), 15.0)
    atoms_per_cell = _positive_int(film_data.get("atoms_per_cell"), 2)
    base_atoms = film_data.get("base_atoms") or []
    normalized_name = film_name.strip().lower().replace(" ", "").replace("-", "")

    if normalized_name in {"hbn", "hexagonalboronnitride"} and abs(a - 2.5) <= 0.01 and abs(b - 2.5) <= 0.01:
        a = 2.5
        b = 2.5

    if normalized_name in {"hbn", "hexagonalboronnitride"} and abs(a - b) < 1e-8 and abs(gamma_deg - 120.0) < 1e-8:
        film = graphene(formula="BN", a=a, vacuum=vacuum)
        film.pbc = (True, True, False)
        return film

    gamma_rad = math.radians(gamma_deg)
    cell = np.array(
        [
            [a, 0.0, 0.0],
            [b * math.cos(gamma_rad), b * math.sin(gamma_rad), 0.0],
            [0.0, 0.0, max(2.0 * vacuum, 20.0)],
        ],
        dtype=float,
    )

    if base_atoms:
        symbols = [str(atom.get("symbol") or "C") for atom in base_atoms]
        scaled_positions = [
            [
                float(atom.get("x", 0.0)) % 1.0,
                float(atom.get("y", 0.0)) % 1.0,
                float(atom.get("z", 0.5)),
            ]
            for atom in base_atoms
        ]
    else:
        symbols, scaled_positions = _fallback_film_basis(film_name, atoms_per_cell)

    film = Atoms(symbols=symbols, cell=cell, pbc=(True, True, False))
    film.set_scaled_positions(scaled_positions)
    film.wrap(eps=1e-12)
    return film


def _primitive_surface_summary(atoms: Atoms) -> dict[str, float]:
    vectors = _inplane_vectors_from_cell(np.array(atoms.cell))
    a_len, b_len, gamma_deg, _ = _inplane_geometry(vectors)
    return {
        "a": float(a_len),
        "b": float(b_len),
        "gamma": float(gamma_deg),
    }


def _materialize_candidate(
    candidate: dict[str, Any],
    substrate_base: Atoms,
    film_base: Atoms,
    gap: float,
    rank: int,
) -> dict[str, Any]:
    substrate_repeated = substrate_base.repeat((int(candidate["pt_repeat"]), int(candidate["pt_repeat"]), 1))
    film_transform = _supercell_matrix_3x3(np.array(candidate["film_transformation"], dtype=int))
    substrate_transform = _supercell_matrix_3x3(np.array(candidate["substrate_transformation"], dtype=int))
    match_obj = candidate["match_obj"]

    substrate_super = make_supercell(substrate_repeated, substrate_transform)
    film_super = make_supercell(film_base, film_transform)

    film_reduce = _derive_unimodular_reduction(
        np.array(film_super.cell, dtype=float)[:2, :],
        np.array(match_obj.film_sl_vectors, dtype=float),
    )
    substrate_reduce = _derive_unimodular_reduction(
        np.array(substrate_super.cell, dtype=float)[:2, :],
        np.array(match_obj.substrate_sl_vectors, dtype=float),
    )

    film_super = _apply_inplane_unimodular(film_super, film_reduce)
    substrate_super = _apply_inplane_unimodular(substrate_super, substrate_reduce)

    film_aligned = _apply_inplane_affine(film_super, np.array(substrate_super.cell, dtype=float))
    interface = _assemble_interface(substrate_super, film_aligned, gap)

    compact_matrix = _gauss_reduce_inplane_matrix(np.array(interface.cell))
    substrate_super = _apply_inplane_unimodular(substrate_super, compact_matrix)
    film_aligned = _apply_inplane_unimodular(film_aligned, compact_matrix)
    interface = _apply_inplane_unimodular(interface, compact_matrix)

    mismatch_pct = float(candidate["in_plane_mismatch"]) * 100.0
    von_mises_pct = float(candidate["von_mises_strain"]) * 100.0

    return {
        "rank": rank,
        "candidate_id": int(candidate["candidate_id"]),
        "pt_repeat": int(candidate["pt_repeat"]),
        "mismatch_pct": mismatch_pct,
        "von_mises_strain_pct": von_mises_pct,
        "rotation_deg": float(candidate["rotation_deg"]),
        "interface_area_ang2": float(candidate["match_area"]),
        "film_sl_a": float(candidate["film_len_a"]),
        "film_sl_b": float(candidate["film_len_b"]),
        "substrate_sl_a": float(candidate["substrate_len_a"]),
        "substrate_sl_b": float(candidate["substrate_len_b"]),
        "gamma_deg": float(candidate["substrate_angle"]),
        "film_supercell_atoms": int(len(film_aligned)),
        "substrate_supercell_atoms": int(len(substrate_super)),
        "interface_atoms": int(len(interface)),
        "film_matrix": candidate["film_transformation"],
        "substrate_matrix": candidate["substrate_transformation"],
        "film_reduce_matrix": film_reduce.astype(int).tolist(),
        "substrate_reduce_matrix": substrate_reduce.astype(int).tolist(),
        "output_basis_reduction": compact_matrix.astype(int).tolist(),
        "film_supercell_multiplier": int(candidate["film_supercell_multiplier"]),
        "substrate_supercell_multiplier": int(candidate["substrate_supercell_multiplier"]),
        "passes_geometry_filter": bool(candidate["passes_geometry_filter"]),
        "meets_threshold": bool(candidate["meets_threshold"]),
        "tier": _classify_tier(mismatch_pct),
    }


def run_direct_interface_workflow(body: dict[str, Any]) -> dict[str, Any]:
    element = str(body.get("element", "Pt")).strip() or "Pt"
    h = int(body.get("h", 8))
    k = int(body.get("k", 8))
    l = int(body.get("l", 1))
    if h == 0 and k == 0 and l == 0:
        raise ValueError("Miller indices cannot all be zero.")

    substrate_input = body.get("substrate") or {}
    film_input = body.get("film") or {}
    matching_input = body.get("matching") or {}

    substrate_miller = (h, k, l)
    layers = _positive_int(substrate_input.get("layers"), 16)
    vacuum = _positive_float(substrate_input.get("vacuum"), 15.0)
    repeat_max = max(1, min(10, _positive_int(substrate_input.get("repeat_max"), 3)))
    lattice_a_override_raw = substrate_input.get("lattice_a")
    lattice_a_override = None
    if lattice_a_override_raw not in (None, ""):
        lattice_a_override = _positive_float(lattice_a_override_raw, 0.0)

    max_mismatch = _clamp(_positive_float(matching_input.get("max_mismatch"), 0.05), 0.001, 0.2)
    max_area = _clamp(_positive_float(matching_input.get("max_area"), 400.0), 25.0, 2000.0)
    top_k = max(1, min(20, _positive_int(matching_input.get("top_k"), 5)))
    min_inplane_angle = _clamp(_positive_float(matching_input.get("min_inplane_angle"), 45.0), 5.0, 89.0)
    max_aspect_ratio = _clamp(_positive_float(matching_input.get("max_aspect_ratio"), 8.0), 1.0, 25.0)
    gap = _positive_float(matching_input.get("gap"), 3.2)

    substrate_base_raw, pt_reduce_matrix, resolved_lattice_a = _build_surface_slab(
        element=element,
        miller=substrate_miller,
        layers=layers,
        vacuum=vacuum,
        lattice_a_override=lattice_a_override,
        reduce_basis=True,
    )
    film_base_raw = _build_film_monolayer(film_input)

    hbn_reduce_matrix = _gauss_reduce_inplane_matrix(np.array(film_base_raw.cell))
    substrate_base = substrate_base_raw
    film_base = _apply_inplane_unimodular(film_base_raw, hbn_reduce_matrix)

    adaptor = AseAtomsAdaptor()
    film_pm = adaptor.get_structure(film_base)

    zsl_tolerance = max(max_mismatch, 0.05)
    zsl = ZSLGenerator(
        max_area=max_area,
        max_area_ratio_tol=zsl_tolerance,
        max_length_tol=zsl_tolerance,
        max_angle_tol=zsl_tolerance,
        bidirectional=True,
    )

    film_vectors = _inplane_vectors_from_cell(np.array(film_base.cell))

    all_candidates: list[dict[str, Any]] = []
    accepted_candidates: list[dict[str, Any]] = []
    selected_repeat: int | None = None
    candidate_counter = 1

    for repeat_xy in range(1, repeat_max + 1):
        substrate_repeated = substrate_base.repeat((repeat_xy, repeat_xy, 1))
        substrate_vectors = _inplane_vectors_from_cell(np.array(substrate_repeated.cell))
        repeat_candidates: list[dict[str, Any]] = []

        for match_obj in list(zsl(film_vectors, substrate_vectors, lowest=False)):
            try:
                film_transform = _coerce_int_2x2(np.array(match_obj.film_transformation, dtype=float))
                substrate_transform = _coerce_int_2x2(np.array(match_obj.substrate_transformation, dtype=float))
            except ValueError:
                continue

            film_sl = np.array(match_obj.film_sl_vectors, dtype=float)
            substrate_sl = np.array(match_obj.substrate_sl_vectors, dtype=float)
            mismatch, mismatch_a, mismatch_b, mismatch_angle = _inplane_mismatch(film_sl, substrate_sl)

            sub_len_a, sub_len_b, sub_angle, sub_aspect = _inplane_geometry(substrate_sl)
            film_len_a, film_len_b, film_angle, film_aspect = _inplane_geometry(film_sl)

            compact_ok = bool(
                min_inplane_angle <= sub_angle <= (180.0 - min_inplane_angle)
                and sub_aspect <= max_aspect_ratio
            )

            match_transform = np.array(match_obj.match_transformation, dtype=float)
            rotation_deg, rotation_matrix = _rotation_from_transform(match_transform)
            strain_tensor, von_mises = _strain_metrics_from_match(match_obj, film_pm, substrate_miller)

            candidate = {
                "candidate_id": candidate_counter,
                "pt_repeat": repeat_xy,
                "in_plane_mismatch": float(mismatch),
                "length_mismatch_a": float(mismatch_a),
                "length_mismatch_b": float(mismatch_b),
                "angle_mismatch": float(mismatch_angle),
                "match_area": float(np.linalg.norm(np.cross(substrate_sl[0], substrate_sl[1]))),
                "rotation_deg": float(rotation_deg),
                "rotation_matrix_2d": [[float(x) for x in row] for row in rotation_matrix],
                "film_transformation": film_transform.astype(int).tolist(),
                "substrate_transformation": substrate_transform.astype(int).tolist(),
                "match_transformation": [[float(x) for x in row] for row in match_transform.tolist()],
                "strain_tensor": [[float(x) for x in row] for row in strain_tensor.tolist()],
                "von_mises_strain": float(von_mises),
                "substrate_len_a": float(sub_len_a),
                "substrate_len_b": float(sub_len_b),
                "substrate_angle": float(sub_angle),
                "substrate_aspect_ratio": float(sub_aspect),
                "film_len_a": float(film_len_a),
                "film_len_b": float(film_len_b),
                "film_angle": float(film_angle),
                "film_aspect_ratio": float(film_aspect),
                "film_supercell_multiplier": abs(int(round(np.linalg.det(film_transform)))),
                "substrate_supercell_multiplier": abs(int(round(np.linalg.det(substrate_transform)))),
                "passes_geometry_filter": compact_ok,
                "meets_threshold": bool(mismatch <= max_mismatch and compact_ok),
                "match_obj": match_obj,
            }
            candidate_counter += 1
            all_candidates.append(candidate)
            repeat_candidates.append(candidate)

        repeat_accepted = [candidate for candidate in repeat_candidates if candidate["meets_threshold"]]
        if repeat_accepted:
            accepted_candidates = repeat_accepted
            selected_repeat = repeat_xy
            break

    all_ranked = sorted(all_candidates, key=_candidate_sort_key)
    strict_ranked = sorted(accepted_candidates, key=_candidate_sort_key)[:top_k]

    if strict_ranked:
        matches = [
            _materialize_candidate(candidate, substrate_base, film_base, gap, rank)
            for rank, candidate in enumerate(strict_ranked, start=1)
        ]
        summary_message = f"Match found using validated structure workflow at repeat {selected_repeat}x{selected_repeat}."
        status = "ok"
    else:
        relaxed_mismatch = max(max_mismatch, min(0.2, max_mismatch * 2.0))
        relaxed_ranked = [
            candidate
            for candidate in all_ranked
            if candidate["passes_geometry_filter"] and candidate["in_plane_mismatch"] <= relaxed_mismatch
        ]
        if not relaxed_ranked:
            relaxed_ranked = [candidate for candidate in all_ranked if candidate["passes_geometry_filter"]]
        relaxed_ranked = relaxed_ranked[:top_k]
        matches = [
            _materialize_candidate(candidate, substrate_base, film_base, gap, rank)
            for rank, candidate in enumerate(relaxed_ranked, start=1)
        ]
        summary_message = (
            f"No match under {max_mismatch * 100:.2f}% mismatch. "
            f"Showing best structure-based candidates up to {relaxed_mismatch * 100:.2f}%."
        )
        status = "no_match_under_threshold"

    return {
        "success": True,
        "status": status,
        "summary": {
            "selected_repeat": selected_repeat,
            "num_candidates": len(all_candidates),
            "num_selected": len(matches),
            "max_mismatch": max_mismatch,
            "max_area": max_area,
            "message": summary_message,
            "workflow": "pt881-structure",
            "substrate_miller": list(substrate_miller),
            "layers": layers,
            "vacuum": vacuum,
            "gap": gap,
            "basis_reduction": True,
        },
        "matches": matches,
        "primitive_surface": _primitive_surface_summary(substrate_base),
        "surface_build": {
            "element": element,
            "lattice_a": resolved_lattice_a,
            "num_atoms": len(substrate_base),
            "pt_reduce_matrix": pt_reduce_matrix.astype(int).tolist(),
        },
        "film_build": {
            "name": str(film_input.get("name") or "Film"),
            "num_atoms": len(film_base),
            "hbn_reduce_matrix": hbn_reduce_matrix.astype(int).tolist(),
        },
    }
