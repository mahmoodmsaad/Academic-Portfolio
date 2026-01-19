"""
Tests for matrix optimizer Lambda function
"""
import pytest
import numpy as np
import json
import sys
import os

# Add parent directory to path to import matrix_optimizer
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from matrix_optimizer import (
    calculate_cell_params,
    score_matrix,
    generate_matrices,
    optimize_matrices,
    lambda_handler
)


class TestCalculateCellParams:
    """Tests for calculate_cell_params function"""

    def test_identity_matrix(self):
        """Test with identity matrix"""
        matrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
        a, b, c, alpha, beta, gamma = calculate_cell_params(matrix, base_a=3.14, base_b=3.14)

        assert a == pytest.approx(3.14, abs=0.01)
        assert b == pytest.approx(3.14, abs=0.01)
        assert c == pytest.approx(5.24, abs=0.01)
        assert alpha == pytest.approx(90.0, abs=0.1)
        assert beta == pytest.approx(90.0, abs=0.1)
        assert gamma == pytest.approx(90.0, abs=0.1)

    def test_scaling_matrix(self):
        """Test with scaling matrix"""
        matrix = [[2, 0, 0], [0, 2, 0], [0, 0, 1]]
        a, b, c, alpha, beta, gamma = calculate_cell_params(matrix, base_a=3.14, base_b=3.14)

        assert a == pytest.approx(6.28, abs=0.01)  # 2 * 3.14
        assert b == pytest.approx(6.28, abs=0.01)  # 2 * 3.14
        assert c == pytest.approx(5.24, abs=0.01)
        assert alpha == pytest.approx(90.0, abs=0.1)
        assert beta == pytest.approx(90.0, abs=0.1)
        assert gamma == pytest.approx(90.0, abs=0.1)

    def test_7x7_matrix(self):
        """Test with 7x7 diagonal matrix"""
        matrix = [[7, 0, 0], [0, 7, 0], [0, 0, 1]]
        a, b, c, alpha, beta, gamma = calculate_cell_params(matrix, base_a=3.14, base_b=3.14)

        assert a == pytest.approx(21.98, abs=0.01)  # 7 * 3.14
        assert b == pytest.approx(21.98, abs=0.01)  # 7 * 3.14
        assert c == pytest.approx(5.24, abs=0.01)
        assert alpha == pytest.approx(90.0, abs=0.1)
        assert beta == pytest.approx(90.0, abs=0.1)
        assert gamma == pytest.approx(90.0, abs=0.1)

    def test_off_diagonal_matrix(self):
        """Test with off-diagonal elements"""
        matrix = [[1, 1, 0], [-1, 1, 0], [0, 0, 1]]
        a, b, c, alpha, beta, gamma = calculate_cell_params(matrix, base_a=3.14, base_b=3.14)

        # Should create 90 degree angles (orthogonal)
        assert a > 0
        assert b > 0
        assert c == pytest.approx(5.24, abs=0.01)
        assert alpha == pytest.approx(90.0, abs=0.1)
        assert beta == pytest.approx(90.0, abs=0.1)
        assert gamma == pytest.approx(90.0, abs=0.1)

    def test_custom_base_parameters(self):
        """Test with custom base cell parameters"""
        matrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
        a, b, c, alpha, beta, gamma = calculate_cell_params(matrix, base_a=5.0, base_b=4.0)

        assert a == pytest.approx(5.0, abs=0.01)
        assert b == pytest.approx(4.0, abs=0.01)
        assert c == pytest.approx(5.24, abs=0.01)


class TestScoreMatrix:
    """Tests for score_matrix function"""

    def test_perfect_match(self):
        """Test with perfect match to targets"""
        score = score_matrix(
            a=22.0, b=22.0, c=5.0,
            alpha=90.0, beta=90.0, gamma=80.0,
            num_atoms=100,
            target_a=22.0, target_b=22.0, target_gamma=80.0
        )

        # Score should be very low (good) for perfect match
        assert score < 0.5
        assert score >= 0  # Score should be non-negative

    def test_large_deviation_penalty(self):
        """Test penalty for large deviations"""
        # Small deviation
        score_small = score_matrix(
            a=22.5, b=22.5, c=5.0,
            alpha=90.0, beta=90.0, gamma=80.0,
            num_atoms=100,
            target_a=22.0, target_b=22.0, target_gamma=80.0
        )

        # Large deviation
        score_large = score_matrix(
            a=26.0, b=26.0, c=5.0,
            alpha=90.0, beta=90.0, gamma=80.0,
            num_atoms=100,
            target_a=22.0, target_b=22.0, target_gamma=80.0
        )

        # Large deviation should have higher (worse) score
        assert score_large > score_small

    def test_atom_count_penalty(self):
        """Test penalty for large atom counts"""
        score_few_atoms = score_matrix(
            a=22.0, b=22.0, c=5.0,
            alpha=90.0, beta=90.0, gamma=80.0,
            num_atoms=50,
            target_a=22.0, target_b=22.0, target_gamma=80.0
        )

        score_many_atoms = score_matrix(
            a=22.0, b=22.0, c=5.0,
            alpha=90.0, beta=90.0, gamma=80.0,
            num_atoms=200,
            target_a=22.0, target_b=22.0, target_gamma=80.0
        )

        # More atoms should have higher score (penalty)
        assert score_many_atoms > score_few_atoms

    def test_angle_deviation(self):
        """Test penalty for angle deviations from 90 degrees"""
        score_perfect = score_matrix(
            a=22.0, b=22.0, c=5.0,
            alpha=90.0, beta=90.0, gamma=80.0,
            num_atoms=100,
            target_a=22.0, target_b=22.0, target_gamma=80.0
        )

        score_deviation = score_matrix(
            a=22.0, b=22.0, c=5.0,
            alpha=85.0, beta=95.0, gamma=80.0,
            num_atoms=100,
            target_a=22.0, target_b=22.0, target_gamma=80.0
        )

        # Deviation from 90 degrees should increase score
        assert score_deviation > score_perfect

    def test_gamma_weight(self):
        """Test that gamma has lower weight than a and b"""
        # Deviation in a
        score_a_deviation = score_matrix(
            a=23.0, b=22.0, c=5.0,
            alpha=90.0, beta=90.0, gamma=80.0,
            num_atoms=100,
            target_a=22.0, target_b=22.0, target_gamma=80.0
        )

        # Same relative deviation in gamma
        score_gamma_deviation = score_matrix(
            a=22.0, b=22.0, c=5.0,
            alpha=90.0, beta=90.0, gamma=81.0,
            num_atoms=100,
            target_a=22.0, target_b=22.0, target_gamma=80.0
        )

        # Deviation in a should have higher impact (weight of 1 vs 0.8)
        assert score_a_deviation > score_gamma_deviation


class TestGenerateMatrices:
    """Tests for generate_matrices function"""

    def test_returns_list(self):
        """Test that function returns a list"""
        matrices = generate_matrices(max_val=3)
        assert isinstance(matrices, list)
        assert len(matrices) > 0

    def test_includes_specialized_matrices(self):
        """Test that specialized matrices are included"""
        matrices = generate_matrices(max_val=3)

        # Check for 7x7 diagonal matrix
        expected = [[7, 0, 0], [0, 7, 0], [0, 0, 1]]
        assert expected in matrices

    def test_matrix_shape(self):
        """Test that all matrices have correct shape"""
        matrices = generate_matrices(max_val=3)

        for matrix in matrices:
            assert len(matrix) == 3
            assert len(matrix[0]) == 3
            assert len(matrix[1]) == 3
            assert len(matrix[2]) == 3

    def test_determinant_constraint(self):
        """Test that generated matrices satisfy determinant constraint"""
        matrices = generate_matrices(max_val=5)

        # Check random sample of matrices (not all since there are many)
        for matrix in matrices[13:]:  # Skip specialized matrices
            det = np.linalg.det(matrix)
            assert 0 < det <= 200

    def test_max_val_limiting(self):
        """Test that max_val limits matrix generation"""
        matrices_small = generate_matrices(max_val=3)
        matrices_large = generate_matrices(max_val=7)

        # Larger max_val should generate more matrices
        assert len(matrices_large) >= len(matrices_small)

    def test_z_component_fixed(self):
        """Test that z component is always [0, 0, 1]"""
        matrices = generate_matrices(max_val=5)

        for matrix in matrices:
            assert matrix[2] == [0, 0, 1]


class TestOptimizeMatrices:
    """Tests for optimize_matrices function"""

    def test_returns_results(self):
        """Test that function returns results"""
        results = optimize_matrices(
            target_a=22.0,
            target_b=22.0,
            target_gamma=80.0,
            max_val=5
        )

        assert isinstance(results, list)
        assert len(results) > 0
        assert len(results) <= 10  # Should return top 10

    def test_results_structure(self):
        """Test that results have correct structure"""
        results = optimize_matrices(
            target_a=22.0,
            target_b=22.0,
            target_gamma=80.0,
            max_val=5
        )

        for result in results:
            assert 'matrix' in result
            assert 'lattice_a' in result
            assert 'lattice_b' in result
            assert 'lattice_c' in result
            assert 'alpha' in result
            assert 'beta' in result
            assert 'gamma' in result
            assert 'num_atoms' in result
            assert 'score' in result

    def test_results_sorted_by_score(self):
        """Test that results are sorted by score (best first)"""
        results = optimize_matrices(
            target_a=22.0,
            target_b=22.0,
            target_gamma=80.0,
            max_val=5
        )

        scores = [r['score'] for r in results]
        assert scores == sorted(scores)  # Should be in ascending order

    def test_num_atoms_calculation(self):
        """Test that number of atoms is calculated correctly"""
        results = optimize_matrices(
            target_a=22.0,
            target_b=22.0,
            target_gamma=80.0,
            max_val=5
        )

        for result in results:
            # num_atoms should be 2 * determinant (2 atoms per unit cell)
            # Use same calculation as the actual code to avoid floating point issues
            num_atoms = int(abs(np.linalg.det(result['matrix'])) * 2)
            assert result['num_atoms'] == num_atoms
            # Verify it's a positive number
            assert result['num_atoms'] > 0

    def test_handles_different_targets(self):
        """Test with different target parameters"""
        results1 = optimize_matrices(
            target_a=20.0,
            target_b=20.0,
            target_gamma=90.0,
            max_val=5
        )

        results2 = optimize_matrices(
            target_a=25.0,
            target_b=25.0,
            target_gamma=70.0,
            max_val=5
        )

        # Should produce different results
        assert results1[0]['matrix'] != results2[0]['matrix'] or \
               results1[0]['score'] != results2[0]['score']


class TestLambdaHandler:
    """Tests for lambda_handler function"""

    def test_successful_request(self):
        """Test successful request handling"""
        event = {
            'target_a': 22.0,
            'target_b': 22.0,
            'target_gamma': 80.0,
            'max_val': 5
        }

        response = lambda_handler(event, None)

        assert response['statusCode'] == 200
        assert 'body' in response

        body = json.loads(response['body'])
        assert body['success'] is True
        assert 'results' in body
        assert len(body['results']) > 0

    def test_request_with_body(self):
        """Test request with body parameter (API Gateway format)"""
        event = {
            'body': json.dumps({
                'target_a': 22.0,
                'target_b': 22.0,
                'target_gamma': 80.0,
                'max_val': 5
            })
        }

        response = lambda_handler(event, None)

        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['success'] is True

    def test_default_parameters(self):
        """Test with missing parameters (should use defaults)"""
        event = {}

        response = lambda_handler(event, None)

        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['success'] is True
        assert body['parameters']['target_a'] == 22.0
        assert body['parameters']['target_b'] == 22.0
        assert body['parameters']['target_gamma'] == 80.0
        assert body['parameters']['max_val'] == 12

    def test_max_val_limiting(self):
        """Test that max_val is limited to 15"""
        event = {
            'max_val': 100  # Try to set very high value
        }

        response = lambda_handler(event, None)

        body = json.loads(response['body'])
        assert body['parameters']['max_val'] == 15  # Should be limited

    def test_cors_headers(self):
        """Test that CORS headers are present"""
        event = {
            'target_a': 22.0,
            'target_b': 22.0,
            'target_gamma': 80.0,
            'max_val': 5
        }

        response = lambda_handler(event, None)

        assert 'headers' in response
        headers = response['headers']
        assert 'Access-Control-Allow-Origin' in headers
        assert headers['Access-Control-Allow-Origin'] == '*'
        assert 'Access-Control-Allow-Headers' in headers
        assert 'Access-Control-Allow-Methods' in headers

    def test_error_handling(self):
        """Test error handling with invalid input"""
        event = {
            'target_a': 'invalid',  # Invalid type
        }

        response = lambda_handler(event, None)

        assert response['statusCode'] == 500
        body = json.loads(response['body'])
        assert body['success'] is False
        assert 'error' in body

    def test_response_includes_parameters(self):
        """Test that response includes input parameters"""
        event = {
            'target_a': 20.0,
            'target_b': 25.0,
            'target_gamma': 85.0,
            'max_val': 7
        }

        response = lambda_handler(event, None)

        body = json.loads(response['body'])
        assert body['parameters']['target_a'] == 20.0
        assert body['parameters']['target_b'] == 25.0
        assert body['parameters']['target_gamma'] == 85.0
        assert body['parameters']['max_val'] == 7

    def test_results_format(self):
        """Test that results have correct format and types"""
        event = {
            'target_a': 22.0,
            'target_b': 22.0,
            'target_gamma': 80.0,
            'max_val': 5
        }

        response = lambda_handler(event, None)
        body = json.loads(response['body'])
        results = body['results']

        assert len(results) <= 10
        for result in results:
            assert isinstance(result['matrix'], list)
            assert isinstance(result['lattice_a'], (int, float))
            assert isinstance(result['lattice_b'], (int, float))
            assert isinstance(result['lattice_c'], (int, float))
            assert isinstance(result['alpha'], (int, float))
            assert isinstance(result['beta'], (int, float))
            assert isinstance(result['gamma'], (int, float))
            assert isinstance(result['num_atoms'], int)
            assert isinstance(result['score'], (int, float))
