# Deploy Interface Matcher Lambda and wire API Gateway route.
# Run from lambda directory: .\deploy_interface_match.ps1

param(
    [string]$Region = "us-east-1",
    [string]$ApiId = "oy34w61rc6"
)

$FunctionName = "interface-matcher"
$HandlerName = "interface_matcher.lambda_handler"
$RoutePath = "POST /interface-match"
$SourceFiles = @("interface_matcher.py", "direct_interface_workflow.py", "local_zsl.py")
$BundleDonors = @("surface-targets", "zsl-matcher")

function Require-Success {
    param(
        [string]$Message
    )
    if ($LASTEXITCODE -ne 0) {
        throw $Message
    }
}

function Resolve-DeploymentBucket {
    param(
        [string]$AccountId,
        [string]$AwsRegion
    )

    $candidates = @(
        "lambda-deploys-${AccountId}-${AwsRegion}",
        "mahmood-lambda-deployments"
    )

    foreach ($bucket in $candidates) {
        aws s3api head-bucket --bucket $bucket 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            return $bucket
        }
    }

    throw "Could not find an S3 deployment bucket."
}

function Add-OrReplace-ZipEntry {
    param(
        [string]$ZipPath,
        [string]$SourcePath,
        [string]$EntryName
    )

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $mode = [System.IO.Compression.ZipArchiveMode]::Update
    $zip = [System.IO.Compression.ZipFile]::Open($ZipPath, $mode)
    try {
        $existing = $zip.GetEntry($EntryName)
        if ($existing) {
            $existing.Delete()
        }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $SourcePath, $EntryName) | Out-Null
    }
    finally {
        $zip.Dispose()
    }
}

function Build-DeploymentPackage {
    param(
        [string]$WorkingDir,
        [string[]]$FilesToInclude,
        [string[]]$DonorFunctions,
        [string]$AwsRegion
    )

    $bundleZip = Join-Path $WorkingDir "interface_matcher_bundle.zip"

    foreach ($donor in $DonorFunctions) {
        aws lambda get-function --function-name $donor --region $AwsRegion --query "Code.Location" --output text 2>$null | Set-Content (Join-Path $WorkingDir "donor_url.txt")
        if ($LASTEXITCODE -ne 0) {
            continue
        }

        $codeUrl = (Get-Content (Join-Path $WorkingDir "donor_url.txt") -Raw).Trim()
        if (-not $codeUrl) {
            continue
        }

        $baseZip = Join-Path $WorkingDir "${donor}.zip"
        Invoke-WebRequest -Uri $codeUrl -OutFile $baseZip
        Copy-Item $baseZip $bundleZip -Force

        foreach ($file in $FilesToInclude) {
            Add-OrReplace-ZipEntry -ZipPath $bundleZip -SourcePath (Join-Path $PSScriptRoot $file) -EntryName $file
        }

        Write-Host "Using dependency bundle from $donor" -ForegroundColor Yellow
        return $bundleZip
    }

    $packageDir = Join-Path $WorkingDir "package"
    New-Item -ItemType Directory -Path $packageDir -Force | Out-Null
    foreach ($file in $FilesToInclude) {
        Copy-Item (Join-Path $PSScriptRoot $file) -Destination $packageDir -Force
    }
    Compress-Archive -Path (Join-Path $packageDir "*") -DestinationPath $bundleZip -Force
    Write-Host "No donor bundle found; packaging source files only." -ForegroundColor Yellow
    return $bundleZip
}

function Update-LambdaCode {
    param(
        [string]$ZipPath,
        [string]$Function,
        [string]$AccountId,
        [string]$AwsRegion
    )

    $zipSize = (Get-Item $ZipPath).Length
    $directUploadLimit = 50MB

    if ($zipSize -lt $directUploadLimit) {
        aws lambda update-function-code --function-name $Function --zip-file ("fileb://$ZipPath") --region $AwsRegion | Out-Null
        Require-Success "Lambda code upload failed."
        return
    }

    $bucket = Resolve-DeploymentBucket -AccountId $AccountId -AwsRegion $AwsRegion
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $key = "interface-matcher/interface_matcher_${timestamp}.zip"

    aws s3 cp $ZipPath ("s3://$bucket/$key") --region $AwsRegion | Out-Null
    Require-Success "Failed to upload deployment bundle to S3."

    aws lambda update-function-code `
        --function-name $Function `
        --s3-bucket $bucket `
        --s3-key $key `
        --region $AwsRegion | Out-Null
    Require-Success "Lambda S3 code update failed."
}

Write-Host "Interface Matcher - Lambda Deployment" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

try { aws --version | Out-Null } catch {
    Write-Host "ERROR: AWS CLI not installed." -ForegroundColor Red
    exit 1
}

try { aws sts get-caller-identity | Out-Null } catch {
    Write-Host "ERROR: AWS not configured. Run aws configure." -ForegroundColor Red
    exit 1
}

$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
Require-Success "Unable to resolve AWS account."
Write-Host "Account: $ACCOUNT_ID | Region: $Region" -ForegroundColor Gray

$workDir = Join-Path $env:TEMP ("interface_matcher_deploy_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
New-Item -ItemType Directory -Path $workDir -Force | Out-Null

Write-Host "`n[1/5] Building deployment package..." -ForegroundColor Green
$zipFile = Build-DeploymentPackage -WorkingDir $workDir -FilesToInclude $SourceFiles -DonorFunctions $BundleDonors -AwsRegion $Region
Write-Host "[1/5] Package ready: $zipFile" -ForegroundColor Green

Write-Host "`n[2/5] Deploying Lambda function $FunctionName..." -ForegroundColor Green
$RoleArn = "arn:aws:iam::${ACCOUNT_ID}:role/MatrixOptimizerLambdaRole"
$existing = aws lambda get-function --function-name $FunctionName --region $Region 2>$null | ConvertFrom-Json

if ($existing) {
    Write-Host "Updating existing function..." -ForegroundColor Yellow
    Update-LambdaCode -ZipPath $zipFile -Function $FunctionName -AccountId $ACCOUNT_ID -AwsRegion $Region
    aws lambda update-function-configuration `
        --function-name $FunctionName `
        --handler $HandlerName `
        --timeout 120 `
        --memory-size 1536 `
        --region $Region | Out-Null
    Require-Success "Lambda configuration update failed."
}
else {
    Write-Host "Creating new function..." -ForegroundColor Yellow
    Update-LambdaCode -ZipPath $zipFile -Function $FunctionName -AccountId $ACCOUNT_ID -AwsRegion $Region
    aws lambda create-function `
        --function-name $FunctionName `
        --runtime python3.11 `
        --role $RoleArn `
        --handler $HandlerName `
        --zip-file ("fileb://$zipFile") `
        --timeout 120 `
        --memory-size 1536 `
        --region $Region | Out-Null
    Require-Success "Lambda creation failed."
}

aws lambda wait function-updated --function-name $FunctionName --region $Region
Require-Success "Lambda did not finish updating."
Write-Host "[2/5] Lambda ready." -ForegroundColor Green

Write-Host "`n[3/5] Wiring API Gateway route $RoutePath..." -ForegroundColor Green
$lambdaArn = "arn:aws:lambda:${Region}:${ACCOUNT_ID}:function:${FunctionName}"

$integrationId = aws apigatewayv2 get-integrations `
    --api-id $ApiId --region $Region `
    --query "Items[?IntegrationUri=='$lambdaArn'].IntegrationId" --output text
Require-Success "Failed to query API Gateway integrations."

if (-not $integrationId) {
    $integrationId = aws apigatewayv2 create-integration `
        --api-id $ApiId `
        --integration-type AWS_PROXY `
        --integration-uri $lambdaArn `
        --payload-format-version 2.0 `
        --region $Region `
        --query IntegrationId --output text
    Require-Success "Failed to create API Gateway integration."
    Write-Host "Created integration: $integrationId" -ForegroundColor Yellow
}
else {
    Write-Host "Reusing integration: $integrationId" -ForegroundColor Yellow
}

$routeId = aws apigatewayv2 get-routes `
    --api-id $ApiId --region $Region `
    --query "Items[?RouteKey=='$RoutePath'].RouteId" --output text
Require-Success "Failed to query API Gateway routes."

if (-not $routeId) {
    aws apigatewayv2 create-route `
        --api-id $ApiId `
        --route-key $RoutePath `
        --target "integrations/$integrationId" `
        --region $Region | Out-Null
    Require-Success "Failed to create API Gateway route."
    Write-Host "Created route: $RoutePath" -ForegroundColor Yellow
}
else {
    aws apigatewayv2 update-route `
        --api-id $ApiId `
        --route-id $routeId `
        --target "integrations/$integrationId" `
        --region $Region | Out-Null
    Require-Success "Failed to update API Gateway route."
    Write-Host "Updated route: $RoutePath" -ForegroundColor Yellow
}

try {
    aws lambda add-permission `
        --function-name $FunctionName `
        --statement-id "apigw-interface-$(Get-Random)" `
        --action lambda:InvokeFunction `
        --principal apigateway.amazonaws.com `
        --source-arn "arn:aws:execute-api:${Region}:${ACCOUNT_ID}:${ApiId}/*/*" `
        --region $Region 2>$null | Out-Null
} catch { }

Write-Host "[3/5] API Gateway updated." -ForegroundColor Green

Write-Host "`n[4/5] Writing endpoint to .env.local..." -ForegroundColor Green
$apiBase = aws apigatewayv2 get-api --api-id $ApiId --region $Region --query ApiEndpoint --output text
Require-Success "Failed to resolve API endpoint."
$endpoint = "${apiBase}/prod/interface-match"

$envPath = Join-Path (Split-Path $PSScriptRoot) ".env.local"
$envContent = Get-Content $envPath -Raw -ErrorAction SilentlyContinue
if ($envContent -match "VITE_INTERFACE_MATCH_API") {
    $envContent = $envContent -replace "VITE_INTERFACE_MATCH_API=.*", "VITE_INTERFACE_MATCH_API=$endpoint"
}
else {
    if ($envContent.Length -gt 0 -and -not $envContent.EndsWith("`n")) {
        $envContent += "`n"
    }
    $envContent += "VITE_INTERFACE_MATCH_API=$endpoint"
}
$envContent | Out-File -FilePath $envPath -Encoding utf8 -NoNewline

Write-Host "[4/5] Endpoint synced to .env.local." -ForegroundColor Green

Write-Host "`n[5/5] Deployment complete." -ForegroundColor Green
Write-Host "Endpoint: $endpoint" -ForegroundColor Cyan
