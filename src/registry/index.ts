import type { IntentDefinition, AnthropicTool } from './types';
import { addTask } from './intents/addTask';
import { listTasks } from './intents/listTasks';
import { completeTask } from './intents/completeTask';
import { issueBonus } from './intents/issueBonus';

const registry: Record<string, IntentDefinition> = {};

export function registerIntent(definition: IntentDefinition) {
    registry[definition.name] = definition;
}

export function getIntent(name: string): IntentDefinition | undefined {
    return registry[name];
}

export function getAllIntents(): IntentDefinition[] {
    return Object.values(registry);
}

export function getIntentTools(): AnthropicTool[] {
    return getAllIntents().map(intent => ({
        name: intent.name,
        description: intent.description,
        input_schema: {
            type: 'object',
            properties: intent.entities.properties,
            required: intent.entities.required
        }
    }));
}

// Register built-in intents
registerIntent(addTask);
registerIntent(listTasks);
registerIntent(completeTask);
registerIntent(issueBonus);
