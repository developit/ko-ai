# koai (小AI)

A minimalist, zero-dependency OpenAI-compatible streaming client with automatic tool calling.

## Features

- **~1.3KB gzipped** - Zero dependencies
- **Dual API support** - Responses (default) and Completions modes
- **Streaming** - Async generator with typed chunks
- **Tool calling** - Inline handlers or callback dispatch

## Usage

```js
import ai from 'koai';

// Stream text
for await (const chunk of ai({
  apiKey: 'sk-...',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  input: 'Hello!',
})) {
  if (chunk.type === 'text') console.log(chunk.text);
}
```

### Tool Calling

Tools can have inline `call` handlers that run automatically:

```js
const tools = [
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
];

for await (const chunk of ai({...config, input: 'Weather in Tokyo?', tools})) {
  if (chunk.type === 'text') console.log(chunk.text);
  if (chunk.type === 'tool_result') console.log('Tool returned:', chunk.result);
}
```

Or use `onToolCall` for dynamic dispatch:

```js
for await (const chunk of ai({
  ...config,
  input: 'Calculate 5 + 3',
  tools: [{type: 'function', name: 'calc', description: 'Calculate', parameters: {...}}],
  onToolCall: (name, args) => eval(args.expr),
})) { ... }
```

### API Modes

```js
ai({ mode: 'responses', ... })  // Modern Responses API (default)
ai({ mode: 'completions', ... }) // Legacy Completions API
```

## API

```ts
export default function ai(options: Options): AsyncIterableIterator<StreamChunk>

interface Options {
  apiKey: string;
  baseURL: string;
  model?: string;
  input: string;
  instructions?: string;        // System prompt
  tools?: Tool[];
  onToolCall?: (name: string, args: object) => unknown;
  mode?: 'responses' | 'completions';
  temperature?: number;
  max_output_tokens?: number;
  headers?: Record<string, string>;
}

type StreamChunk =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; id: string; function: { name: string; arguments: string } }
  | { type: 'tool_result'; id: string; function: {...}; result: unknown }
  | { type: 'done' };
```

## Size

| Metric      | Size        |
| ----------- | ----------- |
| Minified    | 2.5 KB      |
| **Gzipped** | **1.26 KB** |

## License

MIT
