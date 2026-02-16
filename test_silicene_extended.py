import time
import sys
import os
import json
import numpy as np

sys.path.append(os.path.join(os.getcwd(), 'lambda'))
import matrix_optimizer

# --- Monkeypatching ---

# 1. New generator without 'min(max_val, 8)' limits
def generate_matrices_extended(max_val: int = 12):
    """Generate candidate transformation matrices WITHOUT internal caps"""
    matrices = []
    
    # Specialized matrices (keep original logic)
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
    for m in specialized:
        matrices.append(m)
    
    # Extended search loops
    print(f"Generating matrices with max_val={max_val}...")
    count = 0
    # i, k are diagonals (usually positive), j, l are off-diagonals
    limit = max_val
    for i in range(1, limit + 1):
        for j in range(-limit, limit + 1):
            for k in range(1, limit + 1):
                for l in range(-limit, limit + 1):
                    matrix = [[i, j, 0], [k, l, 0], [0, 0, 1]]
                    det = i*l - j*k # simplified det for this structure
                    # Original check: if 0 < det <= 200
                    # We might want to relax det limit for larger cells, but let's keep it for now
                    if 0 < det <= 300: 
                        matrices.append(matrix)
                        count += 1
    print(f"Generated {count} matrices.")
    return matrices

# Apply monkeypatch
matrix_optimizer.generate_matrices = generate_matrices_extended

# 2. Silicene defaults
base_a_silicene = 3.87
base_b_silicene = 6.703
matrix_optimizer.calculate_cell_params.__defaults__ = (base_a_silicene, base_b_silicene)

def run_extended_test():
    start_time = time.time()
    
    targets = [
        {"id": 1, "desc": "Au 3x3", "a": 8.64, "b": 8.64, "gamma": 60.0},
        {"id": 2, "desc": "Au 4x4", "a": 11.52, "b": 11.52, "gamma": 60.0},
        {"id": 3, "desc": "Au 5x5", "a": 14.40, "b": 14.40, "gamma": 60.0}
    ]
    
    # We use max_val=15, which is significantly larger than the hardcoded '8' in the original script
    search_depth = 12 
    
    print(f"Running EXTENDED optimization (depth={search_depth}) for Silicene on Gold...")
    
    for t in targets:
        print(f"\n--- {t['desc']} (Target a={t['a']}) ---")
        try:
            # Note: optimize_matrices calls generate_matrices, which is now our extended version
            results = matrix_optimizer.optimize_matrices(t['a'], t['b'], t['gamma'], search_depth)
            
            if results:
                best = results[0]
                print(f"  Score: {best['score']:.4f}")
                print(f"  Matrix: {best['matrix']}")
                print(f"  Lattice: a={best['lattice_a']}, b={best['lattice_b']}, gamma={best['gamma']}")
            else:
                print("  No match found.")
                
        except Exception as e:
            print(f"  Error: {e}")
            
    end_time = time.time()
    print(f"\nTotal execution time: {end_time - start_time:.4f} seconds")

if __name__ == "__main__":
    run_extended_test()
