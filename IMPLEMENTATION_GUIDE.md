# Implementation Guide: Building Intent-Driven UIs with AI

This guide explains **how to implement** the patterns described in VISION.md. It's written for experienced developers who are new to integrating AI into applications.

---

## Table of Contents

1. [Core Architecture](#core-architecture)
2. [Working with Claude API](#working-with-claude-api)
3. [Intent Detection Patterns](#intent-detection-patterns)
4. [Entity Extraction](#entity-extraction)
5. [Building Task Components](#building-task-components)
6. [State Management](#state-management)
7. [Error Handling](#error-handling)
8. [Testing Strategies](#testing-strategies)
9. [Common Pitfalls](#common-pitfalls)

---

## Core Architecture

### File Structure

```
src/
├── components/
│   ├── ChatPanel.tsx           # Left panel - conversation
│   └── RightPanel.tsx          # Right panel - dynamic UI (consumes registry)
│
├── registry/                    # Intent registry system
│   ├── types.ts                 # IntentDefinition, AnthropicTool, EntitySchema
│   ├── index.ts                 # Registry functions (registerIntent, getIntent, etc.)
│   └── intents/                 # Self-contained intent definitions
│       ├── addTask.tsx          # Task intent: add task + UI component
│       ├── listTasks.tsx        # Task intent: list tasks + UI component
│       ├── completeTask.tsx     # Task intent: complete task + UI component
│       └── issueBonus.tsx       # Compensation intent: issue bonus + UI component
│
├── services/
│   └── claude.ts               # Claude API integration (uses getIntentTools())
│
├── store/
│   └── index.ts                # Zustand store
│
├── types/
│   └── index.ts                # TypeScript interfaces (Message, Intent, Task, etc.)
│
├── App.tsx                     # Root component
└── main.tsx                    # Entry point
```

**Key Differences from Traditional Architecture:**

- **No separate `tasks/` folder**: UI components are colocated with intent definitions in `registry/intents/`
- **No hardcoded mappings**: `registry/index.ts` provides dynamic lookup functions
- **Self-contained intents**: Each intent file exports both the component AND the schema
- **Type-safe**: Full TypeScript support with proper types for tools and schemas

### Data Flow

```
User Input (Chat)
    ↓
ChatPanel → handleSubmit()
    ↓
services/claude.ts
    ├─ getIntentTools() ──────→ Generate tools from registry
    ├─ detectIntent() ────────→ Tool use API call (Claude picks intent tool)
    └─ generateResponse() ────→ Regular API call
    ↓
State Update (Zustand)
    ├─ setIntent()        # Stores { name, confidence, entities }
    ├─ setPanelMode()     # Sets 'context' first
    └─ addMessage()
    ↓
RightPanel Re-renders
    ↓
getIntent(name) → Looks up IntentDefinition from registry
    ↓
Renders <intentDef.component /> with entities from store
    ↓
Auto-switch to task-ui mode after countdown (if high confidence)
```

---

## Working with Claude API

### Basic Setup

```typescript
// services/claude.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true  // Only for prototyping!
});

const model = 'claude-sonnet-4-5-20250929';
```

**Important:** `dangerouslyAllowBrowser: true` exposes your API key. For production, move API calls to a backend.

### Tool Use (Structured Outputs)

Tool use is how you get **reliable, typed data** from the LLM instead of parsing free text.

**Registry-based tool generation:**

```typescript
// Tools are generated from registered intents
import { getIntentTools } from '../registry';

const tools = getIntentTools();
// Returns one tool per registered intent, e.g.:
// [
//   {
//     name: 'add_task',
//     description: 'Create a new task with optional due date and priority',
//     input_schema: {
//       type: 'object',
//       properties: {
//         title: { type: 'string', description: 'Task title' },
//         dueDate: { type: 'string', description: 'Due date in natural language' },
//         priority: { type: 'string', enum: ['low', 'medium', 'high'] }
//       },
//       required: ['title']
//     }
//   },
//   {
//     name: 'issue_bonus',
//     description: 'Issue a monetary bonus to an employee',
//     input_schema: {
//       type: 'object',
//       properties: {
//         employeeName: { type: 'string', description: 'Employee name' },
//         amount: { type: 'number', description: 'Bonus amount in dollars' }
//       },
//       required: ['employeeName', 'amount']
//     }
//   }
//   // ... more tools
// ]
```

**Call the API with registry-generated tools:**

```typescript
const tools = getIntentTools(); // Dynamic tool generation

const response = await client.messages.create({
  model,
  max_tokens: 1024,
  tools: tools as Anthropic.Tool[],
  messages: [
    {
      role: 'user',
      content: 'Analyze this message: "Give John a $5000 bonus"'
    }
  ]
});

// Extract the tool use from response
const toolUse = response.content.find(block => block.type === 'tool_use');

if (toolUse && toolUse.type === 'tool_use') {
  const { name, input } = toolUse;
  // → name: "issue_bonus" (the tool name IS the intent name)
  // → input: { employeeName: "John", amount: 5000 }

  // Return as Intent
  return {
    name: name,
    confidence: 1.0, // Implicit high confidence if tool was called
    entities: input
  };
}
```

### Key Insights

1. **Tool use returns JSON, not text**
   - No need to parse strings
   - Type-safe (numbers are numbers, not strings)
   - Reliable structure

2. **The schema is your contract**
   - Define what entities you need
   - Use enums for constrained values
   - Mark required vs optional

3. **Confidence scoring is critical**
   - Always extract a confidence score
   - Use thresholds (e.g., > 0.7) to filter
   - Low confidence = ask for clarification

---

## Intent Detection Patterns

### Pattern 1: Single Intent Detection

For simple cases where one message = one intent:

```typescript
export async function detectIntent(
  userMessage: string,
  conversationHistory: string[]
): Promise<Intent | null> {

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    tools: INTENT_DETECTION_TOOLS,
    messages: [
      {
        role: 'user',
        content: `Analyze this message: "${userMessage}"\n\n` +
                 `Detect the user's intent and extract relevant entities.`
      }
    ]
  });

  const toolUse = response.content.find(block => block.type === 'tool_use');

  if (!toolUse || toolUse.type !== 'tool_use') {
    return null;
  }

  const { intent, confidence, entities } = toolUse.input as {
    intent: string;
    confidence: number;
    entities: Record<string, unknown>;
  };

  // Filter by confidence threshold
  if (confidence < 0.7 || intent === 'none') {
    return null;
  }

  return { name: intent, confidence, entities };
}
```

### Pattern 2: Multi-Turn Intent Building

Sometimes intents are built over multiple messages:

```typescript
// Track partial intent across messages
interface PartialIntent {
  intent: string;
  entities: Record<string, unknown>;
  missingEntities: string[];
}

// In your state
const [partialIntent, setPartialIntent] = useState<PartialIntent | null>(null);

// When detecting intent
const intent = await detectIntent(userMessage, history);

if (intent) {
  const requiredEntities = INTENT_REGISTRY[intent.name].requiredEntities;
  const missing = requiredEntities.filter(e => !intent.entities[e]);

  if (missing.length > 0) {
    // Store partial intent
    setPartialIntent({ ...intent, missingEntities: missing });

    // Ask for first missing entity
    addMessage('assistant', `What's the ${missing[0]}?`);
  } else {
    // All entities present, show UI
    setIntent(intent);
    setPanelMode('task-ui');
  }
}
```

### Pattern 3: Context-Aware Detection

Use conversation history to improve detection:

```typescript
const context = conversationHistory.length > 0
  ? `Previous conversation:\n${conversationHistory.join('\n')}\n\n`
  : '';

const response = await client.messages.create({
  model,
  messages: [
    {
      role: 'user',
      content: `${context}Current message: "${userMessage}"\n\n` +
               `Based on the conversation context, what is the user trying to do?`
    }
  ],
  tools: INTENT_DETECTION_TOOLS
});
```

**Why this matters:**

```
Without context:
User: "Give them a raise"
→ Who is "them"? Unknown.

With context:
History: ["Show me John Doe's profile"]
User: "Give them a raise"
→ LLM infers "them" = "John Doe"
```

---

## Entity Extraction

### Schema Design

Good schema design is critical. The schema tells the LLM what to extract and how to structure it.

**Bad schema:**

```typescript
// Too vague
{
  data: { type: 'string' }  // LLM doesn't know what to extract
}
```

**Good schema:**

```typescript
{
  employeeName: {
    type: 'string',
    description: 'Full name of the employee (first and last)'
  },
  amount: {
    type: 'number',
    description: 'Dollar amount as a number (no currency symbols)'
  },
  effectiveDate: {
    type: 'string',
    description: 'Date in YYYY-MM-DD format or natural language like "next Friday"'
  }
}
```

### Handling Different Entity Types

#### Simple Strings

```typescript
employeeName: {
  type: 'string',
  description: 'Employee full name'
}

// Extracts from:
// "Give John Doe a bonus" → "John Doe"
// "Bonus for John" → "John"
// "J. Doe needs a raise" → "J. Doe"
```

#### Numbers

```typescript
amount: {
  type: 'number',
  description: 'Numeric value only, no symbols'
}

// Extracts from:
// "$5000" → 5000
// "5k" → 5000
// "five thousand dollars" → 5000
```

#### Enums (Constrained Values)

```typescript
priority: {
  type: 'string',
  enum: ['low', 'medium', 'high'],
  description: 'Task priority level'
}

// Maps variations to enum:
// "urgent" → "high"
// "not important" → "low"
// "normal" → "medium"
```

#### Dates

```typescript
dueDate: {
  type: 'string',
  description: 'Date in natural language or ISO format'
}

// Accepts:
// "tomorrow" → "tomorrow"
// "next Friday" → "next Friday"
// "2024-12-25" → "2024-12-25"

// Your component handles parsing:
import { parseDate } from 'chrono-node';
const date = parseDate(entities.dueDate);
```

#### Complex Objects

```typescript
employee: {
  type: 'object',
  properties: {
    name: { type: 'string' },
    department: { type: 'string' },
    id: { type: 'string' }
  }
}

// Extracts from:
// "Give the engineer John a bonus"
// → { name: "John", department: "engineering" }
```

### Optional vs Required Entities

```typescript
const INTENT_REGISTRY = {
  issue_bonus: {
    requiredEntities: ['employeeName', 'amount'],
    optionalEntities: ['reason', 'effectiveDate'],

    // Logic:
    // - If required entities missing → ask in chat
    // - If optional entities missing → show form with empty fields
  }
};
```

### Entity Validation

Always validate extracted entities before using them:

```typescript
function validateBonus(entities: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  // Validate amount
  if (typeof entities.amount !== 'number') {
    errors.push('Amount must be a number');
  } else if (entities.amount <= 0) {
    errors.push('Amount must be positive');
  } else if (entities.amount > 100000) {
    errors.push('Amount exceeds maximum bonus limit');
  }

  // Validate employee
  if (!entities.employeeName) {
    errors.push('Employee name is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Use in your flow
const validation = validateBonus(intent.entities);
if (!validation.valid) {
  addMessage('assistant',
    `I couldn't process that: ${validation.errors.join(', ')}`
  );
  return;
}
```

---

## Building Task Components

Task components are **reusable, data-driven UI components** that render based on extracted entities.

### Component Structure

```typescript
// tasks/compensation/IssueBonusTask.tsx

interface IssueBonusTaskProps {
  // Entities from intent
  employeeName: string;
  amount: number;
  reason?: string;
  effectiveDate?: string;

  // Callbacks
  onComplete: (result: BonusResult) => void;
  onCancel: () => void;
}

export function IssueBonusTask(props: IssueBonusTaskProps) {
  // Local state for editing
  const [amount, setAmount] = useState(props.amount);
  const [reason, setReason] = useState(props.reason || '');
  const [effectiveDate, setEffectiveDate] = useState(
    props.effectiveDate || new Date().toISOString().split('T')[0]
  );

  // Business logic
  const needsApproval = amount > 10000;

  const handleSubmit = async () => {
    // Validate
    if (!reason.trim()) {
      alert('Reason is required');
      return;
    }

    // Submit
    const result = await submitBonus({
      employeeName: props.employeeName,
      amount,
      reason,
      effectiveDate
    });

    props.onComplete(result);
  };

  return (
    <div className="issue-bonus-task">
      <h3>Issue Bonus</h3>

      <div className="employee-info">
        <strong>{props.employeeName}</strong>
      </div>

      <FormField label="Amount">
        <CurrencyInput
          value={amount}
          onChange={setAmount}
        />
        {needsApproval && (
          <Warning>Requires VP approval (over $10k)</Warning>
        )}
      </FormField>

      <FormField label="Reason">
        <TextArea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this bonus being issued?"
        />
      </FormField>

      <FormField label="Effective Date">
        <DatePicker
          value={effectiveDate}
          onChange={setEffectiveDate}
        />
      </FormField>

      <div className="actions">
        <Button onClick={handleSubmit}>
          {needsApproval ? 'Submit for Approval' : 'Issue Bonus'}
        </Button>
        <Button onClick={props.onCancel} variant="secondary">
          Cancel
        </Button>
      </div>
    </div>
  );
}
```

### Key Principles

1. **Props are initial values, state is editable**
   ```typescript
   // Props from AI extraction
   const [amount, setAmount] = useState(props.amount);

   // User can edit, changes go to local state
   // Only committed when user clicks submit
   ```

2. **Components don't know about intents**
   ```typescript
   // ❌ Bad: Component knows about chat
   function IssueBonusTask() {
     const { currentIntent } = useAppStore();  // Tight coupling
   }

   // ✅ Good: Component receives props
   function IssueBonusTask(props: IssueBonusTaskProps) {
     // Works anywhere - chat, traditional UI, mobile, etc.
   }
   ```

3. **Validation happens at multiple levels**
   ```typescript
   // 1. Schema validation (LLM extraction)
   // 2. Business logic validation (component)
   // 3. UI validation (input constraints)

   <CurrencyInput
     value={amount}
     min={0}
     max={100000}
     onChange={setAmount}
   />
   ```

### Connecting to the Right Panel

```typescript
// components/RightPanel.tsx

import { getIntent } from '../registry';
import { useAppStore } from '../store';

export function RightPanel() {
  const { currentIntent, panelMode, clearIntent } = useAppStore();

  // Look up intent definition from registry
  const intentDef = currentIntent ? getIntent(currentIntent.name) : null;

  // Show context panel with intent info
  if (panelMode === 'context') {
    return (
      <div className="context-panel">
        {currentIntent && intentDef && (
          <div>
            <h3>Detected Intent: {currentIntent.name}</h3>
            <p>Confidence: {(currentIntent.confidence * 100).toFixed(0)}%</p>
            {/* Auto-switch countdown UI here */}
          </div>
        )}
      </div>
    );
  }

  // Show task UI
  if (panelMode === 'task-ui' && intentDef) {
    // Dynamically render component from registry
    return <intentDef.component />;
  }

  // Default state
  return <ContextPanel />;
}
```

**Key Benefits:**

- No hardcoded intent-to-component mapping
- RightPanel doesn't import specific task components
- Adding new intents doesn't require changing RightPanel
- Type-safe lookups via registry

---

## State Management

### Zustand Store Structure

```typescript
// store/index.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // Transient state (not persisted)
  isProcessing: boolean;
  currentIntent: Intent | null;
  panelMode: 'context' | 'task-ui';

  // Persistent state (survives refresh)
  messages: Message[];
  tasks: Task[];  // Or whatever domain data

  // Actions
  addMessage: (role: string, content: string) => void;
  setIntent: (intent: Intent | null) => void;
  clearIntent: () => void;
  setPanelMode: (mode: 'context' | 'task-ui') => void;
  // ...
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      isProcessing: false,
      currentIntent: null,
      panelMode: 'context',
      messages: [],
      tasks: [],

      // Actions
      addMessage: (role, content) =>
        set((state) => ({
          messages: [...state.messages, {
            id: crypto.randomUUID(),
            role,
            content,
            timestamp: Date.now()
          }]
        })),

      setIntent: (intent) =>
        set({
          currentIntent: intent,
          panelMode: 'context'  // Show context first
        }),

      setPanelMode: (mode) => set({ panelMode: mode }),

      clearIntent: () =>
        set({
          currentIntent: null,
          panelMode: 'context'
        })
    }),
    {
      name: 'split-ui-storage',

      // Only persist domain data, not UI state
      partialize: (state) => ({
        messages: state.messages,
        tasks: state.tasks
        // Don't persist: isProcessing, currentIntent, panelMode
      })
    }
  )
);
```

### Why This Structure?

**Transient state:**
- Reset on page load
- UI-only concerns
- Examples: loading states, current intent, which panel is showing

**Persistent state:**
- Survives page refresh
- Domain data
- Examples: messages, tasks, user preferences

**Separation of concerns:**
- Reading state: `const { messages } = useAppStore()`
- Updating state: `const { addMessage } = useAppStore()`
- Clean, testable actions

---

## Error Handling

### API Errors

```typescript
try {
  const [intent, response] = await Promise.all([
    detectIntent(userMessage, history),
    generateResponse(userMessage, history)
  ]);

  // Use results...

} catch (error) {
  console.error('API error:', error);

  // Provide user-friendly messages
  let errorMessage = 'Sorry, I encountered an error.';

  if (error instanceof Error) {
    if (error.message.includes('401') || error.message.includes('authentication')) {
      errorMessage = 'Authentication failed. Please check your API key.';
    } else if (error.message.includes('429')) {
      errorMessage = 'Rate limit exceeded. Please wait a moment.';
    } else if (error.message.includes('network')) {
      errorMessage = 'Network error. Please check your connection.';
    }
  }

  addMessage('assistant', errorMessage);
}
```

### Validation Errors

```typescript
// In task component
const handleSubmit = () => {
  const errors = [];

  if (!reason.trim()) {
    errors.push('Reason is required');
  }

  if (amount <= 0) {
    errors.push('Amount must be positive');
  }

  if (errors.length > 0) {
    setValidationErrors(errors);
    return;
  }

  // Proceed with submission
};
```

### Low Confidence Handling

```typescript
const intent = await detectIntent(userMessage, history);

if (!intent) {
  // No intent detected OR confidence too low
  addMessage('assistant',
    "I'm not sure what you'd like to do. Could you rephrase?"
  );
  return;
}

if (intent.confidence < 0.8) {
  // Medium confidence - show but don't auto-switch
  setIntent(intent);
  setPanelMode('context');
  // User must manually click "Open Task UI"
} else {
  // High confidence - auto-switch after countdown
  setIntent(intent);
  // Auto-switch logic in RightPanel
}
```

---

## Testing Strategies

### Testing Intent Detection

```typescript
// tests/intent-detection.test.ts

describe('Intent Detection', () => {
  it('detects bonus intent with amount', async () => {
    const intent = await detectIntent(
      'Give John Doe a $5000 bonus',
      []
    );

    expect(intent?.name).toBe('issue_bonus');
    expect(intent?.entities.employeeName).toBe('John Doe');
    expect(intent?.entities.amount).toBe(5000);
    expect(intent?.confidence).toBeGreaterThan(0.7);
  });

  it('handles variations', async () => {
    const variations = [
      'I want to give John a bonus of $5000',
      'Bonus John $5k',
      'Add a 5000 dollar bonus for John Doe'
    ];

    for (const message of variations) {
      const intent = await detectIntent(message, []);
      expect(intent?.name).toBe('issue_bonus');
      expect(intent?.entities.amount).toBe(5000);
    }
  });

  it('returns null for unrelated messages', async () => {
    const intent = await detectIntent(
      'What's the weather like?',
      []
    );

    expect(intent).toBeNull();
  });
});
```

### Testing Task Components

```typescript
// tests/IssueBonusTask.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { IssueBonusTask } from '../tasks/compensation/IssueBonusTask';

describe('IssueBonusTask', () => {
  it('renders with initial props', () => {
    render(
      <IssueBonusTask
        employeeName="John Doe"
        amount={5000}
        onComplete={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5000')).toBeInTheDocument();
  });

  it('allows editing amount', () => {
    render(<IssueBonusTask employeeName="John" amount={5000} {...handlers} />);

    const amountInput = screen.getByLabelText('Amount');
    fireEvent.change(amountInput, { target: { value: '10000' } });

    expect(amountInput).toHaveValue('10000');
  });

  it('shows approval warning for large amounts', () => {
    render(<IssueBonusTask employeeName="John" amount={50000} {...handlers} />);

    expect(screen.getByText(/requires.*approval/i)).toBeInTheDocument();
  });
});
```

### Manual Testing Checklist

When testing a new intent:

- [ ] Type the intent in many different ways
- [ ] Test with missing entities
- [ ] Test with invalid entities (negative numbers, etc.)
- [ ] Test with ambiguous input (multiple people with same name)
- [ ] Test the full flow: chat → context → UI → submit
- [ ] Test canceling at each step
- [ ] Test with very long inputs
- [ ] Test rapid successive messages
- [ ] Check browser console for errors
- [ ] Verify persistence (refresh page)

---

## Common Pitfalls

### 1. Not Validating LLM Outputs

**Problem:**
```typescript
const intent = await detectIntent(message);
const amount = intent.entities.amount;  // Might not be a number!
processBonus(amount);  // 💥 Could crash
```

**Solution:**
```typescript
const intent = await detectIntent(message);

if (typeof intent.entities.amount !== 'number') {
  console.error('Invalid amount type');
  return;
}

const amount = intent.entities.amount;
processBonus(amount);  // ✅ Safe
```

### 2. Exposing API Keys in Browser

**Problem:**
```typescript
// In frontend code - API key visible in network tab!
const client = new Anthropic({
  apiKey: 'sk-ant-...',
  dangerouslyAllowBrowser: true
});
```

**Solution:**
```typescript
// Backend API route
export async function POST(req: Request) {
  const { message } = await req.json();

  // API key only in backend
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const result = await client.messages.create({...});
  return Response.json(result);
}
```

### 3. Not Handling Conversation History Properly

**Problem:**
```typescript
// Sending too much history
const history = messages.map(m => m.content);  // Could be 1000s of messages
detectIntent(currentMessage, history);  // 💥 Exceeds token limit
```

**Solution:**
```typescript
// Only last N messages
const recentHistory = messages
  .slice(-10)  // Last 10 messages
  .map(m => m.content);

detectIntent(currentMessage, recentHistory);
```

### 4. Tight Coupling Between Components and Intents

**Problem:**
```typescript
// Component knows about intent detection
function IssueBonusTask() {
  const { currentIntent } = useAppStore();
  const amount = currentIntent?.entities.amount;  // Coupled!
}
```

**Solution:**
```typescript
// Component receives props
function IssueBonusTask({ amount }: { amount: number }) {
  // Works with any data source - chat, form, API, etc.
}
```

### 5. Not Testing Variations

**Problem:**
Only testing: "Give John Doe a $5000 bonus"

**Solution:**
Test variations:
- "I want to give John a bonus of $5000"
- "Bonus John $5k"
- "Can you add a 5000 dollar bonus for John Doe"
- "John needs a bonus, 5000"
- etc.

### 6. Forgetting About Edge Cases

**Edge cases to test:**
- Empty input
- Very long input (> 1000 chars)
- Special characters in names: "O'Brien", "Mary-Ann"
- Ambiguous requests: "Give John a bonus" (multiple Johns)
- Out-of-range values: "$1,000,000 bonus"
- Missing required data
- Conflicting data: "Give John $5000 and $10000"

---

## How to Add a New Intent (Step-by-Step)

This section walks through creating a new intent from scratch using the registry pattern.

### Example: Adding a "Schedule Meeting" Intent

**Step 1: Create the intent file**

Create `src/registry/intents/scheduleMeeting.tsx`:

```typescript
import { useState } from 'react';
import { useAppStore } from '../../store';
import type { IntentDefinition } from '../types';

// UI Component
function ScheduleMeetingUI() {
  const { currentIntent, clearIntent, addMessage } = useAppStore();

  // Extract entities from AI detection
  const entities = currentIntent?.entities || {};

  // Local state for editing
  const [attendees, setAttendees] = useState<string>(
    entities.attendees as string || ''
  );
  const [date, setDate] = useState<string>(
    entities.date as string || ''
  );
  const [duration, setDuration] = useState<number>(
    entities.duration as number || 30
  );
  const [topic, setTopic] = useState<string>(
    entities.topic as string || ''
  );

  const handleSchedule = () => {
    // Your business logic here (call API, update calendar, etc.)
    console.log('Scheduling meeting:', {
      attendees,
      date,
      duration,
      topic
    });

    addMessage(
      'assistant',
      `Meeting scheduled with ${attendees} on ${date} for ${duration} minutes.`
    );

    clearIntent();
  };

  return (
    <div className="schedule-meeting-ui">
      <h3>Schedule Meeting</h3>

      <div className="form-field">
        <label>Attendees</label>
        <input
          type="text"
          value={attendees}
          onChange={(e) => setAttendees(e.target.value)}
          placeholder="e.g., John Doe, Jane Smith"
        />
      </div>

      <div className="form-field">
        <label>Date & Time</label>
        <input
          type="text"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          placeholder="e.g., Tomorrow at 2pm, Friday at 10am"
        />
      </div>

      <div className="form-field">
        <label>Duration (minutes)</label>
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(parseInt(e.target.value))}
        />
      </div>

      <div className="form-field">
        <label>Topic</label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., Q4 Planning"
        />
      </div>

      <button onClick={handleSchedule}>Schedule Meeting</button>
      <button onClick={clearIntent} className="secondary">
        Cancel
      </button>
    </div>
  );
}

// Intent Definition (bundle component + schema)
export const scheduleMeeting: IntentDefinition = {
  name: 'schedule_meeting',
  description: 'Schedule a meeting with attendees at a specific date and time',
  component: ScheduleMeetingUI,
  entities: {
    type: 'object',
    properties: {
      attendees: {
        type: 'string',
        description: 'Names of meeting attendees (comma-separated)'
      },
      date: {
        type: 'string',
        description: 'Date and time of the meeting in natural language'
      },
      duration: {
        type: 'number',
        description: 'Meeting duration in minutes'
      },
      topic: {
        type: 'string',
        description: 'Meeting topic or agenda'
      }
    },
    required: ['attendees', 'date']
  }
};
```

**Step 2: Register the intent**

In `src/registry/index.ts`, add:

```typescript
import { scheduleMeeting } from './intents/scheduleMeeting';

// ... existing imports ...

// Register all intents
registerIntent(addTask);
registerIntent(listTasks);
registerIntent(completeTask);
registerIntent(issueBonus);
registerIntent(scheduleMeeting);  // ← Add this line
```

**Step 3: That's it!**

No other changes needed:
- ✅ Tool is auto-generated from the schema
- ✅ Claude will detect "schedule meeting" intents
- ✅ RightPanel will render the component dynamically
- ✅ TypeScript types are enforced

**Step 4: Test it**

Try these messages:
- "Schedule a meeting with John tomorrow at 2pm"
- "I need to meet with the team on Friday at 10am for an hour"
- "Set up a 30-minute call with Jane next week to discuss Q4 planning"

### Quick Reference: Intent Definition Structure

```typescript
export const yourIntent: IntentDefinition = {
  // Tool name (use snake_case)
  name: 'your_intent_name',

  // Description for Claude to understand when to use this tool
  description: 'Clear description of what this intent does',

  // React component to render
  component: YourIntentUI,

  // JSON Schema for entity extraction
  entities: {
    type: 'object',
    properties: {
      fieldName: {
        type: 'string' | 'number' | 'boolean',
        description: 'Help Claude understand what to extract',
        enum: ['option1', 'option2']  // Optional: for constrained values
      }
    },
    required: ['fieldName']  // Optional: which fields are required
  }
};
```

### Best Practices

1. **Good Intent Names**
   - ✅ Use snake_case: `schedule_meeting`, `issue_bonus`
   - ✅ Be specific: `create_expense_report` not `create_thing`
   - ❌ Avoid generic: `do_action`, `handle_request`

2. **Good Descriptions**
   - ✅ Be clear: "Schedule a meeting with specific attendees at a date and time"
   - ✅ Include context: "Issue a one-time monetary bonus to an employee"
   - ❌ Avoid vague: "Handle meetings"

3. **Good Entity Schemas**
   - ✅ Add descriptions to help Claude extract correctly
   - ✅ Use `enum` for constrained values
   - ✅ Mark truly required fields in `required` array
   - ❌ Don't make everything required if it's optional

4. **Component Design**
   - Extract entities into local state (let users edit)
   - Validate before submission
   - Call `clearIntent()` when done
   - Show clear success/error feedback

---

## Next Steps

1. **Read VISION.md** for the conceptual framework
2. **Study this implementation guide** for practical patterns
3. **Examine the current codebase** (src/services/claude.ts, etc.)
4. **Build one new intent end-to-end** using the guide above
5. **Iterate and refine** based on what you learn

As you build, update this document with new patterns, gotchas, and solutions you discover.

---

*Document created: 2024-11-25*
*Updated: 2024-11-28 - Added registry pattern*
