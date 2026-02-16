"""Test script to debug Pymatgen surface parameter calculation for Pt(551)"""
import json
import sys

# Add lambda directory to path so we can import the module
sys.path.insert(0, 'lambda')

from surface_targets import lambda_handler

# Test Pt(551) with both backends
test_cases = [
    {'backend': 'ase', 'element': 'Pt', 'h': 5, 'k': 5, 'l': 1},
    {'backend': 'pymatgen', 'element': 'Pt', 'h': 5, 'k': 5, 'l': 1},
]

print("=" * 80)
print("Testing Pt(551) Surface Cell Parameters")
print("=" * 80)

for test in test_cases:
    print(f"\n{'='*80}")
    print(f"Backend: {test['backend'].upper()}")
    print(f"Surface: {test['element']}({test['h']}{test['k']}{test['l']})")
    print(f"{'='*80}")

    event = {'body': json.dumps(test)}
    result = lambda_handler(event, None)

    if result['statusCode'] == 200:
        data = json.loads(result['body'])

        # Print bulk info
        if 'bulk_info' in data:
            bulk = data['bulk_info']
            print(f"\nBulk Structure:")
            print(f"  a = {bulk['lattice_a']:.6f} A")
            print(f"  b = {bulk['lattice_b']:.6f} A")
            print(f"  c = {bulk['lattice_c']:.6f} A")
            print(f"  alpha = {bulk['alpha']:.2f} deg")
            print(f"  beta = {bulk['beta']:.2f} deg")
            print(f"  gamma = {bulk['gamma']:.2f} deg")

        # Print surface info
        if 'surface_info' in data:
            surf = data['surface_info']
            print(f"\nSurface Vectors:")
            print(f"  v1 = {surf['v1']}")
            print(f"  v2 = {surf['v2']}")
            print(f"  atoms_in_slab = {surf['atoms_in_slab']}")

        # Print targets
        print(f"\nSurface Cell Targets:")
        print(f"  {'Supercell':<20} {'a (A)':<12} {'b (A)':<12} {'gamma (deg)':<12} {'Area (A^2)':<12}")
        print(f"  {'-'*72}")
        for target in data['targets']:
            print(f"  {target['label']:<20} {target['a']:<12.4f} {target['b']:<12.4f} "
                  f"{target['gamma']:<12.2f} {target['area']:<12.2f}")
    else:
        error_data = json.loads(result['body'])
        print(f"\nERROR: {error_data.get('error', 'Unknown error')}")

# Now let's manually test with pymatgen to see what's happening
print("\n" + "=" * 80)
print("Manual Pymatgen Debug")
print("=" * 80)

try:
    from pymatgen.core import Structure, Element, Lattice
    from pymatgen.core.surface import SlabGenerator
    from pymatgen.io.ase import AseAtomsAdaptor
    from ase.build import bulk as ase_bulk
    import numpy as np

    # Build Pt bulk using ASE and convert to pymatgen
    element = 'Pt'
    h, k, l = 5, 5, 1

    print(f"\nBuilding {element} bulk structure...")
    ase_atoms = ase_bulk(element)
    struct = AseAtomsAdaptor.get_structure(ase_atoms)

    print(f"Bulk lattice:")
    print(f"  a = {struct.lattice.a:.6f} A")
    print(f"  b = {struct.lattice.b:.6f} A")
    print(f"  c = {struct.lattice.c:.6f} A")
    print(f"  Matrix:")
    for i, row in enumerate(struct.lattice.matrix):
        print(f"    v{i+1} = [{row[0]:.6f}, {row[1]:.6f}, {row[2]:.6f}]")

    print(f"\nGenerating ({h},{k},{l}) slab...")
    slabgen = SlabGenerator(
        struct,
        miller_index=(h, k, l),
        min_slab_size=1.0,
        min_vacuum_size=0.0,
        center_slab=False,
        in_unit_planes=True,
        primitive=True,
    )
    slabs = slabgen.get_slabs(symmetrize=False)

    if slabs:
        slab = slabs[0]
        print(f"\nSlab lattice:")
        print(f"  a = {slab.lattice.a:.6f} A")
        print(f"  b = {slab.lattice.b:.6f} A")
        print(f"  c = {slab.lattice.c:.6f} A")
        print(f"  alpha = {slab.lattice.alpha:.2f}deg")
        print(f"  beta = {slab.lattice.beta:.2f}deg")
        print(f"  gamma = {slab.lattice.gamma:.2f}deg")
        print(f"  Matrix:")
        for i, row in enumerate(slab.lattice.matrix):
            print(f"    v{i+1} = [{row[0]:.6f}, {row[1]:.6f}, {row[2]:.6f}]")

        # Extract surface parameters
        v1 = np.array(slab.lattice.matrix[0])
        v2 = np.array(slab.lattice.matrix[1])

        a = float(np.linalg.norm(v1))
        b = float(np.linalg.norm(v2))
        cos_gamma = float(np.dot(v1, v2) / (a * b))
        cos_gamma = max(-1.0, min(1.0, cos_gamma))
        gamma = float(np.degrees(np.arccos(cos_gamma)))
        area = float(a * b * np.sin(np.radians(gamma)))

        print(f"\nExtracted surface parameters:")
        print(f"  a = {a:.6f} A")
        print(f"  b = {b:.6f} A")
        print(f"  gamma = {gamma:.2f}deg")
        print(f"  area = {area:.2f} A^2")

        # Try with different parameters
        print(f"\n\nTrying with in_unit_planes=False...")
        slabgen2 = SlabGenerator(
            struct,
            miller_index=(h, k, l),
            min_slab_size=1.0,
            min_vacuum_size=0.0,
            center_slab=False,
            in_unit_planes=False,
            primitive=True,
        )
        slabs2 = slabgen2.get_slabs(symmetrize=False)
        if slabs2:
            slab2 = slabs2[0]
            print(f"Slab lattice (in_unit_planes=False):")
            print(f"  a = {slab2.lattice.a:.6f} A")
            print(f"  b = {slab2.lattice.b:.6f} A")
            print(f"  gamma = {slab2.lattice.gamma:.2f}deg")

except ImportError as e:
    print(f"\nCannot run manual debug: {e}")
    print("This is expected if pymatgen is not installed locally.")

print("\n" + "=" * 80)
