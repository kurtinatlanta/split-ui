# AI-Assisted Development: Mental Models and Patterns

**For experienced developers learning to integrate AI into applications**

This guide focuses on the **mental shifts** required when working with AI, especially LLMs like Claude. It's written for someone with deep software engineering experience who's new to AI development.

---

## Table of Contents

1. [Fundamental Mental Shifts](#fundamental-mental-shifts)
2. [LLMs Are Not Traditional Functions](#llms-are-not-traditional-functions)
3. [Prompt Engineering Basics](#prompt-engineering-basics)
4. [Structured Outputs vs Free Text](#structured-outputs-vs-free-text)
5. [Working with Uncertainty](#working-with-uncertainty)
6. [Token Economics](#token-economics)
7. [When to Use AI vs Traditional Code](#when-to-use-ai-vs-traditional-code)
8. [Debugging AI Systems](#debugging-ai-systems)

---

## Fundamental Mental Shifts

### From: Deterministic → Probabilistic

**Traditional code:**
```javascript
function extractName(input) {
  return input.match(/Name: (\w+)/)[1];
}

// Always returns same result for same input
extractName("Name: John");  // → "John"
extractName("Name: John");  // → "John" (always)
```

**AI-based extraction:**
```typescript
async function extractName(input) {
  const result = await llm.extract(input, schema);
  return result.name;
}

// Might return slightly different results
await extractName("Name: John");  // → "John"
await extractName("Name: John");  // → "John" (probably, but not guaranteed)
```

**Key insight:** LLMs are non-deterministic. Same input can produce slightly different outputs. Design for this variability.

### From: Parsing → Understanding

**Traditional approach (regex/parsing):**
```javascript
// Fragile, breaks with variations
const pattern = /give (\w+) (\d+) bonus/;
const match = input.match(pattern);

// Works: "give John 5000 bonus"
// Breaks: "I want to give John a $5000 bonus"
// Breaks: "Bonus for John: $5,000"
```

**AI approach (semantic understanding):**
```typescript
// Flexible, handles variations
const result = await llm.extract(input, {
  intent: 'issue_bonus',
  entities: { employeeName: 'string', amount: 'number' }
});

// All of these work:
// "give John 5000 bonus"
// "I want to give John a $5000 bonus"
// "Bonus for John: $5,000"
// "Can you add a 5k bonus for John Doe"
```

**Key insight:** Stop thinking about pattern matching. Think about meaning extraction.

### From: Exact Matching → Semantic Matching

**Traditional:**
```javascript
if (command === "delete") {
  performDelete();
}

// Must match exactly: "delete"
// Won't match: "remove", "erase", "get rid of"
```

**AI-based:**
```typescript
const intent = await detectIntent(userInput);

if (intent.name === 'delete') {
  performDelete();
}

// Matches semantic intent:
// "delete" → delete
// "remove this" → delete
// "get rid of it" → delete
// "trash it" → delete
```

**Key insight:** Users don't need to learn your command syntax. The AI learns their language.

---

## LLMs Are Not Traditional Functions

### Characteristics to Understand

#### 1. Context Windows

LLMs have **token limits** - a maximum amount of text they can process at once.

```typescript
// Bad: Sending entire conversation history
const history = allMessages;  // Could be 10,000 messages
await llm.process(history);  // 💥 Exceeds context window

// Good: Windowing
const recentHistory = allMessages.slice(-20);  // Last 20 messages
await llm.process(recentHistory);  // ✅ Fits in context
```

**Rule of thumb:**
- Sonnet 4.5: ~200k tokens (~150k words)
- Don't send more than you need
- Summarize old messages if needed

#### 2. Latency

LLMs are **slower than traditional functions**.

```typescript
// Traditional function: microseconds
const result = parseString(input);  // < 1ms

// LLM call: seconds
const result = await llm.parse(input);  // 1-5 seconds
```

**Strategies:**
- Show loading states
- Use optimistic updates
- Run multiple calls in parallel when possible
- Cache results

**Example:**
```typescript
// Sequential (slow): ~6 seconds total
const intent = await detectIntent(message);     // 3 seconds
const response = await generateResponse(message); // 3 seconds

// Parallel (fast): ~3 seconds total
const [intent, response] = await Promise.all([
  detectIntent(message),      // Both run simultaneously
  generateResponse(message)
]);
```

#### 3. Cost

Every API call has a **monetary cost** (based on tokens processed).

**Rough costs (Claude Sonnet 4.5):**
- Input: $3 per million tokens
- Output: $15 per million tokens

**Example calculation:**
```
User message: 50 tokens
Conversation history: 500 tokens
Prompt: 200 tokens
Response: 100 tokens

Cost per interaction:
= (750 input tokens × $3/M) + (100 output tokens × $15/M)
= $0.00225 + $0.0015
= ~$0.004 per message

1000 messages/day = $4/day = ~$120/month
```

**Optimization strategies:**
- Cache responses when possible
- Don't send unnecessary context
- Use smaller models for simple tasks (if available)
- Batch operations when feasible

#### 4. Non-Determinism

Same input can produce different outputs.

```typescript
// May return slightly different results each time
await llm.extract("Give John a bonus");
// Run 1: { amount: null, reason: "not specified" }
// Run 2: { amount: null, reason: null }
// Run 3: { amount: 0, reason: "" }
```

**How to handle:**
- Use structured outputs (tool use) to constrain variability
- Validate outputs before using them
- Don't rely on exact string matching in responses
- Test with many runs, not just one

---

## Prompt Engineering Basics

The prompt is your "source code" when working with LLMs. Well-crafted prompts produce better results.

### Anatomy of a Good Prompt

```typescript
const prompt = `
[1. Context]
You are analyzing user messages for an HR management system.

[2. Task]
Detect the user's intent and extract relevant entities.

[3. Input]
User message: "${userMessage}"

[4. Instructions]
Identify if the user wants to:
- issue_bonus: Give an employee a one-time bonus
- give_raise: Increase an employee's base salary
- navigate_to: Find a feature in the system

[5. Output Format]
Return structured data with:
- intent (one of the above)
- confidence (0-1 score)
- entities (relevant data extracted)

[6. Examples] (optional but helpful)
Example: "Give John a $5000 bonus"
→ intent: issue_bonus
→ entities: { employeeName: "John", amount: 5000 }

[7. Constraints]
Only return confidence > 0.7 if you're reasonably certain.
`;
```

### Prompting Patterns

#### Pattern 1: Few-Shot Learning

Provide examples to guide the LLM:

```typescript
const prompt = `
Extract employee name and amount from these examples:

Example 1:
Input: "Give John a $5000 bonus"
Output: { name: "John", amount: 5000 }

Example 2:
Input: "I want to give Sarah Chen a bonus of $10,000"
Output: { name: "Sarah Chen", amount: 10000 }

Now extract from:
Input: "${userMessage}"
Output:
`;
```

**When to use:** Complex extraction tasks, specific format requirements

#### Pattern 2: Chain-of-Thought

Ask the LLM to explain its reasoning:

```typescript
const prompt = `
Analyze this message step by step:

Message: "${userMessage}"

1. What is the user trying to do?
2. What information did they provide?
3. What information is missing?
4. What is your confidence level (0-1)?

Based on your analysis, extract the intent and entities.
`;
```

**When to use:** Complex decisions, debugging why LLM chose an answer

#### Pattern 3: Role-Playing

Give the LLM a role to guide behavior:

```typescript
const systemPrompt = `
You are an expert HR assistant who helps users accomplish tasks in an HR system.
You are:
- Precise: Extract data accurately
- Helpful: Ask clarifying questions when needed
- Professional: Use appropriate business language
- Cautious: Don't make assumptions about missing data
`;
```

**When to use:** Setting tone, establishing constraints

### Improving Prompts Iteratively

1. **Start simple:**
   ```
   "Extract the employee name and amount from: [message]"
   ```

2. **Add structure when needed:**
   ```
   "Extract employee name (string) and amount (number, no symbols)..."
   ```

3. **Add examples if results vary:**
   ```
   "Examples:
    'John $5k' → {name: 'John', amount: 5000}
    '5000 for Sarah' → {name: 'Sarah', amount: 5000}"
   ```

4. **Add constraints if needed:**
   ```
   "Only return amounts between $0 and $100,000.
    If amount is unclear, return null."
   ```

**Testing prompts:**
- Try many variations of input
- Check edge cases
- Look for patterns in failures
- Refine prompt based on errors

---

## Structured Outputs vs Free Text

### The Problem with Free Text

**Asking for free text:**
```typescript
const prompt = "What is the bonus amount in this message: 'Give John $5000'";
const response = await llm.complete(prompt);

// Response might be:
// "The bonus amount is $5000"
// "5000 dollars"
// "$5,000"
// "Five thousand dollars"

// Now you have to parse THIS 😫
```

### The Solution: Tool Use (Structured Outputs)

**Define the exact structure you want:**

```typescript
const tools = [{
  name: 'extract_bonus_data',
  input_schema: {
    type: 'object',
    properties: {
      amount: {
        type: 'number',
        description: 'Bonus amount as a number (no symbols)'
      },
      employeeName: {
        type: 'string',
        description: 'Employee full name'
      }
    },
    required: ['amount', 'employeeName']
  }
}];

const response = await client.messages.create({
  tools,
  messages: [{ role: 'user', content: 'Give John $5000' }]
});

// Response is typed JSON:
// { amount: 5000, employeeName: "John" }
// ✅ No parsing needed!
```

### Why Structured Outputs Are Better

1. **Type safety:** Numbers are numbers, booleans are booleans
2. **No parsing:** Direct access to data
3. **Validation:** Schema defines what's valid
4. **Reliability:** Consistent structure every time
5. **Tooling:** TypeScript can type-check

**Rule:** Always use structured outputs (tool use) when you need data from the LLM.

---

## Working with Uncertainty

AI introduces uncertainty into your system. Design for it.

### Confidence Scoring

Always extract a confidence score and act on it:

```typescript
const result = await detectIntent(message);

if (result.confidence < 0.5) {
  // Very uncertain - ask user to rephrase
  return "I'm not sure what you mean. Could you rephrase?";
}

if (result.confidence < 0.8) {
  // Somewhat uncertain - confirm before acting
  return `Did you mean to ${result.intent}? (Yes/No)`;
}

// High confidence - proceed
performAction(result.intent);
```

**Thresholds to consider:**
- < 0.5: Ignore or ask to rephrase
- 0.5 - 0.7: Show options for user to choose
- 0.7 - 0.8: Proceed but don't auto-execute
- \> 0.8: Proceed with auto-execution (with countdown/cancel option)

### Handling Ambiguity

**When multiple interpretations exist:**

```typescript
const result = await detectIntent("Give John a bonus");

// Check if entity is ambiguous
if (result.entities.employeeName === "John") {
  const matches = await findEmployees("John");

  if (matches.length > 1) {
    // Multiple Johns - ask for clarification
    return {
      type: 'clarification_needed',
      question: 'I found multiple employees named John:',
      options: matches.map(e => `${e.name} (${e.department})`)
    };
  }
}
```

### Graceful Degradation

Always have a fallback:

```typescript
try {
  const intent = await detectIntent(message);

  if (intent) {
    // AI path: intent-driven UI
    return showTaskUI(intent);
  } else {
    // Fallback: traditional search
    return showSearchResults(message);
  }

} catch (error) {
  // Error fallback: basic UI
  return showManualForm();
}
```

**Principle:** AI enhances UX, but the system should work without it.

---

## Token Economics

Understanding tokens helps you optimize costs and performance.

### What Are Tokens?

Tokens are pieces of text the LLM processes. Roughly:
- 1 token ≈ 4 characters
- 1 token ≈ 0.75 words
- 100 tokens ≈ 75 words

**Examples:**
```
"Hello" = 1 token
"Hello world" = 2 tokens
"I want to give John Doe a $5000 bonus" = ~10 tokens
```

### Measuring Token Usage

```typescript
const response = await client.messages.create({...});

console.log('Input tokens:', response.usage.input_tokens);
console.log('Output tokens:', response.usage.output_tokens);

// Track over time
totalInputTokens += response.usage.input_tokens;
totalOutputTokens += response.usage.output_tokens;
```

### Optimization Strategies

#### 1. Don't Send Unnecessary Context

**Bad:**
```typescript
// Sending entire conversation (1000s of messages)
const context = allMessages.join('\n');
await llm.process(context + currentMessage);
// 💰 Expensive! 💰
```

**Good:**
```typescript
// Only recent relevant messages
const context = allMessages.slice(-10).join('\n');
await llm.process(context + currentMessage);
// ✅ Much cheaper
```

#### 2. Cache When Possible

```typescript
// Cache intent detection results
const cache = new Map();

async function detectIntentCached(message) {
  if (cache.has(message)) {
    return cache.get(message);
  }

  const result = await detectIntent(message);
  cache.set(message, result);
  return result;
}
```

#### 3. Batch Similar Requests

**Instead of:**
```typescript
for (const employee of employees) {
  await processEmployee(employee);  // N API calls
}
```

**Try:**
```typescript
// One API call with all employees
await processBatch(employees);
```

---

## When to Use AI vs Traditional Code

Not everything needs AI. Use the right tool for the job.

### Use AI For:

✅ **Natural language understanding**
```
User: "I want to give Sarah a raise"
→ AI extracts: intent=give_raise, employee=Sarah
```

✅ **Flexible input parsing**
```
"$5000" vs "5k" vs "five thousand dollars"
→ AI normalizes to: 5000
```

✅ **Semantic matching**
```
"delete" vs "remove" vs "get rid of" vs "trash"
→ AI maps to same intent
```

✅ **Context-aware decisions**
```
History: "Show me John Doe's profile"
Current: "Give him a raise"
→ AI infers "him" = "John Doe"
```

### Use Traditional Code For:

❌ **Deterministic operations**
```javascript
// Don't use AI for math
const total = amount + tax;  // Just use code

// Don't use AI for lookups
const user = users.find(u => u.id === userId);  // Use code
```

❌ **Real-time requirements**
```javascript
// Don't use AI for instant feedback
input.addEventListener('keypress', validate);  // Too slow
```

❌ **High-frequency operations**
```javascript
// Don't use AI in tight loops
for (let i = 0; i < 10000; i++) {
  // await llm.process(...)  // ❌ Too expensive
}
```

❌ **Exact matching**
```javascript
// Don't use AI for exact equality
if (password === stored) { ... }  // Must be exact
```

### Hybrid Approach (Often Best)

Combine AI and traditional code:

```typescript
// 1. AI extracts intent and entities
const { intent, entities } = await detectIntent(message);

// 2. Traditional code validates
if (entities.amount < 0 || entities.amount > 100000) {
  return error('Amount out of range');
}

// 3. Traditional code executes
const result = await database.insert({
  employee: entities.employeeName,
  amount: entities.amount
});

// 4. AI generates response
const response = await llm.summarize(result);
```

---

## Debugging AI Systems

Debugging non-deterministic systems requires different techniques.

### Logging is Critical

Log everything:

```typescript
async function detectIntent(message) {
  console.log('[Intent Detection] Input:', message);

  const response = await client.messages.create({...});

  console.log('[Intent Detection] Raw response:', response);
  console.log('[Intent Detection] Tokens:', response.usage);

  const intent = extractIntent(response);

  console.log('[Intent Detection] Parsed intent:', intent);

  return intent;
}
```

### Test with Variations

Don't just test one input. Test many:

```typescript
const testCases = [
  "Give John a bonus",
  "I want to give John Doe a $5000 bonus",
  "Bonus for John: $5,000",
  "Can you add a 5k bonus for John?",
  "John needs a bonus of five thousand",
  // Edge cases
  "Give bonus",  // Missing name
  "Give John",   // Missing amount
  "Bonus",       // Missing both
];

for (const input of testCases) {
  const result = await detectIntent(input);
  console.log(input, '=>', result);
}
```

### Use the Anthropic Workbench

Test prompts in the workbench before coding:
1. Go to console.anthropic.com
2. Try your prompt with various inputs
3. Iterate on prompt until it works
4. Then implement in code

### Version Control Your Prompts

Treat prompts like code:

```typescript
// v1 - too vague
const PROMPT_V1 = "Extract the data";

// v2 - more specific
const PROMPT_V2 = "Extract employee name and amount";

// v3 - with examples
const PROMPT_V3 = `
Extract employee name and amount.

Examples:
"John $5k" → {name: "John", amount: 5000}
`;

// Use versioning
const CURRENT_PROMPT = PROMPT_V3;
```

### A/B Test Different Approaches

Try multiple strategies and measure:

```typescript
// Strategy A: Direct extraction
const resultA = await extractDirect(message);

// Strategy B: Multi-step extraction
const resultB = await extractMultiStep(message);

// Compare accuracy
logComparison(resultA, resultB, expectedResult);
```

---

## Key Takeaways

### For Traditional Software Engineers Learning AI

1. **Embrace uncertainty:** AI is probabilistic, not deterministic
2. **Use structured outputs:** Always prefer tool use over free text
3. **Validate everything:** Don't trust LLM outputs blindly
4. **Design for failure:** Have fallbacks and error handling
5. **Think in prompts:** Your "code" is often the prompt
6. **Test extensively:** One test case isn't enough
7. **Monitor costs:** Tokens = money, optimize usage
8. **Combine with traditional code:** AI + code is often better than AI alone

### AI Doesn't Replace Engineering

AI is a tool, like a database or API. Good software engineering still matters:

- **Architecture:** How components connect
- **State management:** How data flows
- **Error handling:** What happens when things fail
- **Testing:** Ensuring correctness
- **Performance:** Speed and efficiency
- **Security:** Protecting user data

AI adds a new dimension: **natural language understanding**. But the fundamentals remain.

---

## Further Learning

### Recommended Reading

1. **Anthropic Documentation:**
   - https://docs.anthropic.com/claude/docs
   - Especially: Prompt engineering, tool use

2. **OpenAI Prompt Engineering Guide:**
   - Good general principles (applies to Claude too)

3. **LangChain Documentation:**
   - Patterns for chaining LLM calls (if you need complex workflows)

### Practice Projects

Start simple and build up:

1. **Simple extraction:** Extract name and amount from text
2. **Intent classification:** Categorize user messages
3. **Multi-turn conversation:** Build context over messages
4. **Entity resolution:** Handle ambiguity (multiple Johns)
5. **Complex workflows:** Chain multiple intents together

### Experimentation

The best way to learn is to build and iterate:

1. Pick a simple use case
2. Build it with AI
3. Test with many inputs
4. Find where it breaks
5. Refine and improve
6. Repeat

---

*This guide will evolve as you learn. Update it with your discoveries.*

---

*Document created: 2024-11-25*
