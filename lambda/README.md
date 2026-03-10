# Matrix Optimizer - AWS Lambda Deployment

## Quick Start

Run the automated deployment script:

```powershell
cd lambda
.\deploy.ps1
```

The script will:
1. ✅ Create IAM role for Lambda execution
2. ✅ Package the Python function with NumPy dependencies
3. ✅ Deploy Lambda function to AWS
4. ✅ Create API Gateway HTTP API with CORS enabled
5. ✅ Configure permissions
6. ✅ **Automatically save the API endpoint to `.env` file**

## What Gets Deployed

### Lambda Function
- **Name**: `MatrixOptimizerFunction`
- **Runtime**: Python 3.9
- **Memory**: 512 MB
- **Timeout**: 30 seconds
- **Handler**: `matrix_optimizer.lambda_handler`

### API Gateway
- **Type**: HTTP API (cheaper than REST API)
- **CORS**: Enabled for `https://mah-mood.live` and `http://localhost:*`
- **Method**: POST
- **Route**: `/optimize`

### Cost Estimate
- **Monthly invocations**: ~1000 (typical personal use)
- **Compute cost**: $0 (covered by free tier 1M requests/month)
- **Data transfer**: $0 (under 1GB)
- **Your $100 credit**: Will last 3-4 years at this usage

## Testing

After deployment, test the API:

```powershell
curl -X POST https://your-api-id.execute-api.us-east-1.amazonaws.com/optimize `
  -H "Content-Type: application/json" `
  -d '{
    "target_a": 22.0,
    "target_b": 22.0,
    "target_gamma": 80.0,
    "max_val": 12
  }'
```

Expected response:
```json
{
  "success": true,
  "results": [
    {
      "matrix": [[7, 0, 0], [0, 7, 0], [0, 0, 1]],
      "lattice_a": 21.98,
      "lattice_b": 22.03,
      "lattice_c": 5.24,
      "alpha": 90.0,
      "beta": 90.0,
      "gamma": 79.8,
      "num_atoms": 98,
      "score": 0.024
    }
  ]
}
```

## Frontend Integration

The deployment script automatically creates a `.env` file with:

```env
REACT_APP_MATRIX_API=https://your-api-id.execute-api.us-east-1.amazonaws.com/optimize
```

The `MatrixOptimizer.tsx` component will automatically:
- Use the real API when `REACT_APP_MATRIX_API` is set
- Fall back to demo mode if the environment variable is not set

## Monitoring

View Lambda logs in AWS CloudWatch:

```powershell
aws logs tail /aws/lambda/MatrixOptimizerFunction --follow
```

Check invocation count:

```powershell
aws cloudwatch get-metric-statistics `
  --namespace AWS/Lambda `
  --metric-name Invocations `
  --dimensions Name=FunctionName,Value=MatrixOptimizerFunction `
  --statistics Sum `
  --start-time (Get-Date).AddDays(-7).ToString("yyyy-MM-ddTHH:mm:ss") `
  --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") `
  --period 86400
```

## Cleanup (if needed)

To remove all resources:

```powershell
# Delete API Gateway
aws apigatewayv2 delete-api --api-id YOUR_API_ID

# Delete Lambda function
aws lambda delete-function --function-name MatrixOptimizerFunction

# Detach policy from role
aws iam detach-role-policy --role-name MatrixOptimizerLambdaRole --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Delete IAM role
aws iam delete-role --role-name MatrixOptimizerLambdaRole
```

## Troubleshooting

### Error: "The security token included in the request is invalid"
**Solution**: Configure AWS credentials:
```powershell
aws configure
```

### Error: "Role is not fully propagated"
**Solution**: Wait 10-15 seconds and run the script again. IAM roles take time to propagate.

### Error: "Could not find layer"
**Solution**: The script uses a pre-built NumPy layer. If it's unavailable, you'll need to build a custom layer.

### Frontend shows demo mode instead of real results
**Solution**: 
1. Check `.env` file exists with `REACT_APP_MATRIX_API`
2. Rebuild the frontend: `npm run build`
3. For local dev: `npm run dev`

### API returns CORS error
**Solution**: The API Gateway is configured for `https://mah-mood.live`. If testing from a different domain:
```powershell
aws apigatewayv2 update-api --api-id YOUR_API_ID --cors-configuration AllowOrigins="https://mah-mood.live","https://yourdomain.com"
```

## Files

- `matrix_optimizer.py` - Lambda function code
- `requirements.txt` - Python dependencies (NumPy)
- `deploy.ps1` - Automated deployment script
- `DEPLOYMENT.md` - Detailed manual deployment guide
- `README.md` - This file

## Direct Interface Workflow Deploy

For the pt881-style direct workflow (build substrate + match hBN in one call), deploy:

```powershell
cd lambda
.\deploy_interface_match.ps1
```

This deploys `interface_matcher.py` and writes `VITE_INTERFACE_MATCH_API` to `.env.local`.
