# Learning Path: Intent-Driven UI Development

**A structured guide for experienced developers learning to build AI-powered applications**

---

## Start Here

You've built a working prototype that demonstrates **intent-driven UI architecture** - a split-screen system where natural language input drives structured UI components.

This document outlines **how to learn from this codebase** and **apply these patterns to your own projects**.

---

## What You've Built

### Current State: Task Management Prototype

```
┌─────────────────────────────────────────────────┐
│ LEFT: Chat                RIGHT: Dynamic UI     │
├─────────────────────────────────────────────────┤
│                                                 │
│ User: "Add groceries"     [Add Task Form]      │
│                           Title: groceries ✓    │
│ AI: "Got it, opening      Due: [_______]        │
│      task form in 3..."   Priority: [medium ▼] │
│                           [Create] [Cancel]     │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Features implemented:**
- 3 intents: add_task, list_tasks, complete_task
- Entity extraction: title, dueDate, priority
- Auto-switch with countdown
- Editable pre-filled forms
- localStorage persistence
- Error handling

---

## Documentation Structure

We've created 4 guides for different purposes:

### 1. **VISION.md** - The "Why"

**Read this first** to understand:
- The problem we're solving (navigation overhead, data entry)
- The solution (conversation + structured UI)
- Core principles (entities flow from chat to UI)
- Evolution path (navigation → simple actions → complex workflows)

**Purpose:** Conceptual framework and strategic vision

**Read when:** You want to understand the big picture

---

### 2. **IMPLEMENTATION_GUIDE.md** - The "How"

**Read this second** to learn:
- File structure and data flow
- How to use Claude API with tool use
- Intent detection patterns
- Entity extraction techniques
- Building task components
- State management with Zustand

**Purpose:** Practical implementation patterns

**Read when:** You're ready to build or extend the system

---

### 3. **AI_DEVELOPMENT_GUIDE.md** - The "Mental Models"

**Read this third** to understand:
- How AI differs from traditional code
- Prompt engineering basics
- Working with uncertainty
- Token economics
- When to use AI vs traditional code
- Debugging non-deterministic systems

**Purpose:** Mindset shifts for AI development

**Read when:** You want to deeply understand AI integration

---

### 4. **ARCHITECTURE.md** - The "Deep Dive"

**Read this for reference** when you need:
- Detailed state management patterns
- Scaling strategies
- Production considerations
- Advanced patterns (multi-domain, workflows)

**Purpose:** Reference guide for complex scenarios

**Read when:** You're scaling or going to production

---

## Learning Progression

### Week 1: Understand What Exists

**Goal:** Comprehend the current prototype

**Tasks:**
1. ✅ Read VISION.md
2. ✅ Read README.md (quick start guide)
3. ✅ Run the app: `npm run dev`
4. ✅ Test all 3 flows:
   - Add task: "Add groceries by tomorrow"
   - List tasks: "Show my tasks"
   - Complete task: "Mark groceries as done"
5. ✅ Read through the source code:
   - `src/services/claude.ts` - API integration
   - `src/store/index.ts` - State management
   - `src/components/ChatPanel.tsx` - Chat interface
   - `src/components/RightPanel.tsx` - Dynamic UI

**Outcome:** You understand how the pieces connect

---

### Week 2: Experiment with Intents

**Goal:** Learn intent detection and entity extraction

**Tasks:**
1. ✅ Read IMPLEMENTATION_GUIDE.md (sections 1-4)
2. ✅ Read AI_DEVELOPMENT_GUIDE.md (sections 1-3)
3. ✅ Experiment with prompt variations:
   - Change the prompt in `detectIntent()`
   - Test with different user inputs
   - Observe how entities are extracted
4. ✅ Add logging to see raw LLM responses:
   ```typescript
   console.log('Raw response:', response);
   console.log('Extracted intent:', intent);
   ```
5. ✅ Test edge cases:
   - Ambiguous input: "Add a task"
   - Invalid input: "Give me -$5000"
   - Very long input: "I want to add a task that..."

**Outcome:** You understand how LLM extraction works

---

### Week 3: Build a New Intent

**Goal:** Add the `navigate_to` intent from your navigation JSON

**Tasks:**
1. ✅ Prepare your navigation data:
   ```typescript
   // Create src/data/navigation.json
   // Flatten navigation tree to searchable paths
   ```
2. ✅ Add `navigate_to` to intent detection tool:
   ```typescript
   // In src/services/claude.ts
   enum: ['add_task', 'list_tasks', 'complete_task', 'navigate_to']
   ```
3. ✅ Create `NavigateToTask` component:
   ```typescript
   // src/tasks/navigation/NavigateToTask.tsx
   function NavigateToTask({ navigationPath, url }) {
     // Display breadcrumb and link
   }
   ```
4. ✅ Register in intent registry:
   ```typescript
   // src/intents/registry.ts
   'navigate_to': {
     component: NavigateToTask,
     requiredEntities: ['navigationPath', 'url']
   }
   ```
5. ✅ Test it:
   - "Where do I approve timesheets?"
   - "Show me the payroll section"
   - "I need to find the benefits page"

**Outcome:** You can add new intents end-to-end

---

### Week 4: Build a Complex Intent

**Goal:** Implement `issue_bonus` with validation

**Tasks:**
1. ✅ Read VISION.md examples (issue_bonus section)
2. ✅ Design the intent:
   ```typescript
   {
     name: 'issue_bonus',
     requiredEntities: ['employeeName', 'amount'],
     optionalEntities: ['reason', 'effectiveDate'],
     validation: {
       amount: (val) => val > 0 && val < 100000
     }
   }
   ```
3. ✅ Create `IssueBonusTask` component with:
   - Employee lookup/display
   - Editable amount field
   - Reason input
   - Approval warning (if amount > $10k)
4. ✅ Add entity extraction for all fields
5. ✅ Test edge cases:
   - Multiple employees with same name
   - Very large amounts
   - Missing required data

**Outcome:** You can build production-quality intents

---

## Key Concepts to Master

### 1. Intent Detection

**What:** Determining what the user wants to do

**How:** LLM analyzes message and returns structured intent

**Code:**
```typescript
const intent = await detectIntent("Give John a bonus");
// → { name: 'issue_bonus', confidence: 0.95, entities: {...} }
```

**Practice:**
- Try different phrasings of the same intent
- Observe confidence scores
- Note when detection fails

---

### 2. Entity Extraction

**What:** Pulling structured data from natural language

**How:** Tool use (structured outputs) with defined schemas

**Code:**
```typescript
// Schema defines what to extract
{
  employeeName: { type: 'string' },
  amount: { type: 'number' }  // Always a number, not string!
}

// LLM extracts and types the data
"Give John $5000" → { employeeName: "John", amount: 5000 }
```

**Practice:**
- Add new entity types to schemas
- Test with varied input formats
- Handle missing entities

---

### 3. Task Components

**What:** Reusable UI components that render based on entities

**How:** Components receive entities as props, work anywhere

**Code:**
```typescript
function IssueBonusTask({ employeeName, amount }: Props) {
  // Component doesn't know about intents
  // Just receives data and renders
}

// Can be used in:
// - Chat-driven UI (from intent extraction)
// - Traditional UI (from form input)
// - Mobile app
// - API-driven
```

**Practice:**
- Build components that work in isolation
- Test with different data sources
- Keep components decoupled from intent system

---

### 4. State Flow

**What:** How data flows from chat → state → UI

**Flow:**
```
User types
  ↓
detectIntent() extracts data
  ↓
setIntent() updates Zustand store
  ↓
RightPanel re-renders
  ↓
Selects component from registry
  ↓
Component renders with entities
```

**Practice:**
- Add logging at each step
- Trace a message through the entire flow
- Understand when re-renders happen

---

## Common Learning Challenges

### Challenge 1: "The LLM gives inconsistent results"

**Why:** LLMs are non-deterministic

**Solution:**
- Use structured outputs (tool use) to constrain responses
- Add confidence thresholds
- Validate outputs before using them
- Test with many variations

---

### Challenge 2: "I don't know how to write good prompts"

**Why:** Prompting is a new skill

**Solution:**
- Start with the examples in this codebase
- Read AI_DEVELOPMENT_GUIDE.md section on prompts
- Iterate: test → observe → refine
- Use the Anthropic workbench to experiment

---

### Challenge 3: "My entity extraction is wrong"

**Why:** Schema might be unclear or validation missing

**Solution:**
- Add more descriptive schema definitions
- Provide examples in the prompt
- Validate extracted entities
- Log raw LLM responses to debug

---

### Challenge 4: "I don't know when to use AI vs code"

**Why:** It's a new decision to make

**Rule of thumb:**
- AI: Natural language → structured data
- Code: Everything else (validation, storage, logic)

**Read:** AI_DEVELOPMENT_GUIDE.md section "When to Use AI"

---

## Applying to Your HCM Product

### Phase 1: Navigation (2-3 weeks)

**Goal:** Help users find features

1. Export your product's navigation to JSON
2. Implement `navigate_to` intent
3. Test with real users
4. Measure: Do they find features faster?

**Success metric:** Reduced support tickets for "where is X?"

---

### Phase 2: High-Value Tasks (1-2 months)

**Goal:** Enable common actions via chat

1. Identify top 10 most common tasks in your product
2. Build intent + task component for each
3. Start simple (1-2 entities), add complexity over time
4. Deploy to power users first

**Example tasks:**
- Hire employee
- Issue bonus
- Approve timesheet
- Enroll in benefits
- Update employee info

**Success metric:** Task completion time reduced

---

### Phase 3: Complex Workflows (2-3 months)

**Goal:** Handle multi-step processes

1. Identify workflows that span multiple screens
2. Break into sub-tasks
3. Build orchestration layer
4. Test with real workflows

**Example workflows:**
- Full onboarding process (multiple sub-tasks)
- Compensation review cycle
- Benefits enrollment period

**Success metric:** Workflow completion rate increased

---

### Phase 4: Production Hardening (Ongoing)

**Goal:** Make it production-ready

1. Move API calls to backend
2. Add authentication
3. Implement rate limiting
4. Add monitoring and logging
5. A/B test with real users

**Read:** ARCHITECTURE.md "Production Considerations"

---

## Testing Your Understanding

### Quiz Yourself

After each learning week, answer these:

**Week 1:**
- Can you explain the data flow from user input to UI render?
- What are the 3 parts of the architecture (state, services, components)?
- Why is the UI split-screen vs modal or full-screen?

**Week 2:**
- What is tool use and why is it better than free text?
- What's the difference between intent and entity?
- How does confidence scoring affect behavior?

**Week 3:**
- Can you add a new intent without looking at the guide?
- Can you explain the intent registry pattern?
- When would you use required vs optional entities?

**Week 4:**
- Can you build a task component from scratch?
- How do you handle validation at multiple levels?
- When would you ask for clarification vs showing partial UI?

---

## Resources

### In This Repo

- **README.md** - Quick start and testing guide
- **VISION.md** - Strategic vision and principles
- **IMPLEMENTATION_GUIDE.md** - Practical patterns
- **AI_DEVELOPMENT_GUIDE.md** - Mental models for AI
- **ARCHITECTURE.md** - Deep technical reference
- **SUMMARY.md** - What was built and why

### External Resources

- **Anthropic Docs:** https://docs.anthropic.com/claude/docs
  - Especially: Tool use, prompt engineering
- **Console:** https://console.anthropic.com
  - Test prompts before coding
- **GitHub Issues:** Ask questions, share learnings

---

## Next Steps

**Today:**
1. ✅ Read VISION.md (30 min)
2. ✅ Run the app and test all 3 flows (15 min)
3. ✅ Decide: Do I want to learn or start building?

**If learning:**
- Follow the week-by-week progression above
- Take notes on what you discover
- Update these docs with your insights

**If building:**
- Jump to IMPLEMENTATION_GUIDE.md
- Pick one new intent to add
- Start experimenting

**If unclear:**
- Re-read relevant sections
- Ask questions (GitHub issues, team chat)
- Build a simple example to clarify

---

## Keeping This Knowledge

As you learn, **update these documents** with:

1. **Patterns you discover**
   - "I found a better way to handle X"
   - Add to IMPLEMENTATION_GUIDE.md

2. **Mistakes you made**
   - "I got stuck because I didn't understand Y"
   - Add to "Common Pitfalls" sections

3. **Questions you had**
   - "I wondered how Z works"
   - Add explanations for future you

4. **Improvements to the codebase**
   - Better abstractions
   - Reusable utilities
   - Clearer names

**These docs are living documents.** Make them better as you learn.

---

## Success Indicators

You'll know you've mastered this when you can:

- [ ] Explain the architecture to a colleague
- [ ] Add a new intent in < 1 hour
- [ ] Debug why an intent detection failed
- [ ] Build a task component from scratch
- [ ] Decide when to use AI vs traditional code
- [ ] Apply these patterns to a different domain
- [ ] Teach someone else these concepts

---

## Final Thoughts

You're learning two things simultaneously:

1. **How to integrate AI** (new skill for everyone)
2. **A new UI paradigm** (intent-driven vs navigation-driven)

Be patient with yourself. This is genuinely new territory, even for experienced developers.

The prototype you've built proves the concept works. Now it's about:
- Deepening your understanding
- Extending to more intents
- Applying to your real product
- Sharing what you learn

**You're not just learning a technology. You're learning a new way to think about building software.**

Good luck! 🚀

---

*Start with VISION.md, then come back here for the structured learning path.*

---

*Document created: 2024-11-25*
