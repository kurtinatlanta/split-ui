# Backend Proxy Server Setup

This guide explains how to use the backend proxy server to securely connect to LLM providers.

## Why Use a Backend?

The backend proxy server solves several critical issues:

1. **Security**: API keys never exposed in browser code
2. **Bedrock Support**: AWS Bedrock SDK requires Node.js and cannot run in browsers
3. **Rate Limiting**: Easier to implement server-side controls
4. **Caching**: Can add response caching to reduce costs
5. **Production Ready**: Proper architecture for real applications

## Architecture

```
┌─────────────┐      HTTP       ┌──────────────┐      SDK      ┌─────────────┐
│   Browser   │ ────────────▶  │    Backend   │ ────────────▶ │  Anthropic  │
│  (React)    │                 │   (Express)  │               │  or Bedrock │
└─────────────┘                 └──────────────┘               └─────────────┘
  HttpProvider                    server/index.js               API Providers
```

## Quick Start

### 1. Configure Environment Variables

Edit your `.env.local` file:

```bash
# Set frontend to use HTTP provider
VITE_LLM_PROVIDER=http

# Configure which backend provider to use
# The backend will read these and connect to the appropriate service

# Option A: Use Anthropic Direct API
VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here
VITE_ANTHROPIC_MODEL=claude-sonnet-4-5-20250929

# Option B: Use AWS Bedrock (comment out Anthropic, uncomment these)
# VITE_AWS_ACCESS_KEY_ID=AKIA...
# VITE_AWS_SECRET_ACCESS_KEY=your_secret
# VITE_AWS_REGION=us-east-1
# VITE_BEDROCK_MODEL=anthropic.claude-sonnet-4-5-20250929-v1:0
```

### 2. Run Both Servers

**Option A: Run both in parallel** (recommended for development):
```bash
npm run dev:all
```

This starts both:
- Backend server on `http://localhost:3001`
- Frontend dev server on `http://localhost:5173`

**Option B: Run separately** (for debugging):

Terminal 1 (Backend):
```bash
npm run server
```

Terminal 2 (Frontend):
```bash
npm run dev
```

### 3. Open the App

Visit `http://localhost:5173` in your browser.

## How It Works

### Frontend (Browser)

The frontend uses `HttpProvider` which makes HTTP requests to your backend:

```typescript
// src/services/http-provider.ts
const response = await fetch('http://localhost:3001/api/detect-intent', {
  method: 'POST',
  body: JSON.stringify({ userMessage, conversationHistory, tools })
});
```

### Backend (Node.js)

The backend server (`server/index.js`):
1. Reads `VITE_LLM_PROVIDER` from `.env.local`
2. Initializes the appropriate SDK (Anthropic or Bedrock)
3. Exposes HTTP endpoints:
   - `GET /health` - Health check
   - `POST /api/detect-intent` - Intent detection
   - `POST /api/generate-response` - Response generation

## API Endpoints

### Health Check

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "ok",
  "provider": "anthropic",
  "model": "claude-sonnet-4-5-20250929",
  "timestamp": "2025-12-02T..."
}
```

### Detect Intent

```bash
curl -X POST http://localhost:3001/api/detect-intent \
  -H "Content-Type: application/json" \
  -d '{
    "userMessage": "Add a task to buy groceries",
    "conversationHistory": [],
    "tools": [...]
  }'
```

### Generate Response

```bash
curl -X POST http://localhost:3001/api/generate-response \
  -H "Content-Type: application/json" \
  -d '{
    "userMessage": "Hello",
    "conversationHistory": []
  }'
```

## Switching Between Providers

The backend automatically uses the provider specified in `.env.local`:

### To Use Anthropic:
```bash
# In .env.local
VITE_LLM_PROVIDER=anthropic  # Backend will use this
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

### To Use Bedrock:
```bash
# In .env.local
VITE_LLM_PROVIDER=bedrock  # Backend will use this
VITE_AWS_ACCESS_KEY_ID=AKIA...
VITE_AWS_SECRET_ACCESS_KEY=...
VITE_AWS_REGION=us-east-1
```

Restart the backend server after changing providers:
```bash
# Stop server (Ctrl+C), then restart
npm run server
```

## Configuration Options

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `VITE_LLM_PROVIDER` | Which provider backend uses | `anthropic` |
| `VITE_API_BASE_URL` | Backend URL (frontend) | `http://localhost:3001` |
| `SERVER_PORT` | Backend server port | `3001` |

### Custom Port

To run backend on a different port:

```bash
# .env.local
SERVER_PORT=4000
VITE_API_BASE_URL=http://localhost:4000
```

## Troubleshooting

### Frontend shows "Failed to fetch"

**Check:**
1. Is the backend server running? (`npm run server`)
2. Is it on the correct port? (check console output)
3. Does `VITE_API_BASE_URL` match the server URL?

**Fix:**
```bash
# Restart backend server
npm run server

# Check it's running
curl http://localhost:3001/health
```

### Backend shows "API key is required"

**Check:**
- `.env.local` has the correct API key for your provider
- You restarted the server after editing `.env.local`

**Fix:**
```bash
# Add API key to .env.local
VITE_ANTHROPIC_API_KEY=sk-ant-...

# Restart server
npm run server
```

### Backend shows "Unknown provider"

**Check:**
- `VITE_LLM_PROVIDER` is set to `anthropic` or `bedrock` (not `http`)
- The value is spelled correctly

**Fix:**
```bash
# In .env.local
VITE_LLM_PROVIDER=anthropic  # or bedrock
```

### CORS Errors

The backend has CORS enabled for all origins. If you still see CORS errors:

1. Check backend is actually running
2. Verify you're making requests to the correct URL
3. Check browser console for the actual error

## Production Deployment

For production, you'll want to:

### 1. Deploy Backend Separately

Deploy `server/index.js` to:
- AWS Lambda + API Gateway
- Railway, Render, or similar
- Your own server (EC2, DigitalOcean, etc.)

### 2. Update Frontend Config

```bash
# .env.production
VITE_LLM_PROVIDER=http
VITE_API_BASE_URL=https://your-api.example.com
```

### 3. Add Security

```javascript
// server/index.js additions:

// 1. Restrict CORS to your domain
app.use(cors({
  origin: 'https://your-app.example.com'
}));

// 2. Add rate limiting
import rateLimit from 'express-rate-limit';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// 3. Add authentication
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

### 4. Environment Variables

Set these in your deployment platform:
- `VITE_LLM_PROVIDER` - `anthropic` or `bedrock`
- `VITE_ANTHROPIC_API_KEY` - Your Anthropic key
- OR `VITE_AWS_ACCESS_KEY_ID`, `VITE_AWS_SECRET_ACCESS_KEY`, `VITE_AWS_REGION` for Bedrock

## Advanced Usage

### Adding Request Caching

```javascript
// server/index.js
const cache = new Map();

app.post('/api/detect-intent', async (req, res) => {
  const cacheKey = JSON.stringify(req.body);

  if (cache.has(cacheKey)) {
    return res.json(cache.get(cacheKey));
  }

  // ... make API call
  cache.set(cacheKey, result);
  res.json(result);
});
```

### Adding Logging

```javascript
// server/index.js
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.File({ filename: 'server.log' })]
});

app.post('/api/detect-intent', async (req, res) => {
  logger.info('Intent detection request', {
    message: req.body.userMessage,
    timestamp: new Date().toISOString()
  });
  // ...
});
```

### Adding Metrics

```javascript
// server/index.js
let requestCount = 0;
let totalTokens = 0;

app.get('/metrics', (req, res) => {
  res.json({
    requestCount,
    totalTokens,
    avgTokensPerRequest: totalTokens / requestCount
  });
});
```

## Questions?

The backend server is a simple Express app. Feel free to modify `server/index.js` to add:
- Authentication
- Rate limiting
- Caching
- Logging
- Custom middleware
- Additional endpoints
