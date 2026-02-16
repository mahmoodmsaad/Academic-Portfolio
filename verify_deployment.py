"""
Verify the Pymatgen fix deployment
Run this AFTER deploying to Lambda to confirm the fix is working
"""
import json
import sys
import requests

# Your Lambda API endpoint
API_ENDPOINT = "https://oy34w61rc6.execute-api.us-east-1.amazonaws.com/prod/surface-targets"

def test_local():
    """Test local Lambda function"""
    print("\n" + "="*70)
    print("TESTING LOCAL Lambda Function")
    print("="*70)

    try:
        sys.path.insert(0, 'lambda')
        from surface_targets import lambda_handler

        event = {'body': json.dumps({
            'element': 'Pt',
            'h': 5,
            'k': 5,
            'l': 1,
            'backend': 'pymatgen'
        })}

        result = lambda_handler(event, None)
        data = json.loads(result['body'])

        target = data['targets'][0]
        gamma = target['gamma']

        print(f"\nLocal Result:")
        print(f"  Supercell 1x1: a={target['a']:.4f}, b={target['b']:.4f}, gamma={gamma:.2f}")

        if abs(gamma - 60.0) < 0.1:
            print("\n  [FAIL] gamma = 60.00 (still showing BULK parameters!)")
            print("  The fix is NOT applied locally.")
            return False
        else:
            print(f"\n  [PASS] gamma = {gamma:.2f} (correct surface parameters)")
            return True

    except Exception as e:
        print(f"\n  [ERROR] Local test failed: {e}")
        return False

def test_deployed():
    """Test deployed Lambda via API"""
    print("\n" + "="*70)
    print("TESTING DEPLOYED Lambda Function")
    print("="*70)
    print(f"\nEndpoint: {API_ENDPOINT}")

    try:
        payload = {
            'element': 'Pt',
            'h': 5,
            'k': 5,
            'l': 1,
            'backend': 'pymatgen'
        }

        print(f"\nSending request...")
        response = requests.post(API_ENDPOINT, json=payload, timeout=10)

        if response.status_code != 200:
            print(f"\n  [FAIL] HTTP {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return False

        data = response.json()

        if not data.get('success'):
            print(f"\n  [FAIL] API returned error:")
            print(f"  {data.get('error', 'Unknown error')}")
            return False

        target = data['targets'][0]
        gamma = target['gamma']

        print(f"\nDeployed Result:")
        print(f"  Supercell 1x1: a={target['a']:.4f}, b={target['b']:.4f}, gamma={gamma:.2f}")

        if abs(gamma - 60.0) < 0.1:
            print("\n  [FAIL] gamma = 60.00 (still showing BULK parameters!)")
            print("  The deployed Lambda does NOT have the fix yet.")
            print("\n  ACTION REQUIRED: Deploy the updated surface_targets.py")
            return False
        else:
            print(f"\n  [PASS] gamma = {gamma:.2f} (correct surface parameters)")
            print("\n  The fix is working on the deployed Lambda!")
            return True

    except requests.exceptions.Timeout:
        print("\n  [ERROR] Request timed out")
        return False
    except requests.exceptions.RequestException as e:
        print(f"\n  [ERROR] Request failed: {e}")
        return False
    except Exception as e:
        print(f"\n  [ERROR] Unexpected error: {e}")
        return False

def main():
    print("\n" + "="*70)
    print("PYMATGEN FIX VERIFICATION")
    print("="*70)
    print("\nThis script tests both local and deployed Lambda functions")
    print("to verify the Pymatgen surface parameter fix is working.")
    print("\nExpected behavior:")
    print("  - BEFORE fix: gamma = 60.00 (WRONG - bulk parameters)")
    print("  - AFTER fix:  gamma = 70.53 (CORRECT - surface parameters)")

    # Test local
    local_ok = test_local()

    # Test deployed
    deployed_ok = test_deployed()

    # Summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"\n  Local Function:    {'PASS' if local_ok else 'FAIL'}")
    print(f"  Deployed Function: {'PASS' if deployed_ok else 'FAIL'}")

    if local_ok and deployed_ok:
        print("\n  [SUCCESS] Both local and deployed functions are fixed!")
        print("\n  Your website should now show correct Pymatgen parameters.")
        print("  Go test it at: http://localhost:3000 (or your deployment URL)")
    elif local_ok and not deployed_ok:
        print("\n  [ACTION NEEDED] Local is fixed but deployed is not.")
        print("\n  Run deployment:")
        print("    cd lambda")
        print("    DEPLOY_PYMATGEN_FIX.bat")
        print("  Or see DEPLOYMENT_GUIDE.md for other options.")
    elif not local_ok and deployed_ok:
        print("\n  [WARNING] Deployed is fixed but local is not.")
        print("  This is unusual - check your local surface_targets.py")
    else:
        print("\n  [FAILED] Neither local nor deployed have the fix.")
        print("\n  Check that surface_targets.py has lines 217-218:")
        print("    v1 = np.array([v1_3d[0], v1_3d[1], 0.0])")
        print("    v2 = np.array([v2_3d[0], v2_3d[1], 0.0])")

    print("\n" + "="*70)

    return 0 if (local_ok and deployed_ok) else 1

if __name__ == '__main__':
    sys.exit(main())
