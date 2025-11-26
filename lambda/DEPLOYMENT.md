# AWS Lambda Deployment Guide for Matrix Optimizer

## Prerequisites
- AWS Account with $100 credit
- AWS CLI installed and configured
- Python 3.9+

## Step 1: Install AWS CLI (if not already installed)

```powershell
# Download and install AWS CLI for Windows
# Visit: https://aws.amazon.com/cli/
# Or use this command:
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi
```

## Step 2: Configure AWS Credentials

```powershell
aws configure
# Enter your:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region (e.g., us-east-1)
# - Default output format: json
```

## Step 3: Create Lambda Deployment Package

```powershell
# Navigate to lambda directory
cd lambda

# Create a deployment directory
mkdir package
cd package

# Install dependencies
pip install -r ../requirements.txt -t .

# Copy the Lambda function
cp ../matrix_optimizer.py .

# Create ZIP file
Compress-Archive -Path * -DestinationPath ../matrix_optimizer.zip -Force
cd ..
```

## Step 4: Create IAM Role for Lambda

```powershell
# Create trust policy file
@"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
"@ | Out-File -Encoding utf8 trust-policy.json

# Create IAM role
aws iam create-role --role-name MatrixOptimizerLambdaRole --assume-role-policy-document file://trust-policy.json

# Attach basic execution policy
aws iam attach-role-policy --role-name MatrixOptimizerLambdaRole --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

## Step 5: Create Lambda Function

```powershell
# Wait a moment for role to propagate
Start-Sleep -Seconds 10

# Get your AWS account ID
$ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)

# Create Lambda function
aws lambda create-function `
  --function-name matrix-optimizer `
  --runtime python3.9 `
  --role "arn:aws:iam::${ACCOUNT_ID}:role/MatrixOptimizerLambdaRole" `
  --handler matrix_optimizer.lambda_handler `
  --zip-file fileb://matrix_optimizer.zip `
  --timeout 30 `
  --memory-size 512
```

## Step 6: Create API Gateway

```powershell
# Create REST API
$API_ID = (aws apigatewayv2 create-api `
  --name "matrix-optimizer-api" `
  --protocol-type HTTP `
  --cors-configuration AllowOrigins="https://mah-mood.live,http://localhost:3002" `
  --query ApiId --output text)

echo "API ID: $API_ID"

# Create integration
$INTEGRATION_ID = (aws apigatewayv2 create-integration `
  --api-id $API_ID `
  --integration-type AWS_PROXY `
  --integration-uri "arn:aws:lambda:us-east-1:${ACCOUNT_ID}:function:matrix-optimizer" `
  --payload-format-version 2.0 `
  --query IntegrationId --output text)

# Create route
aws apigatewayv2 create-route `
  --api-id $API_ID `
  --route-key "POST /optimize" `
  --target "integrations/$INTEGRATION_ID"

# Create default stage
aws apigatewayv2 create-stage `
  --api-id $API_ID `
  --stage-name prod `
  --auto-deploy

# Get API endpoint
$API_ENDPOINT = (aws apigatewayv2 get-api --api-id $API_ID --query ApiEndpoint --output text)
echo "API Endpoint: ${API_ENDPOINT}/optimize"

# Give API Gateway permission to invoke Lambda
aws lambda add-permission `
  --function-name matrix-optimizer `
  --statement-id apigateway-invoke `
  --action lambda:InvokeFunction `
  --principal apigateway.amazonaws.com `
  --source-arn "arn:aws:execute-api:us-east-1:${ACCOUNT_ID}:${API_ID}/*/*/optimize"

# Save the endpoint for later
"API_ENDPOINT=${API_ENDPOINT}/optimize" | Out-File -Encoding utf8 ../api-endpoint.txt
```

## Step 7: Test the Lambda Function

```powershell
# Test directly
aws lambda invoke `
  --function-name matrix-optimizer `
  --payload '{"target_a": 22.0, "target_b": 22.0, "target_gamma": 80.0, "max_val": 12}' `
  response.json

# Check response
cat response.json

# Test via API Gateway
$API_URL = "${API_ENDPOINT}/optimize"
curl -X POST $API_URL `
  -H "Content-Type: application/json" `
  -d '{"target_a": 22.0, "target_b": 22.0, "target_gamma": 80.0, "max_val": 12}'
```

## Step 8: Update Your Website

Add the API endpoint to your MatrixOptimizer component:

```typescript
// In components/MatrixOptimizer.tsx
const API_ENDPOINT = 'YOUR_API_ENDPOINT_HERE';
```

## Cost Monitoring

```powershell
# Check Lambda invocations
aws cloudwatch get-metric-statistics `
  --namespace AWS/Lambda `
  --metric-name Invocations `
  --dimensions Name=FunctionName,Value=matrix-optimizer `
  --start-time (Get-Date).AddDays(-7).ToString("yyyy-MM-ddTHH:mm:ss") `
  --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") `
  --period 3600 `
  --statistics Sum

# Check estimated charges
aws ce get-cost-and-usage `
  --time-period Start=(Get-Date).AddDays(-30).ToString("yyyy-MM-dd"),End=(Get-Date).ToString("yyyy-MM-dd") `
  --granularity MONTHLY `
  --metrics BlendedCost
```

## Cleanup (if needed)

```powershell
# Delete API Gateway
aws apigatewayv2 delete-api --api-id $API_ID

# Delete Lambda function
aws lambda delete-function --function-name matrix-optimizer

# Delete IAM role
aws iam detach-role-policy --role-name MatrixOptimizerLambdaRole --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam delete-role --role-name MatrixOptimizerLambdaRole
```

## Troubleshooting

### Lambda timeout
```powershell
# Increase timeout to 60 seconds
aws lambda update-function-configuration `
  --function-name matrix-optimizer `
  --timeout 60
```

### Memory issues
```powershell
# Increase memory to 1024 MB
aws lambda update-function-configuration `
  --function-name matrix-optimizer `
  --memory-size 1024
```

### View logs
```powershell
# Get recent logs
aws logs tail /aws/lambda/matrix-optimizer --follow
```
