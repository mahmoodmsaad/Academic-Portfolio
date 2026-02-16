# DFT Advice Lambda Deployment Guide

This Lambda function provides comprehensive AI-powered DFT calculation recommendations using Perplexity AI and DeepSeek.

## Key Features

- **Extended token limit (8000 tokens)** for detailed, research-grade responses
- **90-second timeout** to allow thorough AI analysis
- **Dual provider support** (Perplexity AI and DeepSeek)
- **Optimized prompts** for computational materials science
- **Citation support** (Perplexity) with domain filtering for scientific sources

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured (`aws configure`)
3. **AWS SAM CLI** installed ([Installation Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))
4. **API Keys**:
   - Perplexity AI: Get from [perplexity.ai](https://www.perplexity.ai/)
   - DeepSeek: Get from [platform.deepseek.com](https://platform.deepseek.com/)

## Deployment Steps

### Option 1: Using SAM CLI (Recommended)

```bash
cd lambda

# Build the Lambda package
sam build --template dft_advice_template.yaml

# Deploy with guided prompts
sam deploy --guided
```

When prompted:
- Stack Name: `dft-advice-stack`
- AWS Region: Your preferred region (e.g., `us-east-1`)
- Enter your Perplexity and DeepSeek API keys when prompted
- Confirm changes and deploy

### Option 2: Manual AWS Console Deployment

1. **Create Lambda Function**:
   - Go to AWS Lambda Console
   - Create new function: `dft-advice`
   - Runtime: Python 3.11
   - Upload `dft_advice.py` as the code

2. **Configure Environment Variables**:
   ```
   PERPLEXITY_API_KEY = your_perplexity_key
   DEEPSEEK_API_KEY = your_deepseek_key
   ```

3. **Set Timeout**:
   - Configuration → General configuration → Edit
   - Set timeout to **90 seconds**

4. **Create API Gateway**:
   - Create REST API
   - Create POST method for `/dft-advice`
   - Enable CORS
   - Deploy to `prod` stage

## Update Frontend

After deployment, if your API endpoint URL changed, update it in `components/QEParser.tsx`:

```typescript
const response = await fetch('YOUR_NEW_API_ENDPOINT/dft-advice', {
```

## Testing

Test the endpoint with curl:

```bash
curl -X POST https://YOUR_API_ID.execute-api.REGION.amazonaws.com/prod/dft-advice \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test prompt for Si bulk", "provider": "perplexity"}'
```

## Cost Considerations

- **Perplexity AI**: ~$0.005 per request with sonar-pro model
- **DeepSeek**: ~$0.002 per request with deepseek-chat model
- **AWS Lambda**: Minimal (within free tier for most usage)
- **API Gateway**: Minimal (within free tier for most usage)

## Troubleshooting

### Timeout Errors
- Ensure Lambda timeout is set to 90 seconds
- Check API Gateway timeout (default 29s may need increase)

### CORS Errors
- Verify CORS is enabled on API Gateway
- Check that headers include `Access-Control-Allow-Origin: *`

### API Key Errors
- Verify environment variables are set correctly
- Check API key validity on provider dashboards
