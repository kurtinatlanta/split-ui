/**
 * Bedrock client using bearer token authentication (Bedrock API Keys)
 * This is for API Keys created in the AWS Console under Bedrock
 */
export class BedrockBearerClient {
  constructor(bearerToken, region, model) {
    this.bearerToken = bearerToken;
    this.region = region || 'us-east-1';
    this.model = model;
    this.endpoint = `https://bedrock-runtime.${this.region}.amazonaws.com`;
  }

  async invokeModel(params) {
    const url = `${this.endpoint}/model/${this.model}/invoke`;

    // Convert Anthropic SDK format to Bedrock format
    const bedrockPayload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: params.max_tokens || 1024,
      messages: params.messages,
    };

    // Add optional parameters
    if (params.system) {
      bedrockPayload.system = params.system;
    }
    if (params.tools) {
      bedrockPayload.tools = params.tools;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.bearerToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(bedrockPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bedrock API Error:', errorText);
      throw new Error(`Bedrock API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  // Wrapper to match Anthropic SDK interface
  messages = {
    create: async (params) => {
      return this.invokeModel(params);
    }
  };
}
