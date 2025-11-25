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
  taskUIType: 'add-task' | 'list-tasks' | 'complete-task' | 'none'

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

**Technology:** Claude API with tool use (structured outputs)

**Flow:**

```
User types message
    ↓
Parallel API calls:
    ├─ detectIntent() → Uses tool_use to extract structured data
    └─ generateResponse() → Creates conversational response
    ↓
Update state with both results
    ↓
Auto-transition to task UI (if high confidence)
```

**Tool Definition Pattern:**

```typescript
{
  name: 'detect_intent',
  input_schema: {
    properties: {
      intent: { enum: ['add_task', 'list_tasks', 'complete_task', 'none'] },
      confidence: { type: 'number' },
      entities: {
        // Intent-specific entities
        title: { type: 'string' },      // for add_task
        dueDate: { type: 'string' },    // for add_task
        priority: { enum: [...] },       // for add_task
        filter: { enum: [...] },         // for list_tasks
        taskIdentifier: { type: 'string' } // for complete_task
      }
    }
  }
}
```

**Why this pattern works:**
- **Structured extraction:** Claude returns JSON, not free text
- **Confidence thresholding:** Only act on high-confidence intents (>0.7)
- **Entity flexibility:** Different intents extract different entities
- **Parallel execution:** Don't block conversation while detecting intent

**Production considerations:**
- Move API calls to backend (never expose API keys in browser)
- Implement retry logic with exponential backoff
- Cache intent detection results to reduce API costs
- Add fallback intents for common user patterns
- Consider fine-tuning for domain-specific intents

---

### 3. Dynamic Panel System

**Pattern:** Context-first, then UI

```
State Flow:
currentIntent + confidence → panelMode + taskUIType
```

**States:**

| Panel Mode | Task UI Type | What User Sees |
|------------|--------------|----------------|
| `context` | `none` | Welcome state / conversation summary |
| `context` | `add-task` | Intent display + countdown timer |
| `task-ui` | `add-task` | Task creation form |
| `task-ui` | `list-tasks` | Task list with checkboxes |
| `task-ui` | `complete-task` | Task selector |

**Auto-switching Logic:**

```typescript
// Trigger: High confidence intent detected
if (confidence >= 0.8 && taskUIType !== 'none') {
  // Show context panel first (user sees what was detected)
  setPanelMode('context')

  // Start 3-second countdown
  setTimeout(() => {
    setPanelMode('task-ui') // Auto-switch to task UI
  }, 3000)
}
```

**Why this pattern works:**
- **Transparency:** User sees what the system detected before auto-switch
- **Control:** User can cancel auto-switch or trigger immediately
- **Progressive disclosure:** Context → Task UI is a natural flow
- **Feedback loop:** Users learn to trust the system over time

**Production considerations:**
- Make countdown duration configurable per user preference
- Add analytics to track how often users cancel auto-switch
- Consider different confidence thresholds per intent type
- Implement "smart delay" that learns from user behavior
- Add keyboard shortcuts to skip countdown

---

### 4. Component Architecture

**Pattern:** Container/Presenter with Local State

```
App (root)
  ├─ ChatPanel (container)
  │   ├─ Message display (presenter)
  │   └─ Input form (controlled component)
  │
  └─ RightPanel (container)
      ├─ Context display (when panelMode = 'context')
      │   ├─ Intent display
      │   └─ Auto-switch countdown
      │
      └─ Task UIs (when panelMode = 'task-ui')
          ├─ AddTaskUI (local state for editing)
          ├─ ListTasksUI (direct store binding)
          └─ CompleteTaskUI (fuzzy task matching)
```

**Key Pattern: Editable Forms with Pre-filled Data**

```typescript
function AddTaskUI() {
  const { currentIntent, addTask } = useAppStore()

  // Extract entities from intent (initial values)
  const entities = currentIntent?.entities || {}

  // Local state for editing (user can modify AI extractions)
  const [title, setTitle] = useState(entities.title || '')
  const [dueDate, setDueDate] = useState(entities.dueDate || '')
  const [priority, setPriority] = useState(entities.priority || 'medium')

  // Save to store when user clicks "Create"
  const handleCreate = () => {
    addTask({ title, dueDate, priority, completed: false })
    clearIntent() // Reset to default state
  }
}
```

**Why this pattern works:**
- **AI as assistant, not dictator:** User can correct AI mistakes
- **Progressive enhancement:** Start with AI extraction, let user refine
- **Local state for UX:** No store updates until user commits
- **Clean separation:** UI components don't know about intent detection

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

### Multi-Domain Intents

Current prototype: Task management (3 intents)

**Production scale:**

```typescript
// HCM domain example
const HCM_INTENTS = {
  hiring: ['post_job', 'review_candidate', 'schedule_interview'],
  onboarding: ['create_onboarding_plan', 'assign_equipment', 'setup_accounts'],
  payroll: ['process_payroll', 'update_salary', 'review_timesheet'],
  benefits: ['enroll_benefits', 'update_coverage', 'check_eligibility'],
  performance: ['start_review', 'set_goals', 'give_feedback']
}
```

**Architecture for scale:**

```typescript
// Intent router
type IntentDomain = 'hiring' | 'onboarding' | 'payroll' | 'benefits' | 'performance'

interface Intent {
  domain: IntentDomain
  action: string
  confidence: number
  entities: Record<string, unknown>
}

// Domain-specific UI components
const DOMAIN_UI_MAP = {
  hiring: {
    post_job: PostJobUI,
    review_candidate: CandidateReviewUI,
    schedule_interview: InterviewSchedulerUI
  },
  // ... other domains
}

// Dynamic UI rendering
function RightPanel() {
  const { currentIntent } = useAppStore()

  if (!currentIntent) return <DefaultContextPanel />

  const UIComponent = DOMAIN_UI_MAP[currentIntent.domain][currentIntent.action]
  return <UIComponent intent={currentIntent} />
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
│   └── RightPanel.tsx   # Right panel (context + task UIs)
│
├── services/            # External integrations
│   └── claude.ts        # Intent detection + response generation
│
├── store/               # State management
│   └── index.ts         # Zustand store with persistence
│
├── types/               # TypeScript interfaces
│   └── index.ts         # Message, Intent, Task types
│
├── App.tsx              # Root component (split layout)
├── App.css              # Styling
└── main.tsx             # Entry point
```

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
