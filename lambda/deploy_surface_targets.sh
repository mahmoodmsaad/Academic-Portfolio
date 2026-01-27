#!/bin/bash
# Deploy the ASE-based surface targets Lambda function
# Prerequisites: AWS CLI configured, Docker installed (for Lambda-compatible packaging)
#
# Usage: bash deploy_surface_targets.sh
#
# This creates a Lambda function with ASE for computing surface cell parameters.
# The function uses a Docker container to ensure Lambda-compatible binaries.

set -e

FUNCTION_NAME="surface-targets"
REGION="us-east-1"
RUNTIME="python3.11"
HANDLER="surface_targets.lambda_handler"
TIMEOUT=30
MEMORY=512

echo "=== Building Lambda deployment package ==="

# Clean up
rm -rf package surface_targets.zip

# Install dependencies using Docker for Lambda-compatible binaries
docker run --rm -v "$PWD":/var/task \
  public.ecr.aws/sam/build-python3.11:latest \
  pip install -r requirements_surface.txt -t /var/task/package

# Copy function code
cp surface_targets.py package/

# Create zip
cd package
zip -r9 ../surface_targets.zip .
cd ..

echo "=== Deployment package created: surface_targets.zip ==="
echo "Size: $(du -h surface_targets.zip | cut -f1)"

# Check if function exists
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
  echo "=== Updating existing function ==="
  aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://surface_targets.zip \
    --region $REGION
else
  echo "=== Creating new function ==="
  # You may need to adjust the role ARN
  ROLE_ARN=$(aws iam list-roles --query "Roles[?contains(RoleName, 'lambda')].Arn | [0]" --output text)

  aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime $RUNTIME \
    --handler $HANDLER \
    --role "$ROLE_ARN" \
    --zip-file fileb://surface_targets.zip \
    --timeout $TIMEOUT \
    --memory-size $MEMORY \
    --region $REGION
fi

echo "=== Setting up API Gateway ==="
echo "To expose via API Gateway, run:"
echo "  1. Go to API Gateway console"
echo "  2. Create a new REST API or add to existing"
echo "  3. Create POST method pointing to '$FUNCTION_NAME' Lambda"
echo "  4. Enable CORS"
echo "  5. Deploy to a stage (e.g., 'prod')"
echo ""
echo "Or use the existing API at: https://oy34w61rc6.execute-api.us-east-1.amazonaws.com"
echo "and add a new resource '/surface-targets' pointing to this function."

# Cleanup
rm -rf package

echo "=== Done ==="
