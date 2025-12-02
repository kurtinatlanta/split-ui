import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import { BedrockBearerClient } from './bedrock-bearer-auth.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize providers based on configuration
// Backend uses BACKEND_PROVIDER (or falls back to checking which credentials exist)
let provider = process.env.BACKEND_PROVIDER;

// Auto-detect provider if not explicitly set
if (!provider) {
  if (process.env.AWS_BEARER_TOKEN_BEDROCK) {
    provider = 'bedrock-bearer';
  } else if (process.env.VITE_AWS_ACCESS_KEY_ID && process.env.VITE_AWS_SECRET_ACCESS_KEY) {
    provider = 'bedrock';
  } else if (process.env.VITE_ANTHROPIC_API_KEY) {
    provider = 'anthropic';
  } else {
    console.error('No API credentials found. Set one of:');
    console.error('  - AWS_BEARER_TOKEN_BEDROCK (for Bedrock API Keys)');
    console.error('  - VITE_AWS_ACCESS_KEY_ID + VITE_AWS_SECRET_ACCESS_KEY (for Bedrock with IAM)');
    console.error('  - VITE_ANTHROPIC_API_KEY (for Anthropic Direct)');
    process.exit(1);
  }
}

let llmClient;

if (provider === 'anthropic') {
  llmClient = new Anthropic({
    apiKey: process.env.VITE_ANTHROPIC_API_KEY,
  });
  console.log('✓ Initialized Anthropic provider');
} else if (provider === 'bedrock-bearer') {
  const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK;
  const region = process.env.VITE_AWS_REGION || 'us-east-1';
  const model = process.env.VITE_BEDROCK_MODEL || 'global.anthropic.claude-sonnet-4-5-20250929-v1:0';

  llmClient = new BedrockBearerClient(bearerToken, region, model);
  console.log('✓ Initialized Bedrock provider (Bearer Token)');
  console.log(`  Region: ${region}`);
  console.log(`  Model: ${model}`);
} else if (provider === 'bedrock') {
  llmClient = new AnthropicBedrock({
    awsAccessKey: process.env.VITE_AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.VITE_AWS_SECRET_ACCESS_KEY,
    awsSessionToken: process.env.VITE_AWS_SESSION_TOKEN,
    awsRegion: process.env.VITE_AWS_REGION || 'us-east-1',
  });
  console.log('✓ Initialized Bedrock provider (IAM Credentials)');
} else {
  console.error(`Unknown provider: ${provider}`);
  process.exit(1);
}

// Get model based on provider (bedrock-bearer already has model configured)
const model = provider === 'bedrock-bearer'
  ? process.env.VITE_BEDROCK_MODEL || 'global.anthropic.claude-sonnet-4-5-20250929-v1:0'
  : provider === 'anthropic'
  ? process.env.VITE_ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929'
  : process.env.VITE_BEDROCK_MODEL || 'anthropic.claude-sonnet-4-5-20250929-v1:0';

if (provider !== 'bedrock-bearer') {
  console.log(`Using model: ${model}`);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    provider,
    model,
    timestamp: new Date().toISOString(),
  });
});

// Detect intent endpoint
app.post('/api/detect-intent', async (req, res) => {
  try {
    const { userMessage, conversationHistory, tools } = req.body;

    if (!userMessage) {
      return res.status(400).json({ error: 'userMessage is required' });
    }

    const context = conversationHistory && conversationHistory.length > 0
      ? `Previous conversation:\n${conversationHistory.join('\n')}\n\n`
      : '';

    const response = await llmClient.messages.create({
      model,
      max_tokens: 1024,
      tools: tools || [],
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
      return res.json({ intent: null });
    }

    const { name, input } = toolUse;

    res.json({
      intent: {
        name: name,
        confidence: 1.0,
        entities: typeof input === 'object' && input !== null ? input : {},
      },
    });
  } catch (error) {
    console.error('Intent detection error:', error);
    res.status(500).json({
      error: 'Failed to detect intent',
      message: error.message,
    });
  }
});

// Generate response endpoint
app.post('/api/generate-response', async (req, res) => {
  try {
    const { userMessage, conversationHistory } = req.body;

    if (!userMessage) {
      return res.status(400).json({ error: 'userMessage is required' });
    }

    const context = conversationHistory && conversationHistory.length > 0
      ? conversationHistory.map((msg, i) => `${i % 2 === 0 ? 'User' : 'Assistant'}: ${msg}`).join('\n')
      : '';

    const response = await llmClient.messages.create({
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
    const responseText = textBlock && textBlock.type === 'text' ? textBlock.text : 'I understand.';

    res.json({ response: responseText });
  } catch (error) {
    console.error('Response generation error:', error);
    res.status(500).json({
      error: 'Failed to generate response',
      message: error.message,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 LLM Proxy Server running on http://localhost:${PORT}`);
  console.log(`📡 Provider: ${provider}`);
  console.log(`🤖 Model: ${model}\n`);
});
