"""
AWS Lambda function for surface target generation using ASE or Pymatgen.
Computes surface unit cell parameters for any element + Miller index
combination. Supports two backends:
  - ASE (Atomic Simulation Environment)
  - Pymatgen (Python Materials Genomics)
Also generates CIF files for each supercell target.
"""
import json
import numpy as np
from io import BytesIO, StringIO


def lambda_handler(event, context):
    """AWS Lambda handler function"""
    try:
        # Handle CORS preflight
        if event.get('httpMethod') == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': cors_headers(),
                'body': ''
            }

        # Parse request body
        if 'body' in event:
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            body = event

        element = str(body.get('element', 'Pt')).strip()
        h = int(body.get('h', 1))
        k = int(body.get('k', 1))
        l = int(body.get('l', 1))
        backend = str(body.get('backend', 'ase')).strip().lower()

        if h == 0 and k == 0 and l == 0:
            return error_response(400, 'Miller indices cannot all be zero.')

        if backend == 'pymatgen':
            return _handle_pymatgen(element, h, k, l)
        else:
            return _handle_ase(element, h, k, l)

    except Exception as e:
        return error_response(500, str(e))


def _handle_ase(element, h, k, l):
    """Generate surface targets using ASE backend."""
    from ase.build import bulk, surface
    from ase.data import atomic_numbers, chemical_symbols
    from ase.io import write

    # Validate element
    if element not in chemical_symbols and element not in atomic_numbers:
        return error_response(400, f'Unknown element: {element}')

    # Build bulk structure - ASE knows lattice parameters automatically
    try:
        bulk_atoms = bulk(element)
    except Exception as e:
        return error_response(400, f'Cannot build bulk structure for {element}: {str(e)}')

    # Get bulk info
    cell_params = bulk_atoms.cell.cellpar()
    bulk_info = {
        'element': element,
        'lattice_a': round(float(cell_params[0]), 6),
        'lattice_b': round(float(cell_params[1]), 6),
        'lattice_c': round(float(cell_params[2]), 6),
        'alpha': round(float(cell_params[3]), 2),
        'beta': round(float(cell_params[4]), 2),
        'gamma': round(float(cell_params[5]), 2),
        'num_atoms': len(bulk_atoms),
    }

    # Create the surface slab for parameter extraction (1 layer, no vacuum)
    try:
        slab = surface(bulk_atoms, (h, k, l), layers=1, vacuum=0.0, periodic=True)
    except Exception as e:
        return error_response(400, f'Cannot create ({h}{k}{l}) surface for {element}: {str(e)}')

    # Extract surface cell vectors (first two are in-plane)
    cell = slab.cell
    v1 = np.array(cell[0])
    v2 = np.array(cell[1])

    a = float(np.linalg.norm(v1))
    b = float(np.linalg.norm(v2))

    if a < 1e-6 or b < 1e-6:
        return error_response(400, f'Surface vectors too small for ({h}{k}{l}).')

    cos_gamma = float(np.dot(v1, v2) / (a * b))
    cos_gamma = max(-1.0, min(1.0, cos_gamma))
    gamma = float(np.degrees(np.arccos(cos_gamma)))
    area = float(a * b * np.sin(np.radians(gamma)))

    # Create a proper slab for CIF export (4 layers + vacuum)
    try:
        slab_for_cif = surface(bulk_atoms, (h, k, l), layers=4, vacuum=10.0, periodic=True)
    except Exception:
        slab_for_cif = None

    # Generate 4 supercell targets: 1x1, 2x2, 3x3, 4x4
    scales = [1, 2, 3, 4]
    targets = []
    for s in scales:
        target = {
            'label': f'Supercell {s} ({s}x{s})',
            'a': round(s * a, 6),
            'b': round(s * b, 6),
            'gamma': round(gamma, 4),
            'area': round(s * s * area, 4),
        }

        # Generate CIF content for this supercell
        if slab_for_cif is not None:
            try:
                if s == 1:
                    supercell = slab_for_cif.copy()
                else:
                    supercell = slab_for_cif * (s, s, 1)
                buf = BytesIO()
                write(buf, supercell, format='cif')
                target['cif'] = buf.getvalue().decode('utf-8')
            except Exception as cif_err:
                target['cif_error'] = str(cif_err)

        targets.append(target)

    # Surface vectors for reference
    surface_info = {
        'v1': [round(float(x), 6) for x in v1],
        'v2': [round(float(x), 6) for x in v2],
        'atoms_in_slab': len(slab),
    }

    return {
        'statusCode': 200,
        'headers': cors_headers(),
        'body': json.dumps({
            'success': True,
            'backend': 'ase',
            'targets': targets,
            'bulk_info': bulk_info,
            'surface_info': surface_info,
            'miller_indices': [h, k, l],
        })
    }


def _handle_pymatgen(element, h, k, l):
    """
    Generate surface targets using Pymatgen backend.

    NOTE: Pymatgen's SlabGenerator may produce different surface cell orientations
    compared to ASE's surface() function, especially for high-index surfaces.
    Both are mathematically valid representations. We project lattice vectors onto
    the x-y plane to extract true in-plane surface parameters.
    """
    from pymatgen.core import Structure, Element
    from pymatgen.core.surface import SlabGenerator
    from pymatgen.io.cif import CifWriter

    # Validate element
    try:
        elem = Element(element)
    except ValueError:
        return error_response(400, f'Unknown element: {element}')

    # Build conventional bulk structure via pymatgen's MPRester-free approach
    try:
        from pymatgen.core import Lattice
        # Use pymatgen's element data for lattice constants
        # Build bulk from element's ground state structure
        struct = _get_bulk_structure_pymatgen(element)
        if struct is None:
            return error_response(400, f'Cannot build bulk structure for {element} with pymatgen.')
    except Exception as e:
        return error_response(400, f'Cannot build bulk structure for {element}: {str(e)}')

    # Get bulk info
    latt = struct.lattice
    bulk_info = {
        'element': element,
        'lattice_a': round(latt.a, 6),
        'lattice_b': round(latt.b, 6),
        'lattice_c': round(latt.c, 6),
        'alpha': round(latt.alpha, 2),
        'beta': round(latt.beta, 2),
        'gamma': round(latt.gamma, 2),
        'num_atoms': len(struct),
    }

    # Generate slab using SlabGenerator
    # Try to match ASE's behavior by using non-primitive cell and in_unit_planes=False
    try:
        slabgen = SlabGenerator(
            struct,
            miller_index=(h, k, l),
            min_slab_size=1.0,   # minimal for parameter extraction
            min_vacuum_size=0.0,
            center_slab=False,
            in_unit_planes=False,  # Changed from True to match ASE better
            primitive=False,        # Changed from True to get conventional cell like ASE
        )
        slabs = slabgen.get_slabs(symmetrize=False)
        if not slabs:
            return error_response(400, f'Pymatgen could not generate ({h}{k}{l}) surface for {element}.')
        slab = slabs[0]
    except Exception as e:
        return error_response(400, f'Cannot create ({h}{k}{l}) surface for {element}: {str(e)}')

    # Extract in-plane lattice parameters from slab
    # IMPORTANT: Pymatgen slabs may have tilted lattice vectors with non-zero z-components.
    # We must project onto the x-y plane to get true in-plane surface parameters.
    slab_latt = slab.lattice
    v1_3d = np.array(slab_latt.matrix[0])
    v2_3d = np.array(slab_latt.matrix[1])

    # Project vectors onto x-y plane (remove z-component)
    v1 = np.array([v1_3d[0], v1_3d[1], 0.0])
    v2 = np.array([v2_3d[0], v2_3d[1], 0.0])

    a = float(np.linalg.norm(v1))
    b = float(np.linalg.norm(v2))

    if a < 1e-6 or b < 1e-6:
        return error_response(400, f'Surface vectors too small for ({h}{k}{l}).')

    cos_gamma = float(np.dot(v1, v2) / (a * b))
    cos_gamma = max(-1.0, min(1.0, cos_gamma))
    gamma = float(np.degrees(np.arccos(cos_gamma)))
    area = float(a * b * np.sin(np.radians(gamma)))

    # Generate thicker slab for CIF export (4-layer equivalent)
    try:
        slabgen_cif = SlabGenerator(
            struct,
            miller_index=(h, k, l),
            min_slab_size=8.0,
            min_vacuum_size=10.0,
            center_slab=True,
            in_unit_planes=False,  # Match main slab generator
            primitive=False,        # Match main slab generator
        )
        cif_slabs = slabgen_cif.get_slabs(symmetrize=False)
        slab_for_cif = cif_slabs[0] if cif_slabs else None
    except Exception:
        slab_for_cif = None

    # Generate 4 supercell targets: 1x1, 2x2, 3x3, 4x4
    scales = [1, 2, 3, 4]
    targets = []
    for s in scales:
        target = {
            'label': f'Supercell {s} ({s}x{s})',
            'a': round(s * a, 6),
            'b': round(s * b, 6),
            'gamma': round(gamma, 4),
            'area': round(s * s * area, 4),
        }

        # Generate CIF content for this supercell
        if slab_for_cif is not None:
            try:
                supercell = slab_for_cif.copy()
                if s > 1:
                    supercell.make_supercell([[s, 0, 0], [0, s, 0], [0, 0, 1]])
                cif_writer = CifWriter(supercell, symprec=None)
                target['cif'] = str(cif_writer)
            except Exception as cif_err:
                target['cif_error'] = str(cif_err)

        targets.append(target)

    # Surface vectors for reference (projected in-plane vectors)
    surface_info = {
        'v1': [round(float(x), 6) for x in v1],
        'v2': [round(float(x), 6) for x in v2],
        'v1_3d_original': [round(float(x), 6) for x in v1_3d],
        'v2_3d_original': [round(float(x), 6) for x in v2_3d],
        'atoms_in_slab': len(slab),
    }

    return {
        'statusCode': 200,
        'headers': cors_headers(),
        'body': json.dumps({
            'success': True,
            'backend': 'pymatgen',
            'targets': targets,
            'bulk_info': bulk_info,
            'surface_info': surface_info,
            'miller_indices': [h, k, l],
        })
    }


def _get_bulk_structure_pymatgen(element):
    """
    Build a conventional bulk structure for an element using pymatgen.
    Uses ASE's bulk data via pymatgen's Element for lattice constants,
    then constructs the appropriate crystal structure.
    """
    from pymatgen.core import Structure, Lattice, Element as PmgElement

    elem = PmgElement(element)
    # Common ground-state crystal structures for metals
    # Pymatgen doesn't have a direct equivalent of ASE's bulk(),
    # so we use ase.build.bulk under the hood and convert
    try:
        from ase.build import bulk as ase_bulk
        from pymatgen.io.ase import AseAtomsAdaptor
        ase_atoms = ase_bulk(element)
        return AseAtomsAdaptor.get_structure(ase_atoms)
    except ImportError:
        pass

    # Fallback: hardcoded common metals (FCC, BCC, HCP)
    _FCC = {
        'Al': 4.046, 'Ni': 3.524, 'Cu': 3.615, 'Rh': 3.803, 'Pd': 3.890,
        'Ag': 4.086, 'Ir': 3.839, 'Pt': 3.924, 'Au': 4.078, 'Pb': 4.951,
    }
    _BCC = {
        'V': 3.024, 'Cr': 2.910, 'Fe': 2.870, 'Nb': 3.300, 'Mo': 3.147,
        'Ta': 3.303, 'W': 3.165,
    }
    _HCP = {
        'Ti': (2.951, 4.686), 'Co': (2.507, 4.069), 'Zn': (2.665, 4.947),
        'Zr': (3.232, 5.147), 'Ru': (2.706, 4.282), 'Hf': (3.195, 5.051),
        'Os': (2.734, 4.317), 'Re': (2.761, 4.456),
    }

    if element in _FCC:
        a0 = _FCC[element]
        latt = Lattice.cubic(a0)
        return Structure(latt, [element] * 4,
                         [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]])
    elif element in _BCC:
        a0 = _BCC[element]
        latt = Lattice.cubic(a0)
        return Structure(latt, [element] * 2,
                         [[0, 0, 0], [0.5, 0.5, 0.5]])
    elif element in _HCP:
        a0, c0 = _HCP[element]
        latt = Lattice.hexagonal(a0, c0)
        return Structure(latt, [element] * 2,
                         [[1/3, 2/3, 0.25], [2/3, 1/3, 0.75]])
    return None


def cors_headers():
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }


def error_response(status_code, message):
    return {
        'statusCode': status_code,
        'headers': cors_headers(),
        'body': json.dumps({
            'success': False,
            'error': message
        })
    }


# For local testing
if __name__ == '__main__':
    # Test Pt(111)
    test_event = {
        'body': json.dumps({
            'element': 'Pt',
            'h': 1, 'k': 1, 'l': 1
        })
    }
    result = lambda_handler(test_event, None)
    body = json.loads(result['body'])
    print(f"Targets: {len(body.get('targets', []))}")
    for t in body.get('targets', []):
        has_cif = 'cif' in t
        print(f"  {t['label']}: a={t['a']}, b={t['b']}, gamma={t['gamma']}, CIF={'yes' if has_cif else 'no'}")
