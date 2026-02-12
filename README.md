<img src="https://gist.github.com/user-attachments/assets/05ae0dc6-7a0c-4313-9f81-8b0c0d5f567c" width="128" height="128">

# ko-ai (小AI)

A minimalist, zero-dependency OpenAI-compatible streaming client with automatic tool calling.

## Features

- **~1.5KB gzipped** - Zero dependencies
- **Multi-turn conversations** - Stateful chat sessions with persistent history
- **Dual API support** - Responses (default) and Completions modes
- **Streaming** - Async generator with typed chunks
- **Tool calling** - Inline handlers or callback dispatch

## Usage

```js
import ai from 'ko-ai';

// Create a chat session
const chat = ai({
  apiKey: 'sk-...',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
});

// Single turn
for await (const chunk of chat.send('Hello!')) {
  if (chunk.type === 'text') console.log(chunk.text);
}

// Multi-turn conversation
for await (const chunk of chat.send('What did I just say?')) {
  if (chunk.type === 'text') console.log(chunk.text);
}
```

### Tool Calling

Tools can have inline `call` handlers that run automatically:

```js
const chat = ai({
  apiKey: 'sk-...',
  model: 'gpt-4o-mini',
  tools: [
    {
      type: 'function',
      name: 'get_weather',
      description: 'Get weather for a city',
      parameters: {
        type: 'object',
        properties: {location: {type: 'string'}},
        required: ['location'],
      },
      call: ({location}) => ({temp: 72, location}),
    },
  ],
});

for await (const chunk of chat.send('Weather in Tokyo?')) {
  if (chunk.type === 'text') console.log(chunk.text);
  if (chunk.type === 'tool_result') console.log('Tool returned:', chunk.result);
}
```

Or use `onToolCall` for dynamic dispatch:

```js
const chat = ai({
  apiKey: 'sk-...',
  model: 'gpt-4o-mini',
  tools: [{type: 'function', name: 'calc', description: 'Calculate', parameters: {...}}],
  onToolCall: (name, args) => eval(args.expr),
});

for await (const chunk of chat.send('Calculate 5 + 3')) {
  // ...
}
```

### API Modes

```js
ai({ mode: 'responses', ... })  // Modern Responses API (default)
ai({ mode: 'completions', ... }) // Legacy Completions API
```

## API

```ts
export default function ai(config: Config): ChatSession

interface Config {
  apiKey: string;
  baseURL: string;
  model: string;
  instructions?: string;        // System prompt
  tools?: Tool[];
  onToolCall?: (name: string, args: object) => unknown;
  mode?: 'responses' | 'completions';  // default: 'responses'
  temperature?: number;
  max_output_tokens?: number;
  reasoning?: { effort?: string; enabled?: boolean };
  headers?: Record<string, string>;
}

interface ChatSession {
  send(input: string | any[], overrides?: Partial<Config>): AsyncIterableIterator<StreamChunk>;
  messages: any[];      // Message history (completions mode)
  conversation: any[];  // Conversation history (responses mode)
}

type StreamChunk =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool_call'; id: string; function: { name: string; arguments: string }; streaming: boolean }
  | { type: 'tool_result'; id: string; function: {...}; result: unknown }
  | { type: 'done' };
```

## Size

| Metric      | Size       |
| ----------- | ---------- |
| Minified    | 3.1 KB     |
| **Gzipped** | **1.5 KB** |

## Testing

Tests use [nock](https://github.com/nock/nock) for record/replay of HTTP fixtures. All fixtures are organized by API mode and committed to git, enabling fast offline testing.

### Running Tests

```bash
# Run tests with recorded fixtures (no API calls, works offline)
npm test

# Validate fixture integrity
npm run test:validate

# Watch mode
npm run test:watch
```

### Recording Fixtures

```bash
# Record all fixtures (requires OpenRouter API key)
KOAI_TEST_MODE=record OPENROUTER_API_KEY=your-key npm test

# Or use the shortcut
OPENROUTER_API_KEY=your-key npm run test:record

# Re-record specific tests only
KOAI_UPDATE_FIXTURES="text-generation-responses,streaming-completions" OPENROUTER_API_KEY=your-key npm test

# Auto mode: record missing fixtures, replay existing ones
KOAI_TEST_MODE=auto OPENROUTER_API_KEY=your-key npm test
```

### Fixture Organization

Fixtures are organized by API mode in the `fixtures/` directory:

```
fixtures/
├── responses-api/        # Responses API mode fixtures
├── completions-api/      # Completions API mode fixtures
├── edge-cases/           # Error handling and edge case fixtures
└── metadata.json         # Fixture metadata (timestamps, checksums)
```

Each test has its own fixture file, making it easy to:
- Review API interactions in pull requests
- Debug specific test failures
- Update stale fixtures selectively
- Track when fixtures were last recorded

## License

MIT
