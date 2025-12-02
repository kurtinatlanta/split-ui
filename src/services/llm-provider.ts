import type { Intent } from '../types';

/**
 * Interface for LLM providers (Anthropic, Bedrock, etc.)
 * All providers must implement these methods
 */
export interface LLMProvider {
  /**
   * Detect user intent from a message
   */
  detectIntent(userMessage: string, conversationHistory: string[]): Promise<Intent | null>;

  /**
   * Generate a conversational response
   */
  generateResponse(userMessage: string, conversationHistory: string[]): Promise<string>;
}
