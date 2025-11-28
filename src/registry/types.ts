import type { ComponentType } from 'react';

// JSON Schema property definition
export interface JSONSchemaProperty {
  type?: string;
  description?: string;
  enum?: string[];
  const?: string;
  [key: string]: unknown;
}

// Entity schema definition (JSON Schema object)
export interface EntitySchema {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
}

// Anthropic tool definition
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, JSONSchemaProperty>;
    required?: string[];
  };
}

export interface IntentDefinition {
  name: string;
  description: string;
  component: ComponentType;
  entities: EntitySchema;
}
