/**
 * LLM Provider Configuration
 */

export type ProviderType = 'anthropic' | 'bedrock' | 'http';

export interface LLMConfig {
  provider: ProviderType;
  http?: {
    baseUrl: string;
  };
  anthropic?: {
    apiKey: string;
    model: string;
  };
  bedrock?: {
    awsAccessKey: string;
    awsSecretKey: string;
    awsSessionToken?: string;
    awsRegion: string;
    model: string;
  };
}

/**
 * Get the LLM configuration from environment variables
 */
export function getLLMConfig(): LLMConfig {
  const provider = (import.meta.env.VITE_LLM_PROVIDER || 'http') as ProviderType;

  return {
    provider,
    http: {
      baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
    },
    anthropic: {
      apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
      model: import.meta.env.VITE_ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
    },
    bedrock: {
      awsAccessKey: import.meta.env.VITE_AWS_ACCESS_KEY_ID || '',
      awsSecretKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || '',
      awsSessionToken: import.meta.env.VITE_AWS_SESSION_TOKEN,
      awsRegion: import.meta.env.VITE_AWS_REGION || 'us-east-1',
      model: import.meta.env.VITE_BEDROCK_MODEL || 'anthropic.claude-sonnet-4-5-20250929-v1:0',
    },
  };
}
