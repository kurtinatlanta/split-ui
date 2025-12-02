import type { Intent } from '../types';
import type { LLMProvider } from './llm-provider';
import { getIntentTools } from '../registry';

/**
 * HTTP Provider - Makes requests to the backend proxy server
 * This is the production-ready approach that keeps API keys secure
 */
export class HttpProvider implements LLMProvider {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  async detectIntent(userMessage: string, conversationHistory: string[]): Promise<Intent | null> {
    try {
      const tools = getIntentTools();

      const response = await fetch(`${this.baseUrl}/api/detect-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage,
          conversationHistory,
          tools,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to detect intent');
      }

      const data = await response.json();
      return data.intent;
    } catch (error) {
      console.error('Intent detection error:', error);
      throw error;
    }
  }

  async generateResponse(userMessage: string, conversationHistory: string[]): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate response');
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error('Response generation error:', error);
      throw error;
    }
  }
}
