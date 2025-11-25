import Anthropic from '@anthropic-ai/sdk';
import type { Intent } from '../types';

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true, // Only for prototyping - move to backend in production
});

const model = 'claude-sonnet-4-5-20250929';

const INTENT_DETECTION_TOOLS = [
  {
    name: 'detect_intent',
    description: 'Detect user intent and extract relevant entities from their message',
    input_schema: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: ['add_task', 'list_tasks', 'complete_task', 'none'],
          description: 'The detected intent from the user message',
        },
        confidence: {
          type: 'number',
          description: 'Confidence score between 0 and 1',
        },
        entities: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Task title (for add_task)',
            },
            dueDate: {
              type: 'string',
              description: 'Due date in natural language (for add_task)',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Task priority (for add_task)',
            },
            filter: {
              type: 'string',
              enum: ['all', 'completed', 'pending'],
              description: 'Task filter (for list_tasks)',
            },
            taskIdentifier: {
              type: 'string',
              description: 'Task identifier - title or partial title (for complete_task)',
            },
          },
        },
      },
      required: ['intent', 'confidence', 'entities'],
    },
  },
];

export async function detectIntent(userMessage: string, conversationHistory: string[]): Promise<Intent | null> {
  try {
    const context = conversationHistory.length > 0
      ? `Previous conversation:\n${conversationHistory.join('\n')}\n\n`
      : '';

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      tools: INTENT_DETECTION_TOOLS,
      messages: [
        {
          role: 'user',
          content: `${context}Analyze this user message and detect their intent for a task management system.

User message: "${userMessage}"

Detect if they want to:
- add_task: Create a new task (extract title, optional due date, optional priority)
- list_tasks: View their tasks (extract optional filter: all/completed/pending)
- complete_task: Mark a task as done (extract task identifier)
- none: Not related to task management

Provide a confidence score. Only return confidence > 0.7 if you're reasonably sure.`,
        },
      ],
    });

    // Find tool use in response
    const toolUse = response.content.find((block) => block.type === 'tool_use');

    if (!toolUse || toolUse.type !== 'tool_use') {
      return null;
    }

    const { intent, confidence, entities } = toolUse.input as {
      intent: string;
      confidence: number;
      entities: Record<string, unknown>;
    };

    // Only return intent if confidence is high enough
    if (confidence < 0.7 || intent === 'none') {
      return null;
    }

    return {
      name: intent,
      confidence,
      entities,
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
