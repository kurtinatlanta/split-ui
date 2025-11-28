import Anthropic from '@anthropic-ai/sdk';
import type { Intent } from '../types';
import { getIntentTools } from '../registry';

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true, // Only for prototyping - move to backend in production
});

const model = 'claude-sonnet-4-5-20250929';

export async function detectIntent(userMessage: string, conversationHistory: string[]): Promise<Intent | null> {
  try {
    const context = conversationHistory.length > 0
      ? `Previous conversation:\n${conversationHistory.join('\n')}\n\n`
      : '';

    const tools = getIntentTools();

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      tools: tools as Anthropic.Tool[],
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
    const toolUse = response.content.find((block) => block.type === 'tool_use');

    if (!toolUse || toolUse.type !== 'tool_use') {
      return null;
    }

    const { name, input } = toolUse;

    // In the new model, the tool name IS the intent name
    // And the input contains the entities
    // We assume confidence is high if the model chose to call a tool

    return {
      name: name,
      confidence: 1.0, // Implicit high confidence if tool is called
      entities: typeof input === 'object' && input !== null ? input as Record<string, unknown> : {},
    };
  } catch (error) {
    console.error('Intent detection error:', error);
    throw error;
  }
}

export async function generateResponse(userMessage: string, conversationHistory: string[]): Promise<string> {
  try {
    const context = conversationHistory.length > 0
      ? conversationHistory.map((msg, i) => `${i % 2 === 0 ? 'User' : 'Assistant'}: ${msg}`).join('\n')
      : '';

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `${context ? context + '\n\n' : ''}User: ${userMessage}`,
        },
      ],
      system: 'You are a helpful assistant for a task management system. Keep responses concise and friendly.',
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock && textBlock.type === 'text' ? textBlock.text : 'I understand.';
  } catch (error) {
    console.error('Response generation error:', error);
    throw error;
  }
}
