import { getLLMConfig } from '../config/llm-config';
import type { LLMProvider } from './llm-provider';
import { HttpProvider } from './http-provider';

let providerInstance: LLMProvider | null = null;

/**
 * Factory function to get the configured LLM provider
 * Singleton pattern - creates the provider once and reuses it
 */
export function getLLMProvider(): LLMProvider {
  if (providerInstance) {
    return providerInstance;
  }

  const config = getLLMConfig();

  switch (config.provider) {
    case 'http': {
      providerInstance = new HttpProvider(config.http?.baseUrl);
      break;
    }

    case 'anthropic': {
      throw new Error(
        'Direct Anthropic provider is no longer supported in the browser. Use VITE_LLM_PROVIDER=http and run the backend server with: npm run server'
      );
    }

    case 'bedrock': {
      throw new Error(
        'Direct Bedrock provider is not supported in the browser. Use VITE_LLM_PROVIDER=http and run the backend server with: npm run server'
      );
    }

    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }

  return providerInstance;
}

/**
 * Reset the provider instance (useful for testing or config changes)
 */
export function resetLLMProvider(): void {
  providerInstance = null;
}
