@echo off
REM ========================================================================
REM Deploy the FIXED surface_targets.py with Pymatgen projection fix
REM ========================================================================
REM
REM This script deploys the updated Lambda function with the fix for
REM Pymatgen surface parameter calculation (z-component projection).
REM
REM Prerequisites:
REM   1. AWS CLI installed and configured (aws configure)
REM   2. Python 3.11 installed
REM   3. (Optional) Docker Desktop for Windows for Lambda-compatible builds
REM
REM Usage: DEPLOY_PYMATGEN_FIX.bat
REM ========================================================================

setlocal enabledelayedexpansion

set FUNCTION_NAME=surface-targets
set REGION=us-east-1
set RUNTIME=python3.11
set HANDLER=surface_targets.lambda_handler
set TIMEOUT=30
set MEMORY=512

echo.
echo ========================================================================
echo Deploying FIXED surface_targets Lambda Function
echo ========================================================================
echo Function: %FUNCTION_NAME%
echo Region: %REGION%
echo.

REM Check if AWS CLI is installed
where aws >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: AWS CLI not found. Please install it first.
    echo Download from: https://aws.amazon.com/cli/
    exit /b 1
)

REM Check if already in lambda directory
if not exist "surface_targets.py" (
    echo ERROR: surface_targets.py not found!
    echo Please run this script from the lambda\ directory.
    exit /b 1
)

echo Step 1: Cleaning old deployment package...
if exist package rmdir /s /q package
if exist surface_targets.zip del /f /q surface_targets.zip

echo.
echo ========================================================================
echo IMPORTANT: Building Lambda-compatible package
echo ========================================================================
echo.
echo Option A (RECOMMENDED): Use AWS SAM CLI or Docker
echo   1. Install Docker Desktop for Windows
echo   2. Run in Git Bash or WSL:
echo      bash deploy_surface_targets.sh
echo.
echo Option B (Quick update, may have compatibility issues):
echo   1. Install dependencies locally
echo   2. Package with local Python
echo.
set /p choice="Choose option (A/B): "

if /i "!choice!"=="A" (
    echo.
    echo Please run: bash deploy_surface_targets.sh
    echo (Use Git Bash or WSL)
    pause
    exit /b 0
)

echo.
echo Step 2: Installing dependencies locally...
echo (Warning: May not be Lambda-compatible on Windows)
echo.

mkdir package
pip install -r requirements_surface.txt -t package --quiet

echo.
echo Step 3: Copying function code...
copy surface_targets.py package\

echo.
echo Step 4: Creating zip package...
cd package
powershell -command "Compress-Archive -Path * -DestinationPath ..\surface_targets.zip -Force"
cd ..

echo.
echo ========================================================================
echo Deployment package created: surface_targets.zip
echo ========================================================================
for %%A in (surface_targets.zip) do echo Size: %%~zA bytes
echo.

REM Check if function exists
aws lambda get-function --function-name %FUNCTION_NAME% --region %REGION% >nul 2>&1
if %errorlevel% equ 0 (
    echo Step 5: Updating existing Lambda function...
    echo.
    aws lambda update-function-code ^
        --function-name %FUNCTION_NAME% ^
        --zip-file fileb://surface_targets.zip ^
        --region %REGION%

    if %errorlevel% equ 0 (
        echo.
        echo ========================================================================
        echo SUCCESS! Function updated with Pymatgen fix
        echo ========================================================================
        echo.
        echo The fix includes:
        echo   - Projection of Pymatgen vectors onto x-y plane
        echo   - Corrected surface parameter calculation
        echo   - No more bulk lattice parameter errors!
        echo.
        echo Test your website now - Pymatgen should show correct values.
        echo.
    ) else (
        echo.
        echo ERROR: Failed to update function
        exit /b 1
    )
) else (
    echo Step 5: Function does not exist. Creating new function...
    echo.
    echo ERROR: Please create the function first using the AWS Console
    echo or run the full deployment script: deploy_surface_targets.sh
    exit /b 1
)

REM Cleanup
echo.
echo Cleaning up temporary files...
rmdir /s /q package 2>nul

echo.
echo ========================================================================
echo Deployment complete!
echo ========================================================================
echo.
echo Next steps:
echo   1. Go to your website
echo   2. Select Pymatgen backend
echo   3. Compute Pt(551) surface
echo   4. Verify gamma is NOT 60 degrees (should be ~70.53)
echo.
pause
