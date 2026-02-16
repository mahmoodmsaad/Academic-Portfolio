"""Direct test of ASE surface generation"""
try:
    from ase.build import bulk, surface
    import numpy as np

    print("Testing ASE surface generation directly\n")

    # Test Pt bulk
    pt_bulk = bulk('Pt')
    print("Pt bulk:")
    print(f"  Cell: {pt_bulk.cell}")
    print(f"  Cellpar: {pt_bulk.cell.cellpar()}\n")

    # Test different surfaces
    for miller in [(1,1,1), (1,0,0), (5,5,1)]:
        h, k, l = miller
        print(f"Pt({h}{k}{l}) surface:")
        slab = surface(pt_bulk, miller, layers=1, vacuum=0.0, periodic=True)

        cell = slab.cell
        v1 = np.array(cell[0])
        v2 = np.array(cell[1])
        print(f"  v1 = {v1}")
        print(f"  v2 = {v2}")

        a = float(np.linalg.norm(v1))
        b = float(np.linalg.norm(v2))
        cos_gamma = float(np.dot(v1, v2) / (a * b))
        cos_gamma = max(-1.0, min(1.0, cos_gamma))
        gamma = float(np.degrees(np.arccos(cos_gamma)))

        print(f"  a = {a:.4f} A")
        print(f"  b = {b:.4f} A")
        print(f"  gamma = {gamma:.2f} deg")
        print(f"  Num atoms: {len(slab)}\n")

except ImportError as e:
    print(f"Cannot test ASE: {e}")
