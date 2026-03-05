# Deploy ZSL Matcher Lambda to existing API Gateway
# Run from the lambda directory: .\deploy_zsl.ps1
# Reuses the pymatgen layer from the existing surface-targets Lambda.

param(
    [string]$Region = "us-east-1",
    [string]$ApiId  = "oy34w61rc6"   # existing API Gateway ID
)

$FunctionName = "zsl-matcher"
$HandlerName  = "zsl_matcher.lambda_handler"
$RoutePath    = "POST /zsl-match"

Write-Host "ZSL Matcher - Lambda Deployment" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# ── Pre-flight checks ──────────────────────────────────────────────────────────
try { aws --version | Out-Null } catch {
    Write-Host "ERROR: AWS CLI not installed." -ForegroundColor Red; exit 1
}
try { aws sts get-caller-identity | Out-Null } catch {
    Write-Host "ERROR: AWS not configured. Run: aws configure" -ForegroundColor Red; exit 1
}
$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
Write-Host "Account: $ACCOUNT_ID  |  Region: $Region" -ForegroundColor Gray

# ── Step 1: Find pymatgen layer from existing surface-targets Lambda ──────────
Write-Host "`n[1/5] Finding pymatgen layer from existing surface-targets Lambda..." -ForegroundColor Green

$LAYER_ARNS = @()

# Try common names for the surface-targets function
$candidateNames = @("surface-targets", "surface_targets", "portfolio-surface-targets", "mah-mood-surface-targets")
$foundFunction  = $null

foreach ($name in $candidateNames) {
    $fnInfo = aws lambda get-function --function-name $name --region $Region 2>$null | ConvertFrom-Json
    if ($fnInfo) { $foundFunction = $name; break }
}

if ($foundFunction) {
    Write-Host "Found Lambda: $foundFunction" -ForegroundColor Yellow
    $config = aws lambda get-function-configuration `
        --function-name $foundFunction --region $Region | ConvertFrom-Json
    if ($config.Layers) {
        $LAYER_ARNS = $config.Layers | ForEach-Object { $_.Arn }
        Write-Host "Reusing layers:" -ForegroundColor Yellow
        $LAYER_ARNS | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    }
} else {
    Write-Host "surface-targets Lambda not found by common names." -ForegroundColor Yellow
    Write-Host "Searching all functions for pymatgen layer..." -ForegroundColor Yellow

    $allFunctions = aws lambda list-functions --region $Region --query "Functions[*].FunctionName" --output json | ConvertFrom-Json
    foreach ($fn in $allFunctions) {
        $cfg = aws lambda get-function-configuration --function-name $fn --region $Region 2>$null | ConvertFrom-Json
        if ($cfg.Layers) {
            $pyLayers = $cfg.Layers | Where-Object { $_.Arn -match "pymatgen|ase|scipy|materials" }
            if ($pyLayers) {
                $LAYER_ARNS = $cfg.Layers | ForEach-Object { $_.Arn }
                Write-Host "Found pymatgen layer(s) on function: $fn" -ForegroundColor Yellow
                break
            }
        }
    }
}

if (-not $LAYER_ARNS) {
    Write-Host ""
    Write-Host "No pymatgen layer found automatically." -ForegroundColor Red
    Write-Host "Please paste the Layer ARN(s) of your pymatgen/ASE layer." -ForegroundColor Yellow
    Write-Host "(Find it in AWS Console > Lambda > Layers, or from your surface-targets function)" -ForegroundColor Gray
    $input = Read-Host "Layer ARN (leave blank to skip and deploy without layer)"
    if ($input) { $LAYER_ARNS = @($input) }
}

Write-Host "[1/5] Layer resolution complete!" -ForegroundColor Green

# ── Step 2: Create deployment package (just the .py file — deps come from layer) ─
Write-Host "`n[2/5] Creating deployment package..." -ForegroundColor Green

$pkgDir = "zsl_package"
if (Test-Path $pkgDir) { Remove-Item $pkgDir -Recurse -Force }
New-Item -ItemType Directory -Path $pkgDir | Out-Null
Copy-Item "zsl_matcher.py" -Destination "$pkgDir/"

$zipFile = "zsl_matcher.zip"
if (Test-Path $zipFile) { Remove-Item $zipFile }
Compress-Archive -Path "$pkgDir\*" -DestinationPath $zipFile
Write-Host "[2/5] Package created: $zipFile" -ForegroundColor Green

# ── Step 3: Create / update Lambda function ───────────────────────────────────
Write-Host "`n[3/5] Deploying Lambda function '$FunctionName'..." -ForegroundColor Green

$RoleArn = "arn:aws:iam::${ACCOUNT_ID}:role/MatrixOptimizerLambdaRole"

$existingFn = aws lambda get-function --function-name $FunctionName --region $Region 2>$null | ConvertFrom-Json

if ($existingFn) {
    Write-Host "Updating existing function..." -ForegroundColor Yellow
    aws lambda update-function-code `
        --function-name $FunctionName `
        --zip-file "fileb://$zipFile" `
        --region $Region | Out-Null

    # Update layers if found
    if ($LAYER_ARNS) {
        aws lambda update-function-configuration `
            --function-name $FunctionName `
            --layers $LAYER_ARNS `
            --timeout 60 `
            --memory-size 1024 `
            --region $Region | Out-Null
    }
} else {
    Write-Host "Creating new function..." -ForegroundColor Yellow

    $createArgs = @(
        "--function-name", $FunctionName,
        "--runtime", "python3.11",
        "--role", $RoleArn,
        "--handler", $HandlerName,
        "--zip-file", "fileb://$zipFile",
        "--timeout", "60",
        "--memory-size", "1024",
        "--region", $Region
    )
    if ($LAYER_ARNS) {
        $createArgs += "--layers"
        $createArgs += $LAYER_ARNS
    }
    aws lambda create-function @createArgs | Out-Null
}

# Wait for function to be Active
Write-Host "Waiting for function to be Active..." -ForegroundColor Yellow
for ($i = 0; $i -lt 12; $i++) {
    Start-Sleep -Seconds 5
    $state = aws lambda get-function --function-name $FunctionName `
        --region $Region --query "Configuration.State" --output text
    if ($state -eq "Active") { break }
    Write-Host "  State: $state" -ForegroundColor Gray
}

Write-Host "[3/5] Lambda deployed!" -ForegroundColor Green

# ── Step 4: Add route to existing API Gateway ─────────────────────────────────
Write-Host "`n[4/5] Adding route '$RoutePath' to API Gateway $ApiId..." -ForegroundColor Green

$lambdaArn = "arn:aws:lambda:${Region}:${ACCOUNT_ID}:function:${FunctionName}"

# Check if integration already exists
$existingIntegrations = aws apigatewayv2 get-integrations `
    --api-id $ApiId --region $Region `
    --query "Items[?IntegrationUri=='$lambdaArn'].IntegrationId" --output text

if ($existingIntegrations) {
    $INTEGRATION_ID = $existingIntegrations
    Write-Host "Reusing existing integration: $INTEGRATION_ID" -ForegroundColor Yellow
} else {
    $INTEGRATION_ID = aws apigatewayv2 create-integration `
        --api-id $ApiId `
        --integration-type AWS_PROXY `
        --integration-uri $lambdaArn `
        --payload-format-version 2.0 `
        --region $Region `
        --query IntegrationId --output text
    Write-Host "Created integration: $INTEGRATION_ID" -ForegroundColor Yellow
}

# Check if route exists
$existingRoute = aws apigatewayv2 get-routes `
    --api-id $ApiId --region $Region `
    --query "Items[?RouteKey=='$RoutePath'].RouteId" --output text

if (-not $existingRoute) {
    aws apigatewayv2 create-route `
        --api-id $ApiId `
        --route-key $RoutePath `
        --target "integrations/$INTEGRATION_ID" `
        --region $Region | Out-Null
    Write-Host "Route created: $RoutePath" -ForegroundColor Yellow
} else {
    Write-Host "Route already exists." -ForegroundColor Yellow
}

# Grant API Gateway permission to invoke the Lambda
try {
    aws lambda add-permission `
        --function-name $FunctionName `
        --statement-id "apigateway-zsl-$(Get-Random)" `
        --action lambda:InvokeFunction `
        --principal apigateway.amazonaws.com `
        --source-arn "arn:aws:execute-api:${Region}:${ACCOUNT_ID}:${ApiId}/*/*" `
        --region $Region 2>$null | Out-Null
} catch { }

Write-Host "[4/5] API Gateway updated!" -ForegroundColor Green

# ── Step 5: Output endpoint and wire .env.local ───────────────────────────────
Write-Host "`n[5/5] Finalizing..." -ForegroundColor Green

$API_BASE = aws apigatewayv2 get-api --api-id $ApiId --region $Region `
    --query ApiEndpoint --output text
$ZSL_ENDPOINT = "${API_BASE}/prod/zsl-match"

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host "`nZSL Endpoint: $ZSL_ENDPOINT" -ForegroundColor Cyan

# Add to .env.local in project root
$envPath = Join-Path (Split-Path $PSScriptRoot) ".env.local"
$envContent = Get-Content $envPath -Raw -ErrorAction SilentlyContinue
if ($envContent -match "VITE_ZSL_API") {
    $envContent = $envContent -replace "VITE_ZSL_API=.*", "VITE_ZSL_API=$ZSL_ENDPOINT"
} else {
    $envContent += "`nVITE_ZSL_API=$ZSL_ENDPOINT"
}
$envContent | Out-File -FilePath $envPath -Encoding utf8 -NoNewline
Write-Host "VITE_ZSL_API written to .env.local" -ForegroundColor Green

# Quick smoke test
Write-Host "`nSmoke test (hBN on Pt(111))..." -ForegroundColor Yellow
$testBody = '{"substrate_a":2.77,"substrate_b":2.77,"substrate_gamma":120,"film_a":2.50,"film_b":2.50,"film_gamma":120,"max_mismatch":0.05,"top_k":3}'
try {
    $resp = Invoke-RestMethod -Uri $ZSL_ENDPOINT -Method POST `
        -ContentType "application/json" -Body $testBody -TimeoutSec 90
    if ($resp.success) {
        Write-Host "OK — $($resp.total_candidates) candidates, $($resp.matches.Count) matches returned." -ForegroundColor Green
    } else {
        Write-Host "Lambda returned error: $($resp.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "Smoke test failed: $_" -ForegroundColor Red
    Write-Host "Check logs: aws logs tail /aws/lambda/$FunctionName --follow" -ForegroundColor Yellow
}

# Cleanup
Remove-Item $pkgDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`nNext: npm run dev and test the ZSL mode in the Matrix Optimizer." -ForegroundColor Yellow
