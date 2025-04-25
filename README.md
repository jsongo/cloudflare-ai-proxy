# DeepSeek API on Cloudflare Workers

This project implements a standard DeepSeek API interface using Cloudflare Workers. It provides API endpoints compatible with the OpenAI format, allowing you to use the DeepSeek AI models through a familiar interface.

## Features

- Compatible with OpenAI API format
- Supports both streaming and non-streaming responses
- Implements the `/chat/completions` endpoint
- Supports multiple DeepSeek models

## API Endpoints

### Chat Completions

```
POST /chat/completions
POST /v1/chat/completions
```

Request format:

```json
{
  "model": "deepseek-chat",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "stream": false,
  "max_tokens": 512,
  "temperature": 0.7
}
```

Available models:
- `deepseek-chat` - DeepSeek V3 model
- `deepseek-reasoner` - DeepSeek R1 model

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Deploy to Cloudflare
pnpm deploy
```

## Testing

You can test the API using curl:

```bash
curl http://localhost:8787/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-reasoner",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": false
  }'
```

For streaming responses:

```bash
curl http://localhost:8787/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-reasoner",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": true
  }'
```

## Demo

A demo endpoint is available at the root path (`/` or `/demo`) that demonstrates streaming responses.
