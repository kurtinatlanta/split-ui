# Split-Screen Intent-Driven UI - Architecture & Design Patterns

## Overview

This is a proof-of-concept for a split-screen UI that uses AI-powered intent detection to dynamically show contextual interfaces. The key innovation is creating a seamless flow from conversational input to structured task execution.

## Core Concept

**The Problem:** Traditional UIs require users to navigate menus and click through multiple screens to accomplish tasks. This creates friction and cognitive load.

**The Solution:** A split-screen interface where:
1. **Left Panel:** Natural language conversation (chat interface)
2. **Right Panel:** Dynamic UI that adapts based on detected user intent
3. **Automatic Transition:** System detects intent → shows context → auto-switches to task UI

## Architecture Patterns

### 1. State Management Architecture

**Technology:** Zustand with persistence middleware

**Key Design Decisions:**

```typescript
interface AppState {
  // Transient state (not persisted)
  isProcessing: boolean
  currentIntent: Intent | null
  panelMode: 'context' | 'task-ui'

  // Persistent state (survives page refresh)
  messages: Message[]
  tasks: Task[]
}
```

**Why this pattern works:**
- **Separation of concerns:** UI state (transient) vs. domain data (persistent)
- **Single source of truth:** All components read from one store
- **Selective persistence:** Only persist data that matters across sessions
- **Simple actions:** Pure functions that transform state predictably

**Production considerations:**
- For large-scale apps, consider splitting into multiple stores (chat store, task store, UI store)
- Add middleware for logging/debugging state changes
- Implement optimistic updates for better perceived performance

---

### 2. Intent Detection System

**Technology:** Claude API with tool use (structured outputs) + Intent Registry

**Flow:**

```
User types message
    ↓
Registry generates tools dynamically (getIntentTools())
    ↓
Parallel API calls:
    ├─ detectIntent() → Claude calls the appropriate intent tool
    └─ generateResponse() → Creates conversational response
    ↓
Update state with both results
    ↓
Auto-transition to task UI (if high confidence)
```

**Registry-Based Tool Generation Pattern:**

```typescript
// Intent definitions are registered in src/registry/
export const addTask: IntentDefinition = {
  name: 'add_task',
  description: 'Create a new task with optional due date and priority',
  component: AddTaskUI,
  entities: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Task title' },
      dueDate: { type: 'string', description: 'Due date in natural language' },
      priority: { type: 'string', enum: ['low', 'medium', 'high'] }
    },
    required: ['title']
  }
};

// Tools are auto-generated from all registered intents
const tools = getIntentTools();
// → Returns array of Anthropic tools, one per registered intent
// → Each tool has the intent name, description, and entity schema
```

**Why this pattern works:**
- **One tool per intent:** Claude calls the specific intent tool (not a generic detect_intent)
- **Self-contained definitions:** Each intent bundles its UI component + schema + description
- **Type-safe:** Proper TypeScript types throughout (no `as any` casts)
- **DRY principle:** Entity schema defined once, used for both API and UI
- **Easy extensibility:** Add new intent = create one file + one registration line
- **Parallel execution:** Don't block conversation while detecting intent

**Production considerations:**
- Move API calls to backend (never expose API keys in browser)
- Implement retry logic with exponential backoff
- Cache intent detection results to reduce API costs
- Add fallback intents for common user patterns
- Consider fine-tuning for domain-specific intents

---

### 3. Dynamic Panel System

**Pattern:** Context-first, then UI (with Registry Lookup)

```
State Flow:
currentIntent → Registry Lookup → panelMode → Component Render
```

**States:**

| Panel Mode | Current Intent | What User Sees |
|------------|----------------|----------------|
| `context` | `null` | Welcome state / conversation summary |
| `context` | `{ name: 'add_task', ... }` | Intent display + countdown timer |
| `task-ui` | `{ name: 'add_task', ... }` | AddTaskUI component (from registry) |
| `task-ui` | `{ name: 'list_tasks', ... }` | ListTasksUI component (from registry) |
| `task-ui` | `{ name: 'complete_task', ... }` | CompleteTaskUI component (from registry) |

**Auto-switching Logic:**

```typescript
// Trigger: High confidence intent detected
const intentDef = getIntent(currentIntent.name);

if (currentIntent.confidence >= 0.8 && intentDef) {
  // Show context panel first (user sees what was detected)
  setPanelMode('context')

  // Start 3-second countdown
  setTimeout(() => {
    setPanelMode('task-ui') // Auto-switch to task UI
  }, 3000)
}
```

**Registry Lookup Pattern:**

```typescript
// In RightPanel component
const intentDef = getIntent(currentIntent?.name);

if (panelMode === 'task-ui' && intentDef) {
  // Render component dynamically from registry
  return <intentDef.component />;
}
```

**Why this pattern works:**
- **Transparency:** User sees what the system detected before auto-switch
- **Control:** User can cancel auto-switch or trigger immediately
- **Progressive disclosure:** Context → Task UI is a natural flow
- **Feedback loop:** Users learn to trust the system over time
- **No hardcoding:** Intent-to-component mapping happens via registry
- **Type-safe:** TypeScript ensures component exists in registry

**Production considerations:**
- Make countdown duration configurable per user preference
- Add analytics to track how often users cancel auto-switch
- Consider different confidence thresholds per intent type
- Implement "smart delay" that learns from user behavior
- Add keyboard shortcuts to skip countdown

---

### 4. Component Architecture

**Pattern:** Container/Presenter with Registry-Based Dynamic Rendering

```
App (root)
  ├─ ChatPanel (container)
  │   ├─ Message display (presenter)
  │   └─ Input form (controlled component)
  │
  └─ RightPanel (container + registry consumer)
      ├─ Context display (when panelMode = 'context')
      │   ├─ Intent display
      │   └─ Auto-switch countdown
      │
      └─ Dynamic Task UI (when panelMode = 'task-ui')
          └─ Renders <intentDef.component /> from registry
              ├─ AddTaskUI (in src/registry/intents/addTask.tsx)
              ├─ ListTasksUI (in src/registry/intents/listTasks.tsx)
              ├─ CompleteTaskUI (in src/registry/intents/completeTask.tsx)
              └─ IssueBonusUI (in src/registry/intents/issueBonus.tsx)
```

**Key Pattern: Self-Contained Intent Definitions**

```typescript
// src/registry/intents/addTask.tsx
import { useState } from 'react';
import { useAppStore } from '../../store';
import type { IntentDefinition } from '../types';

function AddTaskUI() {
  const { currentIntent, addTask, clearIntent } = useAppStore();

  // Extract entities from intent (initial values)
  const entities = currentIntent?.entities || {};

  // Local state for editing (user can modify AI extractions)
  const [title, setTitle] = useState(entities.title || '');
  const [dueDate, setDueDate] = useState(entities.dueDate || '');
  const [priority, setPriority] = useState(entities.priority || 'medium');

  // Save to store when user clicks "Create"
  const handleCreate = () => {
    addTask({ title, dueDate, priority, completed: false });
    clearIntent(); // Reset to default state
  };

  return (/* UI JSX */);
}

// Bundle component + schema + description together
export const addTask: IntentDefinition = {
  name: 'add_task',
  description: 'Create a new task with optional due date and priority',
  component: AddTaskUI,
  entities: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Task title' },
      dueDate: { type: 'string', description: 'Due date in natural language' },
      priority: { type: 'string', enum: ['low', 'medium', 'high'] }
    },
    required: ['title']
  }
};
```

**Registry Consumption in RightPanel:**

```typescript
import { getIntent } from '../registry';

export function RightPanel() {
  const { currentIntent, panelMode } = useAppStore();

  // Look up intent definition from registry
  const intentDef = currentIntent ? getIntent(currentIntent.name) : null;

  if (panelMode === 'task-ui' && intentDef) {
    // Dynamically render the registered component
    return <intentDef.component />;
  }

  return <ContextPanel />;
}
```

**Why this pattern works:**
- **AI as assistant, not dictator:** User can correct AI mistakes
- **Progressive enhancement:** Start with AI extraction, let user refine
- **Local state for UX:** No store updates until user commits
- **Clean separation:** UI components don't know about intent detection
- **Colocation:** Each intent file contains both UI and schema
- **No hardcoding:** RightPanel doesn't import specific intent components

**Production considerations:**
- Add validation before saving (required fields, date formats)
- Show diff between AI extraction and user edits
- Add "Use AI suggestion" button to restore original extraction
- Implement undo/redo for task operations

---

### 5. Persistence Strategy

**Pattern:** Selective localStorage with Zustand

```typescript
persist(
  (set) => ({ /* state + actions */ }),
  {
    name: 'split-ui-storage',
    partialize: (state) => ({
      tasks: state.tasks,       // Persist
      messages: state.messages, // Persist
      // Don't persist:
      // - isProcessing (transient)
      // - currentIntent (session-only)
      // - panelMode (should reset)
    })
  }
)
```

**Why this pattern works:**
- **Fast persistence:** No backend needed for prototype
- **Selective storage:** Only persist what matters
- **Automatic hydration:** State loads on page refresh
- **Type-safe:** TypeScript ensures consistency

**Production considerations:**
- Move to backend API with optimistic updates
- Implement sync strategy (local-first with eventual consistency)
- Add conflict resolution for multi-device usage
- Implement data migration for schema changes
- Add export/import for user data portability

---

## Key UX Patterns & Learnings

### 1. The Auto-Switch Pattern

**When to auto-switch:**
- High confidence (≥80%)
- Clear user intent
- Task can be completed in single UI

**When NOT to auto-switch:**
- Low confidence (<70%)
- Ambiguous intent
- User explicitly canceled before
- Multiple possible interpretations

**Visual feedback:**
```
┌─────────────────────────────┐
│ Detected Intent: Add Task   │
│ Confidence: 85%             │
│                             │
│ Opening Task UI in 3...     │
│ [Cancel] [Open Now]         │
└─────────────────────────────┘
```

### 2. Entity Extraction + Human Refinement

**Pattern:**
1. AI extracts entities from natural language
2. Pre-fill form with extracted values
3. User can edit before committing
4. Save refined version to database

**Example:**
```
User: "Add a task to finish the Q4 report by Friday"

AI Extraction:
- title: "finish the Q4 report"
- dueDate: "Friday"
- priority: "medium" (inferred)

User sees pre-filled form and can:
- Change title to "Complete Q4 Financial Report"
- Keep "Friday" or change to specific date
- Adjust priority to "high"
```

**Key insight:** AI should suggest, humans should decide.

### 3. Progressive Disclosure

**Pattern:** Show complexity gradually

```
Level 1: Chat (simple, familiar)
    ↓
Level 2: Context display (what did the system understand?)
    ↓
Level 3: Task UI (structured form for completion)
```

**Why this works:**
- Reduces cognitive load
- Builds trust through transparency
- Allows users to verify before committing

---

## API Integration Patterns

### Current (Prototype)

```typescript
// Client-side API calls (NOT PRODUCTION SAFE)
const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true
})
```

**Issues:**
- ❌ API key exposed in browser
- ❌ No rate limiting
- ❌ No request caching
- ❌ No error retry logic

### Production Pattern (Recommended)

```
Client                Backend               Claude API
  │                      │                      │
  ├─ POST /api/chat ────→│                      │
  │                      ├─ Validate request    │
  │                      ├─ Check rate limit    │
  │                      ├─ POST /v1/messages ─→│
  │                      │                      │
  │                      │←─ Response ──────────┤
  │                      ├─ Cache result        │
  │←─ JSON response ─────┤                      │
  │                      │                      │
```

**Backend responsibilities:**
- Secure API key storage (environment variables)
- Rate limiting per user/session
- Request/response caching
- Error handling and retry logic
- Logging and monitoring
- Cost tracking

**Example backend route (Next.js API route):**

```typescript
// pages/api/chat.ts
export default async function handler(req, res) {
  // Validate request
  if (req.method !== 'POST') return res.status(405).end()

  const { message, conversationHistory } = req.body

  // Rate limiting (Redis/memory)
  const rateLimitOk = await checkRateLimit(req.ip)
  if (!rateLimitOk) return res.status(429).json({ error: 'Rate limit exceeded' })

  // Call Claude API
  try {
    const [intent, response] = await Promise.all([
      detectIntent(message, conversationHistory),
      generateResponse(message, conversationHistory)
    ])

    res.status(200).json({ intent, response })
  } catch (error) {
    console.error('API error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
```

---

## Scaling the Pattern

### Multi-Domain Intents with Registry

Current prototype: Task management (4 intents)

**Production scale with Registry Pattern:**

```typescript
// Each domain registers its intents

// src/registry/intents/hiring/postJob.tsx
export const postJob: IntentDefinition = {
  name: 'post_job',
  description: 'Create a new job posting',
  component: PostJobUI,
  entities: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      department: { type: 'string' },
      salary: { type: 'number' }
    }
  }
};

// src/registry/intents/payroll/processPay.tsx
export const processPayroll: IntentDefinition = {
  name: 'process_payroll',
  description: 'Process payroll for employees',
  component: ProcessPayrollUI,
  entities: { /* ... */ }
};

// Register all intents
registerIntent(postJob);
registerIntent(processPayroll);
registerIntent(enrollBenefits);
registerIntent(startReview);
// ... etc.

// Tools are auto-generated from ALL registered intents
const tools = getIntentTools();
// → Returns array of 50+ tools if you have 50+ intents
```

**Scaling Benefits:**

1. **No central mapping file** - Each intent is self-contained
2. **Easy to organize** - Group intents by domain in folders
3. **Lazy loading** - Can dynamically import intent modules
4. **Type-safe** - TypeScript ensures consistency
5. **No limit** - Register as many intents as needed

**Recommended File Organization for Scale:**

```
src/registry/
├── types.ts
├── index.ts
└── intents/
    ├── tasks/
    │   ├── addTask.tsx
    │   ├── listTasks.tsx
    │   └── completeTask.tsx
    ├── hiring/
    │   ├── postJob.tsx
    │   ├── reviewCandidate.tsx
    │   └── scheduleInterview.tsx
    ├── payroll/
    │   ├── processPayroll.tsx
    │   ├── updateSalary.tsx
    │   └── reviewTimesheet.tsx
    └── benefits/
        ├── enrollBenefits.tsx
        ├── updateCoverage.tsx
        └── checkEligibility.tsx
```

**Dynamic UI rendering stays the same:**

```typescript
// RightPanel doesn't need to change as you add more intents
function RightPanel() {
  const { currentIntent } = useAppStore();
  const intentDef = currentIntent ? getIntent(currentIntent.name) : null;

  if (panelMode === 'task-ui' && intentDef) {
    return <intentDef.component />;
  }

  return <ContextPanel />;
}
```

---

## Testing Strategy

### Unit Tests
- Intent detection accuracy (precision/recall)
- Entity extraction correctness
- State transitions (Zustand actions)
- UI component rendering

### Integration Tests
- End-to-end flow: Message → Intent → UI → Action
- Auto-switch timing and cancellation
- Persistence (localStorage)
- Error handling

### User Testing
- Can users complete tasks faster than traditional UI?
- Do users trust the auto-switch feature?
- What confidence threshold feels right?
- Where do users want manual control vs. automation?

**Metrics to track:**
- Intent detection accuracy (% correct)
- Time to task completion (vs. traditional UI)
- Auto-switch acceptance rate (% not canceled)
- Task completion rate
- User satisfaction (qualitative feedback)

---

## Key Takeaways for Production

### What Works Well

1. **Split-screen layout**
   - Maintains context while showing task UI
   - Familiar chat interface reduces learning curve
   - Clear separation of input (left) and output (right)

2. **Intent detection with tool use**
   - Structured outputs are reliable
   - Confidence scoring enables smart thresholds
   - Entity extraction saves user time

3. **Auto-switching with countdown**
   - Feels magical when it works
   - Countdown gives users control
   - Builds trust through transparency

4. **Editable pre-filled forms**
   - Best of both worlds: speed + accuracy
   - Users can correct AI mistakes
   - Progressive enhancement pattern

### Challenges to Solve

1. **Context window limits**
   - Long conversations exceed token limits
   - Need conversation summarization
   - Implement sliding window + retrieval

2. **Ambiguous intents**
   - What if confidence is 65%? (below threshold but not random)
   - Multiple possible interpretations
   - Need clarification dialog system

3. **Complex workflows**
   - Some tasks require multi-step UIs
   - Need wizard/stepper pattern
   - State management gets complex

4. **Error recovery**
   - What if API call fails mid-conversation?
   - Need retry with exponential backoff
   - Graceful degradation to manual mode

---

## Next Steps for Production

### Phase 1: Backend & Security
- [ ] Move API calls to backend proxy
- [ ] Implement rate limiting
- [ ] Add request caching
- [ ] Secure API key storage
- [ ] Add logging and monitoring

### Phase 2: UX Refinement
- [ ] User testing with real workflows
- [ ] Tune confidence thresholds per intent
- [ ] Add keyboard shortcuts
- [ ] Implement undo/redo
- [ ] Add data export

### Phase 3: Scale to Multiple Domains
- [ ] Build intent router system
- [ ] Create domain-specific UI components
- [ ] Implement multi-step wizard pattern
- [ ] Add domain-specific validation

### Phase 4: Intelligence
- [ ] Learn from user corrections
- [ ] Personalize confidence thresholds
- [ ] Implement conversation summarization
- [ ] Add context retrieval (RAG)

---

## Code Organization

```
src/
├── components/          # React components
│   ├── ChatPanel.tsx    # Left panel (conversation)
│   └── RightPanel.tsx   # Right panel (context + dynamic task UIs)
│
├── registry/            # Intent registry system
│   ├── types.ts         # IntentDefinition, AnthropicTool, EntitySchema
│   ├── index.ts         # Registry functions (registerIntent, getIntent, getIntentTools)
│   └── intents/         # Self-contained intent definitions
│       ├── addTask.tsx       # Add task intent + UI
│       ├── listTasks.tsx     # List tasks intent + UI
│       ├── completeTask.tsx  # Complete task intent + UI
│       └── issueBonus.tsx    # Issue bonus intent + UI
│
├── services/            # External integrations
│   └── claude.ts        # Intent detection + response generation (uses registry)
│
├── store/               # State management
│   └── index.ts         # Zustand store with persistence
│
├── types/               # TypeScript interfaces
│   └── index.ts         # Message, Intent, Task, PanelMode types
│
├── App.tsx              # Root component (split layout)
├── App.css              # Styling
└── main.tsx             # Entry point
```

**Key Files:**

- **`src/registry/types.ts`**: Type definitions for the registry system
- **`src/registry/index.ts`**: Core registry with `registerIntent()`, `getIntent()`, `getIntentTools()`
- **`src/registry/intents/*.tsx`**: Each file exports an `IntentDefinition` with component + schema
- **`src/components/RightPanel.tsx`**: Consumes registry via `getIntent()` to render components dynamically
- **`src/services/claude.ts`**: Uses `getIntentTools()` to generate Anthropic tools from registry

---

## Conclusion

This architecture demonstrates that conversational + structured UIs can coexist seamlessly. The key insights:

1. **Progressive disclosure:** Chat → Context → Task UI
2. **AI as assistant:** Suggest, don't dictate
3. **Transparency builds trust:** Show what was detected
4. **Automation with escape hatches:** Auto-switch with cancel
5. **State management matters:** Separate transient from persistent

For production, focus on:
- Backend security and reliability
- User testing to tune thresholds
- Scalable intent routing
- Error handling and recovery

This pattern can scale from task management to complex enterprise workflows (HCM, CRM, ERP) while maintaining simplicity and user control.
