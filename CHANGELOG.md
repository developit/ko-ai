# ko-ai

## 0.2.2

### Patch Changes

- 7999f28: More resilient `send()`:

  - Malformed tool-call arguments no longer throw out of `send()`; the model gets an `{error}` tool result and can correct itself.
  - 429, 5xx and network errors are retried with exponential backoff (`retries`, default 2; `retryDelay`, default 500ms), honoring `Retry-After` (seconds). Thrown errors now carry the HTTP `status`.
  - New `maxToolRounds` option caps tool-call round trips per `send()`; the following request sends `tool_choice: "none"`.
  - Token usage is emitted as a typed `{type: 'usage', usage}` chunk in both API modes (it was previously never surfaced in responses mode); `agent()` usage tracking uses it.
  - Completions-mode history no longer sends the internal `streaming` field back to the API.
  - `@preact/signals-core` is now an optional peer dependency (only `ko-ai/agent-signals` needs it).
  - Smaller core (about 1.7 KB gzipped). Small behavior notes from that:
    - Custom `headers` now take precedence over the generated `authorization` header.
    - Finished tool calls carry no `streaming` field (absent, rather than `false`).
    - A streamed body that ends without `[DONE]` still flushes its final line.
  - The build now produces one file per entry point, with no hashed shared chunks. `ko-ai/agent` and `ko-ai/agent-signals` import `./index.js` and `./agent.js` directly.

## 0.2.1

### Patch Changes

- b807543: Fix publish missing built types

## 0.2.0

### Minor Changes

- 68cb919: Add Agent SDK (`ko-ai/agent`), Agent Signals (`ko-ai/agent-signals`), and Agent Tools (`ko-ai/agent-tools`) entry points. The Agent SDK provides a higher-level agentic loop with multi-turn tool-calling, usage tracking, context management, and steering. Agent Signals wraps it with Preact Signals reactivity for building reactive UIs. Agent Tools provides ready-made shell, read, write, and edit tools.

### Patch Changes

- 4ea0a67: Set up changesets for versioning and automated npm publishing via GitHub Actions
