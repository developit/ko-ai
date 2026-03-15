<img src="https://github.com/developit/ko-ai/raw/refs/heads/claude/plan-agent-sdk-frCcz/fixtures/koai.png" width="128" height="128">

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

## Agent SDK

`ko-ai/agent` is a higher-level agentic loop built on the base client. It manages multi-turn tool-calling workflows, usage tracking, and context control.

```js
import agent from 'ko-ai/agent';
import { allTools } from 'ko-ai/agent-tools';

const a = agent({
  apiKey: 'sk-...',
  model: 'gpt-4o-mini',
  instructions: 'You are a helpful coding assistant.',
  tools: allTools,
  cwd: '/my/project',
});

for await (const event of a.prompt('List the files in src/')) {
  if (event.type === 'text') process.stdout.write(event.text);
  if (event.type === 'tool_result') console.log('Tool:', event.result);
}

// Multi-turn — history is preserved automatically
for await (const event of a.prompt('Now read the main entry point')) {
  if (event.type === 'text') process.stdout.write(event.text);
}

// Check accumulated token usage
console.log(a.usage); // { input_tokens, output_tokens, total_tokens }
```

### onToolCall Middleware

Wrap tool calls to add logging, modify args, or skip execution:

```js
const a = agent({
  // ...
  tools: allTools,
  onToolCall: async (name, args, call) => {
    console.log(`Calling ${name}`, args);
    if (name === 'shell' && args.command.includes('rm ')) {
      return { error: 'Destructive commands are not allowed' };
    }
    return call(args);
  },
});
```

### Steering and Follow-ups

```js
// Inject context into the current turn (before the next LLM call)
a.steer('Remember: always use TypeScript, never JavaScript.');

// Queue another prompt to run after the current one completes
a.queueFollowUp('Now write tests for that code.');
```

### Context Management

Use `transformContext` to keep the conversation history from growing unbounded:

```js
import agent, { truncateContext } from 'ko-ai/agent';

const a = agent({
  // ...
  transformContext: truncateContext(20), // keep system + last 19 messages
});
```

### Agent API

```ts
import agent, { truncateContext } from 'ko-ai/agent';

export default function agent(config: AgentConfig): Agent

interface AgentConfig {
  // All base client options (apiKey, baseURL, model, instructions, etc.) plus:
  tools?: Tool[];
  maxTurns?: number;                    // Max LLM round-trips per prompt() (default: Infinity)
  cwd?: string;                         // Working directory for file-based tools
  transformContext?: (messages: any[]) => any[];
  onToolCall?: (name: string, args: object, call: (args: object) => Promise<unknown>) => unknown;
  signal?: AbortSignal;
}

interface Agent {
  prompt(input: string, overrides?: Partial<AgentConfig>): AsyncIterableIterator<AgentEvent>;
  steer(message: string): void;         // Inject context before next LLM call
  queueFollowUp(input: string): void;   // Queue a follow-up prompt
  abort(): void;
  usage: AgentUsage;                    // Accumulated { input_tokens, output_tokens, total_tokens }
  session: ChatSession;                 // Underlying ko-ai session
}

type AgentEvent =
  | { type: 'agent_start' }
  | { type: 'turn_start'; turn: number }
  | StreamChunk                         // text, reasoning, tool_call, tool_result, done
  | { type: 'turn_end'; turn: number }
  | { type: 'agent_end' }
  | { type: 'error'; error: unknown };

function truncateContext(maxMessages: number): (msgs: any[]) => any[];
```

## Agent Tools

`ko-ai/agent-tools` provides ready-made tools for common agent tasks. Node.js only.

```js
import { shellTool, readFileTool, writeFileTool, editFileTool, allTools } from 'ko-ai/agent-tools';

// Use all tools
const a = agent({ tools: allTools, ... });

// Or pick individual ones
const a = agent({ tools: [shellTool, readFileTool], ... });
```

| Tool | Name | Description |
|---|---|---|
| `shellTool` | `shell` | Execute a shell command. Returns `{stdout, stderr, exitCode}`. |
| `readFileTool` | `read_file` | Read a file (up to 100KB). Returns `{path, content}`. |
| `writeFileTool` | `write_file` | Write/create a file. Returns `{path, bytes}`. |
| `editFileTool` | `edit_file` | Find-and-replace a unique string in a file. Returns `{path, replaced}`. |

When `cwd` is set on the agent, relative paths passed to these tools are resolved against it, and the shell tool runs in that directory.

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
