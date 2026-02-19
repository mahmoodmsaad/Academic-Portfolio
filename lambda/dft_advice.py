import json
import os
import urllib.request
import urllib.error

def lambda_handler(event, context):
    """
    Lambda function to get comprehensive DFT recommendations from AI providers.
    Supports Perplexity AI and DeepSeek with extended token limits for detailed responses.
    """

    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    }

    # Handle preflight OPTIONS request
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': ''
        }

    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        prompt = body.get('prompt', '')
        provider = body.get('provider', 'perplexity')

        if not prompt:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Prompt is required'})
            }

        # Get API keys from environment variables
        perplexity_key = os.environ.get('PERPLEXITY_API_KEY')
        deepseek_key = os.environ.get('DEEPSEEK_API_KEY')

        if provider == 'perplexity':
            if not perplexity_key:
                return {
                    'statusCode': 500,
                    'headers': headers,
                    'body': json.dumps({'error': 'Perplexity API key not configured'})
                }
            content = call_perplexity(prompt, perplexity_key)
        elif provider == 'deepseek':
            if not deepseek_key:
                return {
                    'statusCode': 500,
                    'headers': headers,
                    'body': json.dumps({'error': 'DeepSeek API key not configured'})
                }
            content = call_deepseek(prompt, deepseek_key)
        else:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': f'Unknown provider: {provider}'})
            }

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'content': content})
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)})
        }


def call_perplexity(prompt: str, api_key: str) -> str:
    """
    Call Perplexity AI API with extended token limit for comprehensive responses.
    Uses sonar-pro model for best quality research-grade output.
    """
    url = 'https://api.perplexity.ai/chat/completions'

    payload = {
        'model': 'sonar-pro',  # Best model for detailed research
        'messages': [
            {
                'role': 'system',
                'content': '''You are an expert computational materials scientist with deep expertise in Density Functional Theory (DFT) calculations using Quantum ESPRESSO.

Your responses must be:
- COMPREHENSIVE and DETAILED - never summarize or abbreviate
- Include specific numerical values with scientific justification
- Reference literature values and best practices where applicable
- Provide step-by-step guidance suitable for research-grade calculations
- Include convergence testing strategies
- Mention common pitfalls and how to avoid them

Format your response with clear headers and organized sections. Use markdown formatting for readability.'''
            },
            {
                'role': 'user',
                'content': prompt
            }
        ],
        'max_tokens': 4000,  # Reduced to stay within API Gateway 29s timeout
        'temperature': 0.3,  # Lower temperature for more precise technical content
        'top_p': 0.9,
        'return_citations': True,
        'search_domain_filter': [
            'quantum-espresso.org',
            'materialscloud.org',
            'arxiv.org',
            'nature.com',
            'aps.org',
            'sciencedirect.com'
        ],
        'search_recency_filter': 'month',
        'frequency_penalty': 0.1
        # Note: Perplexity API does not support both presence_penalty and frequency_penalty
    }

    data = json.dumps(payload).encode('utf-8')

    req = urllib.request.Request(
        url,
        data=data,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        },
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=28) as response:
            result = json.loads(response.read().decode('utf-8'))
            content = result['choices'][0]['message']['content']

            # Append citations if available
            if 'citations' in result and result['citations']:
                content += '\n\n---\n**References:**\n'
                for i, citation in enumerate(result['citations'], 1):
                    content += f'{i}. {citation}\n'

            return content
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        raise Exception(f'Perplexity API error: {e.code} - {error_body}')
    except urllib.error.URLError as e:
        raise Exception(f'Network error calling Perplexity: {str(e)}')


def call_deepseek(prompt: str, api_key: str) -> str:
    """
    Call DeepSeek API with extended token limit for comprehensive responses.
    Uses deepseek-chat model with research-focused system prompt.
    """
    url = 'https://api.deepseek.com/chat/completions'

    payload = {
        'model': 'deepseek-chat',
        'messages': [
            {
                'role': 'system',
                'content': '''You are an expert computational materials scientist with deep expertise in Density Functional Theory (DFT) calculations using Quantum ESPRESSO. You have extensive knowledge of:

- Pseudopotential libraries (SSSP, PseudoDojo, QE standard)
- K-point sampling strategies for different material types
- Cutoff energy optimization
- XC functionals and their applicability
- DFT+U corrections for correlated systems
- Spin-orbit coupling for heavy elements
- Van der Waals corrections
- Convergence parameters and troubleshooting

Your responses must be:
- COMPREHENSIVE and DETAILED - never summarize or abbreviate
- Include specific numerical values (e.g., "ecutwfc = 60 Ry" not just "high cutoff")
- Provide scientific justification for each recommendation
- Include convergence testing protocols with specific values to test
- Reference literature U values, cutoffs from pseudopotential libraries
- Discuss trade-offs between accuracy and computational cost
- Mention common pitfalls specific to the elements/system type

Format your response with clear markdown headers and organized sections. Be thorough - this is for research-grade DFT calculations where details matter.'''
            },
            {
                'role': 'user',
                'content': prompt
            }
        ],
        'max_tokens': 4000,  # Reduced to stay within API Gateway 29s timeout
        'temperature': 0.3,  # Lower for technical precision
        'stream': False
    }

    data = json.dumps(payload).encode('utf-8')

    req = urllib.request.Request(
        url,
        data=data,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        },
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=28) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result['choices'][0]['message']['content']
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        raise Exception(f'DeepSeek API error: {e.code} - {error_body}')
    except urllib.error.URLError as e:
        raise Exception(f'Network error calling DeepSeek: {str(e)}')
