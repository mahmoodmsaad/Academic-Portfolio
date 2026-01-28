"""
AWS Lambda function for ASE-based surface target generation.
Uses Atomic Simulation Environment to compute surface unit cell parameters
for any element + Miller index combination. ASE automatically handles
lattice parameters - no hardcoding needed.
Also generates CIF files for each supercell target.
"""
import json
import numpy as np
from io import BytesIO


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

        if h == 0 and k == 0 and l == 0:
            return error_response(400, 'Miller indices cannot all be zero.')

        # Import ASE here (cold start optimization)
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
                'targets': targets,
                'bulk_info': bulk_info,
                'surface_info': surface_info,
                'miller_indices': [h, k, l],
            })
        }

    except Exception as e:
        return error_response(500, str(e))


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
