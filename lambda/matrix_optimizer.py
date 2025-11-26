"""
AWS Lambda function for Matrix Optimizer
Optimizes supercell matrices for 2D materials
"""
import json
import numpy as np
from typing import List, Dict, Tuple

def calculate_cell_params(matrix: List[List[float]], base_a: float = 3.14, base_b: float = 3.14) -> Tuple[float, float, float, float, float, float]:
    """Calculate cell parameters from transformation matrix"""
    # Convert matrix to numpy array
    M = np.array(matrix, dtype=float)
    
    # Base lattice vectors for phosphorene (approximate)
    base_cell = np.array([
        [base_a, 0, 0],
        [0, base_b, 0],
        [0, 0, 5.24]  # c parameter
    ])
    
    # Apply transformation
    new_cell = M @ base_cell
    
    # Calculate parameters
    a = np.linalg.norm(new_cell[0])
    b = np.linalg.norm(new_cell[1])
    c = np.linalg.norm(new_cell[2])
    
    # Calculate angles in degrees
    alpha = np.arccos(np.dot(new_cell[1], new_cell[2]) / (b * c)) * 180 / np.pi
    beta = np.arccos(np.dot(new_cell[0], new_cell[2]) / (a * c)) * 180 / np.pi
    gamma = np.arccos(np.dot(new_cell[0], new_cell[1]) / (a * b)) * 180 / np.pi
    
    return a, b, c, alpha, beta, gamma

def score_matrix(a: float, b: float, c: float, alpha: float, beta: float, gamma: float, 
                num_atoms: int, target_a: float, target_b: float, target_gamma: float) -> float:
    """Score how close the cell parameters are to targets"""
    score_a = abs(a - target_a) / target_a
    score_b = abs(b - target_b) / target_b
    score_gamma = abs(gamma - target_gamma) / target_gamma
    score_alpha = abs(alpha - 90.0) / 90.0
    score_beta = abs(beta - 90.0) / 90.0
    
    # Penalty for large deviations
    penalty = 0
    if score_a > 0.05:
        penalty += 10 * (score_a - 0.05)
    if score_b > 0.05:
        penalty += 10 * (score_b - 0.05)
    if score_gamma > 0.05:
        penalty += 5 * (score_gamma - 0.05)
    
    # Atom count penalty
    atom_penalty = (num_atoms / 100.0) * 0.3
    
    total_score = score_a + score_b + 0.8 * score_gamma + 0.3 * score_alpha + 0.3 * score_beta + penalty + atom_penalty
    return total_score

def generate_matrices(max_val: int = 12) -> List[List[List[int]]]:
    """Generate candidate transformation matrices"""
    matrices = []
    
    # Specialized matrices for common cases
    specialized = [
        [[7, 0, 0], [0, 7, 0], [0, 0, 1]],
        [[6, 1, 0], [-1, 6, 0], [0, 0, 1]],
        [[6, 0, 0], [0, 6, 0], [0, 0, 1]],
        [[5, 2, 0], [2, 5, 0], [0, 0, 1]],
        [[5, 0, 0], [0, 5, 0], [0, 0, 1]],
        [[4, 3, 0], [3, 4, 0], [0, 0, 1]],
        [[4, 0, 0], [0, 4, 0], [0, 0, 1]],
        [[3, 3, 0], [3, 3, 0], [0, 0, 1]],
        [[1, 1, 0], [-1, 1, 0], [0, 0, 1]],
        [[2, 1, 0], [-1, 2, 0], [0, 0, 1]],
        [[3, 1, 0], [-1, 3, 0], [0, 0, 1]],
        [[4, 1, 0], [-1, 4, 0], [0, 0, 1]],
        [[5, 1, 0], [-1, 5, 0], [0, 0, 1]],
    ]
    
    for matrix in specialized:
        matrices.append(matrix)
    
    # Generate systematic matrices (limited for Lambda performance)
    for i in range(1, min(max_val, 8) + 1):
        for j in range(-min(max_val, 8), min(max_val, 8) + 1):
            for k in range(1, min(max_val, 8) + 1):
                for l in range(-min(max_val, 8), min(max_val, 8) + 1):
                    matrix = [[i, j, 0], [k, l, 0], [0, 0, 1]]
                    det = np.linalg.det(matrix)
                    if 0 < det <= 200:
                        matrices.append(matrix)
    
    return matrices

def optimize_matrices(target_a: float, target_b: float, target_gamma: float, max_val: int) -> List[Dict]:
    """Find optimal matrices for given targets"""
    matrices = generate_matrices(max_val)
    results = []
    
    for matrix in matrices:
        try:
            # Calculate cell parameters
            a, b, c, alpha, beta, gamma = calculate_cell_params(matrix)
            
            # Calculate number of atoms (determinant of matrix)
            num_atoms = int(abs(np.linalg.det(matrix)) * 2)  # 2 atoms per unit cell
            
            # Score the result
            score = score_matrix(a, b, c, alpha, beta, gamma, num_atoms, target_a, target_b, target_gamma)
            
            results.append({
                'matrix': matrix,
                'lattice_a': round(a, 2),
                'lattice_b': round(b, 2),
                'lattice_c': round(c, 2),
                'alpha': round(alpha, 1),
                'beta': round(beta, 1),
                'gamma': round(gamma, 1),
                'num_atoms': num_atoms,
                'score': round(score, 4)
            })
        except Exception as e:
            continue
    
    # Sort by score and return top 10
    results.sort(key=lambda x: x['score'])
    return results[:10]

def lambda_handler(event, context):
    """AWS Lambda handler function"""
    try:
        # Parse request body
        if 'body' in event:
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            body = event
        
        # Get parameters with defaults
        target_a = float(body.get('target_a', 22.0))
        target_b = float(body.get('target_b', 22.0))
        target_gamma = float(body.get('target_gamma', 80.0))
        max_val = int(body.get('max_val', 12))
        
        # Validate inputs
        if max_val > 15:
            max_val = 15  # Limit to prevent timeout
        
        # Run optimization
        results = optimize_matrices(target_a, target_b, target_gamma, max_val)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'success': True,
                'results': results,
                'parameters': {
                    'target_a': target_a,
                    'target_b': target_b,
                    'target_gamma': target_gamma,
                    'max_val': max_val
                }
            })
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }

# For local testing
if __name__ == '__main__':
    test_event = {
        'target_a': 22.0,
        'target_b': 22.0,
        'target_gamma': 80.0,
        'max_val': 12
    }
    result = lambda_handler(test_event, None)
    print(json.dumps(json.loads(result['body']), indent=2))
