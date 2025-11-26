# Automated AWS Lambda Deployment Script for Matrix Optimizer
# Run this script from the lambda directory

Write-Host "Matrix Optimizer - AWS Lambda Deployment" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Check if AWS CLI is installed
try {
    aws --version | Out-Null
} catch {
    Write-Host "ERROR: AWS CLI not installed!" -ForegroundColor Red
    Write-Host "Download from: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

# Check if AWS is configured
try {
    aws sts get-caller-identity | Out-Null
} catch {
    Write-Host "ERROR: AWS not configured!" -ForegroundColor Red
    Write-Host "Run: aws configure" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n[1/6] Creating deployment package..." -ForegroundColor Green

# Create package directory
if (Test-Path "package") { Remove-Item "package" -Recurse -Force }
New-Item -ItemType Directory -Path "package" | Out-Null

# Install dependencies
Write-Host "Installing numpy..." -ForegroundColor Yellow
pip install numpy==1.24.3 -t package --quiet

# Copy Lambda function
Copy-Item "matrix_optimizer.py" -Destination "package/"

# Create ZIP
if (Test-Path "matrix_optimizer.zip") { Remove-Item "matrix_optimizer.zip" }
Compress-Archive -Path "package\*" -DestinationPath "matrix_optimizer.zip"

Write-Host "[1/6] Package created successfully!" -ForegroundColor Green

Write-Host "`n[2/6] Creating IAM role..." -ForegroundColor Green

# Create trust policy
$trustPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
"@
$trustPolicy | Out-File -Encoding utf8 trust-policy.json

# Create role (ignore if exists)
try {
    aws iam create-role --role-name MatrixOptimizerLambdaRole --assume-role-policy-document file://trust-policy.json 2>$null
    Write-Host "IAM role created" -ForegroundColor Yellow
} catch {
    Write-Host "IAM role already exists" -ForegroundColor Yellow
}

# Attach policy
aws iam attach-role-policy --role-name MatrixOptimizerLambdaRole --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>$null

Write-Host "[2/6] IAM role configured!" -ForegroundColor Green

Write-Host "`n[3/6] Creating Lambda function..." -ForegroundColor Green

# Get account ID
$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text

# Wait for role propagation
Start-Sleep -Seconds 5

# Create or update Lambda function
try {
    aws lambda create-function `
        --function-name matrix-optimizer `
        --runtime python3.9 `
        --role "arn:aws:iam::${ACCOUNT_ID}:role/MatrixOptimizerLambdaRole" `
        --handler matrix_optimizer.lambda_handler `
        --zip-file fileb://matrix_optimizer.zip `
        --timeout 30 `
        --memory-size 512 `
        --region us-east-1 2>$null
    
    Write-Host "Lambda function created!" -ForegroundColor Yellow
} catch {
    Write-Host "Updating existing Lambda function..." -ForegroundColor Yellow
    aws lambda update-function-code `
        --function-name matrix-optimizer `
        --zip-file fileb://matrix_optimizer.zip `
        --region us-east-1 | Out-Null
}

Write-Host "[3/6] Lambda function ready!" -ForegroundColor Green

Write-Host "`n[4/6] Creating API Gateway..." -ForegroundColor Green

# Check if API exists
$existingApi = aws apigatewayv2 get-apis --query "Items[?Name=='matrix-optimizer-api'].ApiId" --output text

if ($existingApi) {
    $API_ID = $existingApi
    Write-Host "Using existing API: $API_ID" -ForegroundColor Yellow
} else {
    # Create new API
    $API_ID = aws apigatewayv2 create-api `
        --name "matrix-optimizer-api" `
        --protocol-type HTTP `
        --cors-configuration "AllowOrigins=https://mah-mood.live,http://localhost:3002,AllowMethods=POST,OPTIONS,AllowHeaders=Content-Type" `
        --region us-east-1 `
        --query ApiId --output text
    
    Write-Host "API created: $API_ID" -ForegroundColor Yellow
    
    # Create integration
    $INTEGRATION_ID = aws apigatewayv2 create-integration `
        --api-id $API_ID `
        --integration-type AWS_PROXY `
        --integration-uri "arn:aws:lambda:us-east-1:${ACCOUNT_ID}:function:matrix-optimizer" `
        --payload-format-version 2.0 `
        --region us-east-1 `
        --query IntegrationId --output text
    
    # Create route
    aws apigatewayv2 create-route `
        --api-id $API_ID `
        --route-key "POST /optimize" `
        --target "integrations/$INTEGRATION_ID" `
        --region us-east-1 | Out-Null
    
    # Create stage
    aws apigatewayv2 create-stage `
        --api-id $API_ID `
        --stage-name prod `
        --auto-deploy `
        --region us-east-1 | Out-Null
}

Write-Host "[4/6] API Gateway configured!" -ForegroundColor Green

Write-Host "`n[5/6] Setting permissions..." -ForegroundColor Green

# Add API Gateway permission to Lambda
try {
    aws lambda add-permission `
        --function-name matrix-optimizer `
        --statement-id apigateway-invoke-$(Get-Random) `
        --action lambda:InvokeFunction `
        --principal apigateway.amazonaws.com `
        --source-arn "arn:aws:execute-api:us-east-1:${ACCOUNT_ID}:${API_ID}/*/*" `
        --region us-east-1 2>$null
} catch {
    Write-Host "Permission already exists" -ForegroundColor Yellow
}

Write-Host "[5/6] Permissions set!" -ForegroundColor Green

Write-Host "`n[6/6] Getting API endpoint..." -ForegroundColor Green

# Get API endpoint
$API_ENDPOINT = aws apigatewayv2 get-api --api-id $API_ID --region us-east-1 --query ApiEndpoint --output text
$FULL_ENDPOINT = "${API_ENDPOINT}/optimize"

# Save endpoint
"${FULL_ENDPOINT}" | Out-File -Encoding utf8 api-endpoint.txt

Write-Host "[6/6] Deployment complete!" -ForegroundColor Green

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green -BackgroundColor Black
Write-Host "=========================================" -ForegroundColor Cyan

Write-Host "`nYour API Endpoint:" -ForegroundColor Yellow
Write-Host $FULL_ENDPOINT -ForegroundColor Cyan

# Save endpoint to .env file
$ENV_PATH = Join-Path (Split-Path $PSScriptRoot) ".env"
$envContent = "# Matrix Optimizer API Configuration`nREACT_APP_MATRIX_API=$FULL_ENDPOINT"
$envContent | Out-File -FilePath $ENV_PATH -Encoding utf8
Write-Host "`n✅ API endpoint saved to .env file" -ForegroundColor Green

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. The API endpoint has been automatically saved to .env file" -ForegroundColor White
Write-Host "2. Commit and push your changes to deploy the updated website" -ForegroundColor White
Write-Host "3. Test the optimizer on your live website!" -ForegroundColor White
Write-Host "4. Test locally first: " -ForegroundColor White
Write-Host "   curl -X POST $FULL_ENDPOINT -H 'Content-Type: application/json' -d '{""target_a"": 22, ""target_b"": 22, ""target_gamma"": 80, ""max_val"": 12}'" -ForegroundColor Gray

Write-Host "`nEstimated monthly cost: $0 (covered by free tier + your $100 credit)" -ForegroundColor Green

# Cleanup
Remove-Item "package" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "trust-policy.json" -Force -ErrorAction SilentlyContinue

Write-Host "`nPress any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
