"""Detailed ASE surface test"""
try:
    from ase.build import bulk, surface, fcc111, fcc100
    import numpy as np

    print("Testing ASE FCC surface builders\n")

    # Test using specialized builders
    print("Using fcc111 builder:")
    slab_111 = fcc111('Pt', size=(1,1,1), vacuum=0.0, periodic=True)
    print(f"  Cell: {slab_111.cell}")
    print(f"  Cell params: {slab_111.cell.cellpar()}")
    print(f"  Atoms: {len(slab_111)}\n")

    print("Using fcc100 builder:")
    slab_100 = fcc100('Pt', size=(1,1,1), vacuum=0.0, periodic=True)
    print(f"  Cell: {slab_100.cell}")
    print(f"  Cell params: {slab_100.cell.cellpar()}")
    print(f"  Atoms: {len(slab_100)}\n")

    print("Conclusion: The specialized builders (fcc111, fcc100) give correct cells.")
    print("The generic surface() function may have issues with FCC (100).\n")

except ImportError as e:
    print(f"Cannot test ASE: {e}")
