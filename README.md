# Split-Screen Intent-Driven UI

A proof-of-concept demonstrating AI-powered intent detection with dynamic UI switching.

---

## 📚 Documentation Index

**New to this project? Start here:**

1. **[VISION.md](./VISION.md)** - Understanding the concept and principles *(Read this first!)*
2. **[LEARNING_PATH.md](./LEARNING_PATH.md)** - Structured learning guide *(Follow this to master the system)*
3. **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - Practical implementation patterns
4. **[AI_DEVELOPMENT_GUIDE.md](./AI_DEVELOPMENT_GUIDE.md)** - Mental models for AI development
5. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Deep technical reference

**Quick reference:**
- This file (README.md) - Quick start and running the app
- [SUMMARY.md](./SUMMARY.md) - What was built and current state

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Key

Your API key is already configured in `.env.local`. If you need to update it:

```bash
# .env.local
VITE_ANTHROPIC_API_KEY=your_api_key_here
```

### 3. Run Development Server

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## How It Works

### The Flow

1. **Type a message** in the left chat panel
2. **AI detects your intent** and extracts entities
3. **Context appears** in the right panel showing what was detected
4. **Auto-switch countdown** starts (3 seconds)
5. **Task UI opens** with pre-filled form
6. **Edit and submit** your task

### Try These Commands

- "Add a task to buy groceries by tomorrow"
- "I need to finish the Q4 report by Friday, high priority"
- "Show me my tasks"
- "Mark the report task as complete"

## Key Features

### ✅ Implemented

- **Intent Detection:** 3 intents (add_task, list_tasks, complete_task)
- **Entity Extraction:** Title, due date, priority, task identifier
- **Auto-Switch:** 3-second countdown with cancel option
- **Editable Forms:** Modify AI extractions before saving
- **Task Persistence:** Tasks saved to localStorage
- **Complete Task Flow:** Fuzzy matching to find and complete tasks
- **Error Handling:** Specific error messages for common issues

### 🎨 UX Patterns

1. **Progressive Disclosure:** Chat → Context → Task UI
2. **Transparency:** Show detected intent before auto-switch
3. **User Control:** Cancel auto-switch or open immediately
4. **AI as Assistant:** Pre-fill forms, let users edit
5. **State Persistence:** Tasks survive page refresh

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation including:

- State management patterns
- Intent detection system
- Dynamic panel architecture
- Scaling strategies
- Production considerations

## Project Structure

```
src/
├── components/
│   ├── ChatPanel.tsx       # Left panel - conversation
│   └── RightPanel.tsx      # Right panel - context + task UIs
├── services/
│   └── claude.ts           # Intent detection + Claude API
├── store/
│   └── index.ts            # Zustand state management
├── types/
│   └── index.ts            # TypeScript interfaces
├── App.tsx                 # Root component
└── main.tsx                # Entry point
```

## Tech Stack

- **React** 19 with TypeScript
- **Vite** for build tooling
- **Zustand** for state management (with persistence)
- **Anthropic Claude** for intent detection
- **Claude Sonnet 3.5** model

## Configuration

### Auto-Switch Timing

Currently hardcoded to 3 seconds. To adjust:

```typescript
// src/components/RightPanel.tsx
setAutoSwitchCountdown(3) // Change this number
```

### Confidence Threshold

Currently set to 0.8 (80%). To adjust:

```typescript
// src/components/RightPanel.tsx
if (confidence >= 0.8) // Lower for more auto-switches
```

## Development Notes

### API Key Security

⚠️ **Current setup is PROTOTYPE ONLY**

The API key is currently used in the browser with `dangerouslyAllowBrowser: true`. For production:

1. Move API calls to a backend proxy
2. Store API key in backend environment variables
3. Implement rate limiting
4. Add request caching

See ARCHITECTURE.md for production backend pattern.

### Adding New Intents

1. Add intent to tool definition in `src/services/claude.ts`
2. Add entities for the new intent
3. Update ChatPanel to map intent to UI type
4. Create UI component in RightPanel
5. Update TypeScript types

Example in ARCHITECTURE.md shows scaling to HCM domain with multiple intents.

## Testing

### Manual Testing Flow

1. **Add Task:**
   - Type: "Add a task to test the system by tomorrow"
   - Verify: Intent detected, countdown starts
   - Wait or click "Open Now"
   - Edit fields if needed
   - Click "Create Task"

2. **List Tasks:**
   - Type: "Show me my tasks"
   - Verify: Task list appears
   - Toggle completion with checkboxes

3. **Complete Task:**
   - Type: "Mark the test task as complete"
   - Verify: Matching tasks shown
   - Click task to complete

4. **Persistence:**
   - Refresh the page
   - Verify: Tasks still visible

### Edge Cases to Test

- Empty/ambiguous messages
- Very long task titles
- Invalid date formats
- Multiple tasks with similar names (complete_task)
- Network errors (disconnect wifi)
- Invalid API key

## Troubleshooting

### "Authentication failed"
- Check `.env.local` has correct API key
- Restart dev server after changing `.env.local`

### "Network error"
- Check internet connection
- Verify Anthropic API is accessible

### Tasks disappear on refresh
- Check browser console for localStorage errors
- Try clearing browser storage and restart

### Auto-switch not working
- Check console for errors
- Verify confidence is >= 0.8
- Ensure taskUIType is not 'none'

## Performance Notes

- Each message makes 2 parallel API calls (intent + response)
- localStorage has ~5MB limit (plenty for this use case)
- Consider conversation history trimming for long sessions

## Next Steps

See ARCHITECTURE.md "Next Steps for Production" section for roadmap.

Quick wins:
- [ ] Backend API proxy (security)
- [ ] Date parsing library (better date handling)
- [ ] Keyboard shortcuts (power users)
- [ ] Export tasks (data portability)
- [ ] Conversation history trimming (long sessions)

## License

MIT - Feel free to use this pattern in your projects!

## Questions?

This is a proof-of-concept for exploring intent-driven UI patterns. Feedback welcome!
