@echo off
REM Deploy DFT Advice Lambda Function
REM Prerequisites: AWS CLI and AWS SAM CLI installed and configured

echo ==========================================
echo  DFT Advice Lambda Deployment Script
echo ==========================================
echo.

REM Check if SAM CLI is installed
where sam >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: AWS SAM CLI is not installed.
    echo Install it from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
    exit /b 1
)

REM Prompt for API keys
set /p PERPLEXITY_KEY="Enter your Perplexity API Key: "
set /p DEEPSEEK_KEY="Enter your DeepSeek API Key: "

echo.
echo Building the Lambda package...
sam build --template dft_advice_template.yaml

echo.
echo Deploying to AWS...
sam deploy --guided --parameter-overrides PerplexityApiKey=%PERPLEXITY_KEY% DeepSeekApiKey=%DEEPSEEK_KEY%

echo.
echo ==========================================
echo  Deployment Complete!
echo ==========================================
echo.
echo Update the API endpoint in your QEParser.tsx if the URL changed.
pause
