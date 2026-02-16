"""
Test script to compare ASE vs Pymatgen for different surfaces
"""
import json
import sys
sys.path.insert(0, 'lambda')
from surface_targets import lambda_handler

def test_surface(element, h, k, l):
    """Test both backends for a given surface"""
    print(f"\n{'='*80}")
    print(f"Testing {element}({h}{k}{l}) Surface")
    print(f"{'='*80}")

    for backend in ['ase', 'pymatgen']:
        event = {'body': json.dumps({'element': element, 'h': h, 'k': k, 'l': l, 'backend': backend})}
        result = lambda_handler(event, None)

        if result['statusCode'] == 200:
            data = json.loads(result['body'])
            target = data['targets'][0]  # 1x1 supercell
            print(f"\n{backend.upper()}:")
            print(f"  a = {target['a']:.4f} A")
            print(f"  b = {target['b']:.4f} A")
            print(f"  gamma = {target['gamma']:.2f} deg")
            print(f"  area = {target['area']:.2f} A^2")

            surf_info = data.get('surface_info', {})
            print(f"  Surface vectors (projected):")
            print(f"    v1 = {surf_info.get('v1', 'N/A')}")
            print(f"    v2 = {surf_info.get('v2', 'N/A')}")
            if 'v1_3d_original' in surf_info:
                print(f"  Original 3D vectors:")
                print(f"    v1_3d = {surf_info['v1_3d_original']}")
                print(f"    v2_3d = {surf_info['v2_3d_original']}")
        else:
            error = json.loads(result['body'])
            print(f"\n{backend.upper()}: ERROR - {error.get('error')}")

# Test simple low-index surfaces first
test_surface('Pt', 1, 1, 1)  # (111) - should match well
test_surface('Pt', 1, 0, 0)  # (100) - should match well

# Test high-index surface
test_surface('Pt', 5, 5, 1)  # (551) - may differ between backends

print(f"\n{'='*80}")
print("Summary:")
print("Low-index surfaces (111), (100) should show similar results between ASE and Pymatgen.")
print("High-index surfaces like (551) may show different (but valid) cell choices.")
print("The key fix: Pymatgen vectors are projected onto x-y plane to get true surface parameters.")
print(f"{'='*80}\n")
