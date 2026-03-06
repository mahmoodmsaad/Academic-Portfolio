from __future__ import annotations

from dataclasses import dataclass
from itertools import product

import numpy as np


@dataclass
class ZSLMatch:
    film_sl_vectors: list
    substrate_sl_vectors: list
    film_vectors: list
    substrate_vectors: list
    film_transformation: list
    substrate_transformation: list

    @property
    def match_area(self) -> float:
        return vec_area(*self.film_sl_vectors)

    @property
    def match_transformation(self) -> np.ndarray:
        film_matrix = list(self.film_sl_vectors)
        film_matrix.append(np.cross(film_matrix[0], film_matrix[1]))
        film_matrix = np.array(film_matrix, dtype=float)

        substrate_matrix = list(self.substrate_sl_vectors)
        temp_sub = np.cross(substrate_matrix[0], substrate_matrix[1]).astype(float)
        temp_sub = temp_sub * fast_norm(film_matrix[2]) / fast_norm(temp_sub)
        substrate_matrix.append(temp_sub)

        return np.transpose(np.linalg.solve(film_matrix, substrate_matrix))


class ZSLGenerator:
    def __init__(
        self,
        max_area_ratio_tol: float = 0.09,
        max_area: float = 400.0,
        max_length_tol: float = 0.03,
        max_angle_tol: float = 0.01,
        bidirectional: bool = False,
    ):
        self.max_area_ratio_tol = max_area_ratio_tol
        self.max_area = max_area
        self.max_length_tol = max_length_tol
        self.max_angle_tol = max_angle_tol
        self.bidirectional = bidirectional

    def generate_sl_transformation_sets(self, film_area: float, substrate_area: float):
        transformation_indices = [
            (ii, jj)
            for ii in range(1, int(np.ceil(self.max_area / film_area)))
            for jj in range(1, int(np.ceil(self.max_area / substrate_area)))
            if np.absolute(film_area / substrate_area - float(jj) / ii) < self.max_area_ratio_tol
        ] + [
            (ii, jj)
            for ii in range(1, int(np.ceil(self.max_area / film_area)))
            for jj in range(1, int(np.ceil(self.max_area / substrate_area)))
            if np.absolute(substrate_area / film_area - float(ii) / jj) < self.max_area_ratio_tol
        ]
        transformation_indices = list(set(transformation_indices))

        for ii, jj in sorted(transformation_indices, key=lambda x: x[0] * x[1]):
            yield gen_sl_transform_matrices(ii), gen_sl_transform_matrices(jj)

    def get_equiv_transformations(self, transformation_sets, film_vectors, substrate_vectors):
        for film_transformations, substrate_transformations in transformation_sets:
            films = np.array([reduce_vectors(*vectors) for vectors in np.dot(film_transformations, film_vectors)], dtype=float)
            substrates = np.array(
                [reduce_vectors(*vectors) for vectors in np.dot(substrate_transformations, substrate_vectors)],
                dtype=float,
            )

            for (film_transform, substrate_transform), (film_sl, substrate_sl) in zip(
                product(film_transformations, substrate_transformations),
                product(films, substrates),
            ):
                if is_same_vectors(
                    film_sl,
                    substrate_sl,
                    bidirectional=self.bidirectional,
                    max_length_tol=self.max_length_tol,
                    max_angle_tol=self.max_angle_tol,
                ):
                    yield [film_sl, substrate_sl, film_transform, substrate_transform]

    def __call__(self, film_vectors, substrate_vectors, lowest: bool = False):
        film_area = vec_area(*film_vectors)
        substrate_area = vec_area(*substrate_vectors)
        transformation_sets = self.generate_sl_transformation_sets(film_area, substrate_area)
        equiv_transformations = self.get_equiv_transformations(transformation_sets, film_vectors, substrate_vectors)

        for match in equiv_transformations:
            yield ZSLMatch(
                film_sl_vectors=match[0],
                substrate_sl_vectors=match[1],
                film_vectors=film_vectors,
                substrate_vectors=substrate_vectors,
                film_transformation=match[2],
                substrate_transformation=match[3],
            )
            if lowest:
                break


def gen_sl_transform_matrices(area_multiple: int) -> list[np.ndarray]:
    return [
        np.array(((i, j), (0, area_multiple / i)))
        for i in get_factors(area_multiple)
        for j in range(area_multiple // i)
    ]


def rel_strain(vec1: np.ndarray, vec2: np.ndarray) -> float:
    return fast_norm(vec2) / fast_norm(vec1) - 1


def rel_angle(vec_set1: np.ndarray, vec_set2: np.ndarray) -> float:
    return vec_angle(vec_set2[0], vec_set2[1]) / vec_angle(vec_set1[0], vec_set1[1]) - 1


def fast_norm(vector: np.ndarray) -> float:
    vector = np.array(vector, dtype=float)
    return float(np.sqrt(np.dot(vector, vector)))


def vec_angle(a: np.ndarray, b: np.ndarray) -> float:
    cosang = np.dot(a, b)
    sinang = fast_norm(np.cross(a, b))
    return float(np.arctan2(sinang, cosang))


def vec_area(a: np.ndarray, b: np.ndarray) -> float:
    return fast_norm(np.cross(a, b))


def reduce_vectors(a: np.ndarray, b: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    a = np.array(a, dtype=float)
    b = np.array(b, dtype=float)

    if np.dot(a, b) < 0:
        return reduce_vectors(a, -b)

    norm_b = fast_norm(b)

    if fast_norm(a) > norm_b:
        return reduce_vectors(b, a)

    if norm_b > fast_norm(np.add(b, a)):
        return reduce_vectors(a, np.add(b, a))

    if norm_b > fast_norm(np.subtract(b, a)):
        return reduce_vectors(a, np.subtract(b, a))

    return a, b


def get_factors(value: int):
    for candidate in range(1, value + 1):
        if value % candidate == 0:
            yield candidate


def _unidirectional_is_same_vectors(
    vec_set1: np.ndarray,
    vec_set2: np.ndarray,
    max_length_tol: float,
    max_angle_tol: float,
) -> bool:
    if np.absolute(rel_strain(vec_set1[0], vec_set2[0])) > max_length_tol:
        return False
    if np.absolute(rel_strain(vec_set1[1], vec_set2[1])) > max_length_tol:
        return False
    return bool(np.absolute(rel_angle(vec_set1, vec_set2)) <= max_angle_tol)


def _bidirectional_same_vectors(
    vec_set1: np.ndarray,
    vec_set2: np.ndarray,
    max_length_tol: float,
    max_angle_tol: float,
) -> bool:
    return _unidirectional_is_same_vectors(vec_set1, vec_set2, max_length_tol, max_angle_tol) or _unidirectional_is_same_vectors(
        vec_set2, vec_set1, max_length_tol, max_angle_tol
    )


def is_same_vectors(
    vec_set1: np.ndarray,
    vec_set2: np.ndarray,
    bidirectional: bool = False,
    max_length_tol: float = 0.03,
    max_angle_tol: float = 0.01,
) -> bool:
    if bidirectional:
        return _bidirectional_same_vectors(vec_set1, vec_set2, max_length_tol, max_angle_tol)
    return _unidirectional_is_same_vectors(vec_set1, vec_set2, max_length_tol, max_angle_tol)
