# Product Vision: Intent-Driven UI Architecture

## Overview

This document captures the architectural vision for building intent-driven user interfaces that combine conversational AI with structured task UIs. The goal is to create a system where users express **what they want to accomplish** in natural language, and the system provides **structured interfaces** to complete those tasks efficiently.

---

## The Core Problem

Traditional enterprise software UIs have fundamental UX friction:

1. **Navigation overhead:** Users must remember/discover where features live
2. **Context switching:** Navigate away from current work to accomplish tasks
3. **Rigid workflows:** Software dictates the path, not user intent
4. **Data entry burden:** Users re-type information the system could infer

**Example: Traditional HCM Flow**
```
Task: "Give John Doe a $5000 bonus"

Traditional UI path:
1. Click "Compensation" in main nav
2. Click "Manage Compensation"
3. Search for "John Doe"
4. Click employee profile
5. Navigate to "Compensation" tab
6. Click "Add Adjustment"
7. Select "Bonus" from dropdown
8. Enter "5000"
9. Select effective date
10. Enter justification
11. Click "Submit"

Result: 11+ interactions, high cognitive load, easy to forget steps
```

---

## The Solution: Intent-Driven Architecture

### Core Concept

**Split the interface into two collaborative panels:**

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  LEFT: Conversation (Intent Discovery)         │
│  - Natural language input                      │
│  - AI detects intent + extracts entities       │
│  - Clarifying questions                        │
│  - Progressive disclosure                      │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  RIGHT: Task UI (Structured Execution)         │
│  - Pre-filled forms from conversation          │
│  - Direct manipulation                         │
│  - Validation & guardrails                     │
│  - Visual feedback                             │
│                                                 │
└─────────────────────────────────────────────────┘
```

**New flow for same task:**
```
User types: "Give John Doe a $5000 bonus"

System:
1. Detects intent: issue_bonus
2. Extracts entities: {employee: "John Doe", amount: 5000}
3. Shows pre-filled bonus form in right panel
4. Asks in chat: "What's the reason for this bonus?"
5. User types: "Q4 performance"
6. Form updates, user clicks "Submit"

Result: 2-3 interactions, low cognitive load, conversational
```

---

## Architectural Principles

### 1. **Conversation Discovers Intent, UI Provides Structure**

The left panel (chat) is for **discovering what the user wants**. The right panel (task UI) provides **structure to complete it safely**.

**Why both?**
- Conversation is flexible but ambiguous
- Structured UIs are rigid but precise
- Together: flexible input, precise execution

**Example:**
```
Chat: "I want to promote Sarah"
→ Flexible, natural, but missing details

UI: [Promotion Form]
    Employee: Sarah Chen ✓
    New Title: [_______]  ← Structured input required
    Salary: [_______]     ← With validation
    Effective: [_______]  ← Date picker
```

### 2. **Entities Flow from Conversation to UI**

When the LLM extracts entities from conversation, those become **props** to the task UI component.

**Think of it as:**
```typescript
// User says: "Give John Doe a $5000 bonus"

// LLM extracts:
const entities = {
  employeeName: "John Doe",
  amount: 5000,
  type: "bonus"
};

// System renders:
<IssueBonusTask {...entities} />
```

**Key insight:** The UI component doesn't care if data came from conversation or was typed directly into a form. It just receives props and renders.

### 3. **Progressive Disclosure Through Conversation**

The chat can ask for missing required entities **before** or **after** showing the UI.

**Strategy 1: Collect then show**
```
User: "Give someone a bonus"
Chat: "Who should receive the bonus?"
User: "John Doe"
Chat: "How much?"
User: "$5000"
→ NOW show UI with complete data
```

**Strategy 2: Show then collect** (Better UX)
```
User: "Give John Doe a bonus"
→ IMMEDIATELY show UI with partial data
Chat: "How much should the bonus be?"
User can type in chat OR in the form field
→ Either updates the same state
```

### 4. **Task Components, Not Pages**

Traditional approach: Build pages with navigation, layout, everything bundled.

**New approach:** Build **task components** that:
- Accept data as props
- Work in isolation
- Can be composed
- Render in multiple contexts

**Example:**
```typescript
// Traditional page component (tightly coupled)
function CompensationPage() {
  return (
    <PageLayout>
      <Navigation />
      <Sidebar />
      <Header title="Compensation" />
      <CompensationContent />  ← The actual functionality
      <Footer />
    </PageLayout>
  );
}

// Task component (loosely coupled)
function IssueBonusTask({ employee, amount, onComplete }) {
  // JUST the bonus logic, nothing else
  return <BonusForm employee={employee} amount={amount} />;
}

// Can be used in:
// - Split-screen chat UI (right panel)
// - Traditional full-page UI (with layout wrapper)
// - Mobile app
// - Embedded in another product
```

### 5. **Intent Registry: Mapping Language to Code**

The system needs a **registry** that maps intents to components:

```typescript
const INTENT_REGISTRY = {
  'issue_bonus': {
    component: IssueBonusTask,
    requiredEntities: ['employeeName', 'amount'],
    optionalEntities: ['reason', 'effectiveDate'],
    validation: {
      amount: (val) => val > 0 && val < 100000
    }
  },

  'give_raise': {
    component: GiveRaiseTask,
    requiredEntities: ['employeeName', 'percentage'],
    // ...
  }
};
```

This registry is used by:
- **Intent detection:** What entities to extract
- **UI rendering:** Which component to show
- **Validation:** What rules to apply
- **Conversation:** What questions to ask if data missing

---

## How AI Changes Software Design

### Traditional Software Design
```
Designer: "Where should we put this feature?"
Engineer: "Let's add it to the Settings menu"
User: *Has to remember it's in Settings*
```

### Intent-Driven Design
```
Designer: "What task is the user trying to accomplish?"
Engineer: "Build a task component for that intent"
User: "Just tells the system what they want"
```

**Key shift:** Design around **tasks users want to accomplish**, not **where to put UI elements in a navigation hierarchy**.

---

## Practical Design Patterns

### Pattern 1: Entity Extraction from Natural Language

**The LLM is your parser:**

Traditional parsing:
```javascript
// Regex, string splitting, custom parser
if (input.match(/give (\w+) (\d+) bonus/)) {
  // Fragile, breaks with variations
}
```

AI-based parsing:
```typescript
// Works with variations:
// "Give John a $5000 bonus"
// "I want to give John Doe a bonus of $5,000"
// "Can you add a 5k bonus for John?"
// "Bonus John $5000"

const entities = await detectIntent(userMessage);
// → { employeeName: "John Doe", amount: 5000, type: "bonus" }
```

**Use tool use (structured outputs) for reliability:**
```typescript
const tools = [{
  name: 'detect_compensation_intent',
  input_schema: {
    properties: {
      intent: { enum: ['issue_bonus', 'give_raise', ...] },
      entities: {
        employeeName: { type: 'string' },
        amount: { type: 'number' },  // Always a number, not string
        // ...
      }
    }
  }
}];

// LLM returns typed JSON, not free text
```

### Pattern 2: Handling Ambiguity

**When multiple interpretations exist, ask:**

```typescript
// User: "Give John a bonus"
// System finds: John Doe, John Smith, John Williams

if (matchingEmployees.length > 1) {
  chat.ask("I found multiple employees named John. Which one?",
    matchingEmployees.map(e => e.fullName)
  );

  // Wait for clarification before showing UI
}
```

**This is better than:**
- Guessing and being wrong
- Showing a search UI (breaks the flow)
- Requiring exact names up front

### Pattern 3: Context-Aware Defaults

**The LLM can infer reasonable defaults:**

```typescript
// User: "Give Sarah a raise"

// LLM can infer:
{
  intent: 'give_raise',
  entities: {
    employeeName: 'Sarah',
    amount: null,  // Not specified
    type: 'percentage'  // ← Inferred: raises are usually %
  }
}

// Chat asks: "What percentage raise?" (not "what amount")
// Because it inferred the user meant percentage
```

### Pattern 4: Multi-Turn Refinement

**Conversation can refine understanding over multiple turns:**

```
User: "I want to give bonuses to my team"

Chat: "Which team?"
User: "Engineering"

Chat: "How much per person?"
User: "$2000 each"

Chat: "Should this apply to everyone or specific people?"
User: "Everyone who joined this year"

→ Final intent:
{
  intent: 'bulk_issue_bonus',
  entities: {
    department: 'engineering',
    amount: 2000,
    filter: { hireDate: { gte: '2024-01-01' } }
  }
}

→ Shows preview:
"This will give $2000 bonuses to 15 employees (total: $30,000)"
```

### Pattern 5: Validation in Both Layers

**Conversation-level validation:**
```
User: "Give John a $500,000 bonus"

Chat: "That's unusual. Did you mean $50,000?
       Bonuses over $100k require board approval."
```

**UI-level validation:**
```tsx
<CurrencyInput
  value={amount}
  max={100000}
  warning={amount > 10000 ? "Requires VP approval" : null}
/>
```

Both layers protect against errors, but serve different purposes:
- Chat: Catches likely mistakes, provides context
- UI: Enforces hard rules, provides guardrails

---

## Evolution Path: From Simple to Sophisticated

### Phase 1: Navigation
**Intent:** Where do I find feature X?

```
User: "Where do I approve timesheets?"
→ Intent: navigate_to
→ UI: Shows path or deep link
```

**Value:** Reduces navigation overhead, helps new users

### Phase 2: Simple Actions
**Intent:** Do X for person Y

```
User: "Give John Doe a $5000 bonus"
→ Intent: issue_bonus
→ UI: Pre-filled form
```

**Value:** Reduces clicks, pre-fills known data

### Phase 3: Complex Actions with Context
**Intent:** Do X for Y with conditions

```
User: "Promote Sarah to Senior Engineer with a 15% raise"
→ Intent: promote_employee (composite)
→ UI: Multi-step wizard or comprehensive form
```

**Value:** Handles complex workflows, maintains context

### Phase 4: Bulk Operations
**Intent:** Do X for multiple entities

```
User: "Give $2000 bonuses to all engineers hired this year"
→ Intent: bulk_issue_bonus
→ UI: Preview + confirm for 15 employees
```

**Value:** Enables power user workflows, reduces repetition

### Phase 5: Workflows & Orchestration
**Intent:** Multi-step process

```
User: "Onboard the 5 new hires starting Monday"
→ Intent: batch_onboarding (workflow)
→ UI: Checklist with progress tracking
```

**Value:** Orchestrates complex multi-step processes

---

## Key Technical Decisions

### Why Tool Use (Structured Outputs)?

**Alternative 1: Free text parsing**
```typescript
const response = await claude.complete("Extract the bonus amount");
// Returns: "The bonus amount is $5000"
// Now you have to parse this string 😞
```

**Better: Tool use**
```typescript
const response = await claude.messages.create({
  tools: [bonusTool],
  // ...
});
// Returns: { amount: 5000 }  ← Already typed! 🎉
```

**Benefits:**
- Type safety (numbers are numbers, not strings)
- Reliable structure (always same shape)
- No parsing errors
- Validation at the schema level

### Why Zustand for State Management?

**Alternative: Redux**
- More boilerplate
- Overkill for this use case

**Alternative: React Context**
- Works but no persistence
- No middleware ecosystem

**Zustand:**
- Minimal API
- Built-in persistence
- No boilerplate
- Scales when needed

**For your use case:** Zustand is the sweet spot.

### Why Split-Screen vs. Modal/Overlay?

**Modal approach:**
```
User types → Modal pops up with form → User fills → Modal closes
```
Problems:
- Loses conversation context
- Can't reference previous messages
- Feels disconnected

**Split-screen approach:**
```
User types → Right panel updates → Conversation continues →
User can refer back to previous messages
```
Benefits:
- Context preserved
- Feels connected
- Can mix chat and form input

---

## Applying These Principles to Other Domains

This architecture isn't specific to HCM. It works for any domain with:

1. **Complex navigation** (users struggle to find features)
2. **Data-heavy tasks** (lots of form filling)
3. **Workflows** (multi-step processes)
4. **Power users** (people who know what they want)

**Examples:**

### E-commerce Admin
```
"Create a 20% off promotion for winter jackets, valid through January"
→ Promotion creation form pre-filled
```

### Healthcare
```
"Schedule a follow-up for patient John Doe in 2 weeks"
→ Appointment scheduler pre-filled
```

### Financial Services
```
"Transfer $5000 from checking to savings for account 1234"
→ Transfer form pre-filled, ready to confirm
```

### Project Management
```
"Create a task for Sarah to review the Q4 report by Friday"
→ Task form pre-filled
```

**Common pattern:**
1. User expresses intent in natural language
2. System extracts structured data
3. Shows appropriate UI component
4. Pre-fills with extracted data
5. User reviews and confirms

---

## Learning Resources for AI-Assisted Development

### Key Concepts to Understand

1. **Prompt Engineering**
   - How to write effective prompts
   - Few-shot learning (providing examples)
   - Chain-of-thought prompting

2. **Tool Use / Function Calling**
   - How LLMs can call functions
   - Structured output schemas
   - Validation and error handling

3. **Context Windows**
   - Token limits
   - Conversation history management
   - Summarization strategies

4. **Embeddings & RAG** (for future)
   - Semantic search
   - Retrieval-augmented generation
   - When to use vs. fine-tuning

### Mental Models for Working with LLMs

**LLMs are not deterministic functions:**
```javascript
// Traditional code
function extractName(input) {
  // Always returns same result for same input
  return input.match(/name: (\w+)/)[1];
}

// LLM-based extraction
async function extractName(input) {
  // Might return slightly different results
  // But structured outputs make it more reliable
  const result = await llm.extract(input, schema);
  return result.name;
}
```

**Design for variability:**
- Use structured outputs to constrain responses
- Validate LLM outputs before using them
- Provide fallbacks for low-confidence results
- Test with many variations of input

### Best Practices from This Project

1. **Start with tool use, not free text**
   - Structured outputs from day one
   - Easier to work with
   - More reliable

2. **Separate intent detection from response generation**
   - Run in parallel
   - Different prompts for different purposes
   - Intent detection: Extract structure
   - Response generation: Natural conversation

3. **Build validation at multiple levels**
   - LLM schema validation
   - Business logic validation
   - UI validation
   - All three working together

4. **Think in terms of entities and intents, not keywords**
   - Don't parse with regex
   - Let the LLM understand meaning
   - Focus on designing good schemas

---

## Next Steps

### Immediate
- [x] Build task management proof-of-concept
- [x] Implement auto-switch with countdown
- [x] Add persistence
- [ ] Document patterns (this document)
- [ ] Build one complex intent (e.g., issue_bonus)

### Short Term
- [ ] Load navigation JSON
- [ ] Implement navigate_to intent
- [ ] Test with real product navigation
- [ ] Gather feedback from users

### Medium Term
- [ ] Build 5-10 high-value task intents
- [ ] Create task component library
- [ ] Move API calls to backend
- [ ] Add authentication

### Long Term
- [ ] Scale to full product domain
- [ ] Implement workflow orchestration
- [ ] Add learning from user corrections
- [ ] Multi-language support

---

## Questions to Explore

As you build, consider:

1. **Confidence thresholds:** What level triggers auto-switch? (Currently 0.8)
2. **Countdown timing:** 3 seconds? Configurable per user?
3. **Entity validation:** When to validate? How to show errors?
4. **Missing entities:** Collect in chat vs. show empty form fields?
5. **Bulk operations:** How to preview? How to confirm?
6. **Undo/redo:** Can users undo actions done via chat?
7. **Audit trail:** How to log what happened and why?

---

## Conclusion

This architecture represents a fundamental shift in how enterprise software can work:

**From:** Navigate → Find → Fill → Submit
**To:** State intent → Review → Confirm

The key insight: **Users shouldn't navigate to features, they should describe outcomes.**

This document captures the principles. The code you build validates them. As you learn what works and what doesn't, update this document with new patterns and insights.

---

*Document created: 2024-11-25*
*Last updated: 2024-11-25*
