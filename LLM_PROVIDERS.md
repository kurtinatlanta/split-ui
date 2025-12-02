# LLM Provider Guide

This document explains the multi-provider architecture and how to work with different LLM providers.

## Architecture Overview

The application uses a **factory pattern** to support multiple LLM providers. This design allows you to switch between providers without changing your application code.

```
┌─────────────────┐
│  ChatPanel.tsx  │  ← Your components call this
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  llm-factory.ts │  ← Provider factory
└────────┬────────┘
         │
         ├──────────────────┬──────────────────┐
         ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Anthropic     │  │    Bedrock      │  │   Future        │
│   Provider      │  │    Provider     │  │   Provider      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Components

### 1. `llm-provider.ts` - Interface

Defines the contract that all providers must implement:

```typescript
interface LLMProvider {
  detectIntent(userMessage: string, conversationHistory: string[]): Promise<Intent | null>;
  generateResponse(userMessage: string, conversationHistory: string[]): Promise<string>;
}
```

### 2. `anthropic-provider.ts` - Anthropic Implementation

Uses the `@anthropic-ai/sdk` package to communicate with Anthropic's API directly.

**Features:**
- Simple API key authentication
- Immediate access to new Claude features
- Straightforward token-based pricing
- `dangerouslyAllowBrowser: true` for prototyping (move to backend for production)

### 3. `bedrock-provider.ts` - Bedrock Implementation

Uses the `@anthropic-ai/bedrock-sdk` package to communicate with Claude via AWS Bedrock.

**Features:**
- AWS credential authentication (access key, secret key, session token)
- Integration with AWS services (IAM, VPC, KMS, CloudWatch)
- Regional model endpoints
- Dynamic import to avoid errors when SDK not installed

### 4. `llm-factory.ts` - Factory

Creates and manages provider instances based on configuration. Uses a singleton pattern to reuse the same provider instance.

### 5. `llm-config.ts` - Configuration

Loads provider settings from environment variables and provides a typed configuration object.

## Using the Provider in Your Code

Components use the factory to get the configured provider:

```typescript
import { getLLMProvider } from '../services/llm-factory';

// In your component or function:
const provider = getLLMProvider();

// Use the provider methods:
const intent = await provider.detectIntent(userMessage, history);
const response = await provider.generateResponse(userMessage, history);
```

The factory returns the same provider instance (singleton), so it's efficient to call `getLLMProvider()` multiple times.

**Example from ChatPanel.tsx:**
```typescript
const provider = getLLMProvider();

// Detect intent and generate response in parallel
const [intent, response] = await Promise.all([
  provider.detectIntent(userMessage, history),
  provider.generateResponse(userMessage, history),
]);
```

## Setup Guide

### Option 1: Anthropic Direct API (Default)

**1. Install dependencies** (already done if you ran `npm install`):
```bash
# Already included in package.json
npm install @anthropic-ai/sdk
```

**2. Configure environment variables** in `.env.local`:
```bash
VITE_LLM_PROVIDER=anthropic
VITE_ANTHROPIC_API_KEY=sk-ant-xxxxx
VITE_ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
```

**3. Get your API key:**
- Visit https://console.anthropic.com/
- Create an API key
- Add credits to your account

**4. Run the app:**
```bash
npm run dev
```

### Option 2: AWS Bedrock

**1. Install the Bedrock SDK:**
```bash
npm install @anthropic-ai/bedrock-sdk
```

**2. Configure AWS credentials:**

You have several options:

**Option A - Environment variables** in `.env.local`:
```bash
VITE_LLM_PROVIDER=bedrock
VITE_AWS_ACCESS_KEY_ID=AKIA...
VITE_AWS_SECRET_ACCESS_KEY=...
VITE_AWS_REGION=us-east-1
VITE_BEDROCK_MODEL=anthropic.claude-sonnet-4-5-20250929-v1:0
```

**Option B - AWS CLI** (configure locally):
```bash
aws configure
```

**Option C - IAM Role** (for EC2/ECS):
Use instance profile or task role.

**3. Enable Claude model access in Bedrock:**
- Go to AWS Bedrock console
- Request model access for Anthropic Claude models
- Wait for approval (usually instant)

**4. Run the app:**
```bash
npm run dev
```

## Switching Between Providers

Simply change the `VITE_LLM_PROVIDER` environment variable:

```bash
# In .env.local
VITE_LLM_PROVIDER=anthropic  # or 'bedrock'
```

Restart your dev server:
```bash
npm run dev
```

## Provider Comparison

| Aspect | Anthropic Direct | AWS Bedrock |
|--------|------------------|-------------|
| **Setup Complexity** | Simple (API key) | Complex (AWS credentials, IAM) |
| **New Features** | Immediate | May have delays |
| **Pricing** | Token-based, transparent | Token + AWS infrastructure costs |
| **Rate Limits** | Per API key | Per AWS account/region |
| **Compliance** | Anthropic's policies | AWS compliance frameworks (HIPAA, etc.) |
| **Integration** | Standalone | Deep AWS integration |
| **Best For** | Quick prototyping, startups | Enterprise, existing AWS users |
| **Model Names** | `claude-sonnet-4-5-20250929` | `anthropic.claude-sonnet-4-5-20250929-v1:0` |
| **SDK Package** | `@anthropic-ai/sdk` | `@anthropic-ai/bedrock-sdk` |
| **Auth Method** | API key | AWS credentials |

## Adding a New Provider

Want to add support for another LLM provider (OpenAI, Google, etc.)? Follow these steps:

### 1. Create Provider Implementation

Create `src/services/your-provider.ts`:

```typescript
import type { Intent } from '../types';
import type { LLMProvider } from './llm-provider';

export class YourProvider implements LLMProvider {
  private client: any;
  private model: string;

  constructor(apiKey: string, model: string) {
    // Initialize your provider's client
    this.model = model;
  }

  async detectIntent(userMessage: string, conversationHistory: string[]): Promise<Intent | null> {
    // Implement intent detection using your provider's API
    // Must return Intent or null
  }

  async generateResponse(userMessage: string, conversationHistory: string[]): Promise<string> {
    // Implement response generation using your provider's API
    // Must return string
  }
}
```

### 2. Update Configuration

Add to `src/config/llm-config.ts`:

```typescript
export type ProviderType = 'anthropic' | 'bedrock' | 'your-provider';

export interface LLMConfig {
  // ... existing fields
  yourProvider?: {
    apiKey: string;
    model: string;
  };
}

export function getLLMConfig(): LLMConfig {
  return {
    // ... existing config
    yourProvider: {
      apiKey: import.meta.env.VITE_YOUR_PROVIDER_API_KEY || '',
      model: import.meta.env.VITE_YOUR_PROVIDER_MODEL || 'default-model',
    },
  };
}
```

### 3. Update Factory

Add to `src/services/llm-factory.ts`:

```typescript
import { YourProvider } from './your-provider';

export function getLLMProvider(): LLMProvider {
  // ... existing code

  switch (config.provider) {
    // ... existing cases

    case 'your-provider': {
      if (!config.yourProvider?.apiKey) {
        throw new Error('API key is required for your provider');
      }
      providerInstance = new YourProvider(
        config.yourProvider.apiKey,
        config.yourProvider.model
      );
      break;
    }
  }
}
```

### 4. Update Environment Variables

Add to `.env.example`:

```bash
# Your Provider Configuration
# VITE_YOUR_PROVIDER_API_KEY=your_api_key
# VITE_YOUR_PROVIDER_MODEL=default-model
```

### 5. Test

Set your provider in `.env.local`:
```bash
VITE_LLM_PROVIDER=your-provider
VITE_YOUR_PROVIDER_API_KEY=your_key
```

Run the app and verify everything works!

## Troubleshooting

### Error: "Failed to initialize Bedrock client"

**Solution:** Install the Bedrock SDK:
```bash
npm install @anthropic-ai/bedrock-sdk
```

### Error: "Anthropic API key is required"

**Solution:** Check your `.env.local` file:
- Ensure `VITE_ANTHROPIC_API_KEY` is set
- Restart the dev server after changing `.env.local`

### Error: "AWS credentials are required for Bedrock"

**Solution:** Ensure these are set in `.env.local`:
- `VITE_AWS_ACCESS_KEY_ID`
- `VITE_AWS_SECRET_ACCESS_KEY`
- `VITE_AWS_REGION`

### Error: "Access denied" (Bedrock)

**Solutions:**
- Check IAM permissions include `bedrock:InvokeModel`
- Verify model access is enabled in Bedrock console
- Ensure correct region is specified

### Provider not switching

**Solution:**
- Clear browser cache
- Restart dev server
- Check `VITE_LLM_PROVIDER` value in `.env.local`

## Best Practices

### Security

1. **Never commit `.env.local`** - It's in `.gitignore` for a reason
2. **Use backend proxy in production** - Don't expose API keys in browser
3. **Rotate credentials regularly** - Especially for production environments
4. **Use IAM roles** - For Bedrock in AWS environments (EC2, ECS, Lambda)

### Performance

1. **Provider is cached** - The factory reuses the same instance (singleton pattern)
2. **Consider response caching** - Add caching layer for repeated queries
3. **Monitor token usage** - Both providers charge per token
4. **Implement rate limiting** - Protect against excessive API calls

### Development

1. **Use Anthropic Direct for development** - Simpler setup, faster iteration
2. **Test with Bedrock before production** - If that's your target platform
3. **Mock providers for unit tests** - Implement a `MockProvider` for testing
4. **Add logging** - Help debug provider issues

## Future Enhancements

Possible improvements to the provider system:

- [ ] Add support for OpenAI GPT models
- [ ] Add support for Google Gemini
- [ ] Implement response caching layer
- [ ] Add provider health checks
- [ ] Create mock provider for testing
- [ ] Add provider-specific optimizations
- [ ] Support provider fallback/retry logic
- [ ] Add monitoring/observability hooks

## Questions?

The provider system is designed to be extensible. If you need help adding a new provider or have questions about the architecture, refer to the existing implementations in `src/services/`.
