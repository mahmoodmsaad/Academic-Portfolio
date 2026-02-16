# Pymatgen Fix - Deployment Guide

## ✅ What Was Fixed

**File:** `surface_targets.py` (lines 209-225)

**The Bug:** Pymatgen slab vectors had non-zero z-components, but the code was using the full 3D vector norm, resulting in incorrect surface parameters (all showing gamma=60°, which is the bulk FCC angle).

**The Fix:** Project lattice vectors onto the x-y plane before calculating surface parameters.

## 🚀 Deployment Options

### Option 1: Quick Deploy (Windows - Recommended if function already exists)

```batch
cd lambda
DEPLOY_PYMATGEN_FIX.bat
```

Follow the prompts. This will:
1. Package the updated `surface_targets.py`
2. Upload to your existing Lambda function
3. Verify the deployment

### Option 2: Full Deploy with Docker (Best for production)

**Requirements:**
- Docker Desktop for Windows
- Git Bash or WSL

```bash
cd lambda
bash deploy_surface_targets.sh
```

This ensures Lambda-compatible binaries for ASE and Pymatgen.

### Option 3: Manual Deploy via AWS Console

1. **Create deployment package:**
   ```batch
   cd lambda
   mkdir package
   pip install -r requirements_surface.txt -t package
   copy surface_targets.py package\
   cd package
   powershell -command "Compress-Archive -Path * -DestinationPath ..\surface_targets.zip -Force"
   cd ..
   ```

2. **Upload to Lambda:**
   - Go to AWS Lambda Console
   - Find function: `surface-targets`
   - Click "Upload from" → ".zip file"
   - Select `surface_targets.zip`
   - Click "Save"

### Option 4: AWS CLI Direct Update

```bash
cd lambda

# Package (use existing package/ directory if available)
cd package
zip -r9 ../surface_targets_update.zip .
cd ..

# Just update the Python file if package already exists
zip surface_targets_update.zip surface_targets.py

# Deploy
aws lambda update-function-code \
  --function-name surface-targets \
  --zip-file fileb://surface_targets_update.zip \
  --region us-east-1
```

## 🧪 Testing After Deployment

### Test via AWS Lambda Console

1. Go to Lambda Console → `surface-targets` function
2. Click "Test" tab
3. Create test event:
   ```json
   {
     "body": "{\"element\":\"Pt\",\"h\":5,\"k\":5,\"l\":1,\"backend\":\"pymatgen\"}"
   }
   ```
4. Click "Test"
5. Check response - gamma should be ~70.53°, NOT 60.00°

### Test via curl

```bash
curl -X POST https://oy34w61rc6.execute-api.us-east-1.amazonaws.com/prod/surface-targets \
  -H "Content-Type: application/json" \
  -d '{"element":"Pt","h":5,"k":5,"l":1,"backend":"pymatgen"}'
```

**Expected output (correct):**
```json
{
  "success": true,
  "backend": "pymatgen",
  "targets": [
    {
      "label": "Supercell 1 (1x1)",
      "a": 2.4005,
      "b": 12.0025,
      "gamma": 70.53,
      ...
    }
  ]
}
```

**Old buggy output (gamma=60.00):**
```json
{
  "targets": [
    {
      "a": 2.7719,
      "b": 2.7719,
      "gamma": 60.00  ← WRONG!
    }
  ]
}
```

### Test on Your Website

1. Open your portfolio website
2. Navigate to Matrix Optimizer tool
3. Select **Pymatgen** backend
4. Enter: Element=Pt, h=5, k=5, l=1
5. Click "Compute Surface Cell Parameters"

**✅ Success indicators:**
- gamma ≠ 60.00° (should be ~70.53° for Pt(551))
- Supercells have different parameters (not all identical)
- Area values are reasonable

**❌ If you still see gamma=60.00°:**
- Lambda function wasn't updated
- Check CloudWatch logs
- Try hard-refresh browser (Ctrl+F5)

## 📋 Verification Checklist

- [ ] Lambda function updated successfully
- [ ] Test event returns gamma ≠ 60°
- [ ] Website shows correct Pymatgen parameters
- [ ] All supercells (1x1, 2x2, 3x3, 4x4) scale properly
- [ ] CIF download still works

## 🐛 Troubleshooting

### "Module not found" error
- The dependencies weren't packaged correctly
- Use Docker deployment (Option 2) for Lambda-compatible binaries

### Still shows gamma=60°
- Clear browser cache (Ctrl+F5)
- Check Lambda version deployed (should show recent update time)
- Verify `surface_targets.py` has the projection code (lines 217-218)

### Different values from ASE
- **This is expected!** Pymatgen and ASE choose different surface cell orientations
- Both are mathematically valid
- See `PYMATGEN_FIX_SUMMARY.md` for details

## 📞 Support

If you encounter issues:
1. Check CloudWatch Logs for the Lambda function
2. Run local test: `python test_surface_comparison.py`
3. Verify the fix is in your `surface_targets.py` file (lines 217-218 should have the projection code)

## 🎉 Success!

Once deployed, your Pymatgen backend will correctly calculate surface parameters by projecting vectors onto the x-y plane. The annoying "gamma=60° for everything" bug is now fixed!
