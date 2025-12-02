import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import type { Intent } from '../types';
import { getIntentTools } from '../registry';
import type { LLMProvider } from './llm-provider';

/**
 * Bedrock Provider for Claude via AWS Bedrock
 *
 * NOTE: This requires @anthropic-ai/bedrock-sdk to be installed:
 * npm install @anthropic-ai/bedrock-sdk
 */
export class BedrockProvider implements LLMProvider {
  private client: AnthropicBedrock;
  private model: string;

  constructor(
    awsAccessKey: string,
    awsSecretKey: string,
    awsRegion: string,
    model: string,
    awsSessionToken?: string
  ) {
    this.model = model;
    this.client = new AnthropicBedrock({
      awsAccessKey,
      awsSecretKey,
      awsSessionToken,
      awsRegion,
    });
  }

  async detectIntent(userMessage: string, conversationHistory: string[]): Promise<Intent | null> {
    try {
      const context = conversationHistory.length > 0
        ? `Previous conversation:\n${conversationHistory.join('\n')}\n\n`
        : '';

      const tools = getIntentTools();

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        tools,
        messages: [
          {
            role: 'user',
            content: `${context}Analyze this user message and detect their intent for a task management system.

User message: "${userMessage}"

If the user wants to perform an action, call the appropriate tool.
If the request is ambiguous or not related to tasks, do not call any tool.`,
          },
        ],
      });

      // Find tool use in response
      const toolUse = response.content.find((block: any) => block.type === 'tool_use');

      if (!toolUse || toolUse.type !== 'tool_use') {
        return null;
      }

      const { name, input } = toolUse;

      return {
        name: name,
        confidence: 1.0, // Implicit high confidence if tool is called
        entities: typeof input === 'object' && input !== null ? input as Record<string, unknown> : {},
      };
    } catch (error) {
      console.error('Intent detection error (Bedrock):', error);
      throw error;
    }
  }

  async generateResponse(userMessage: string, conversationHistory: string[]): Promise<string> {
    try {
      const context = conversationHistory.length > 0
        ? conversationHistory.map((msg, i) => `${i % 2 === 0 ? 'User' : 'Assistant'}: ${msg}`).join('\n')
        : '';

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `${context ? context + '\n\n' : ''}User: ${userMessage}`,
          },
        ],
        system: 'You are a helpful assistant for a task management system. Keep responses concise and friendly.',
      });

      const textBlock = response.content.find((block: any) => block.type === 'text');
      return textBlock && textBlock.type === 'text' ? textBlock.text : 'I understand.';
    } catch (error) {
      console.error('Response generation error (Bedrock):', error);
      throw error;
    }
  }
}
