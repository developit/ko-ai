---
"ko-ai": patch
---

More resilient `send()`:

- Malformed tool-call arguments no longer throw out of `send()`; the model gets an `{error}` tool result and can correct itself.
- 429, 5xx and network errors are retried with exponential backoff (`retries`, default 2; `retryDelay`, default 500ms), honoring `Retry-After` (seconds). Thrown errors now carry the HTTP `status`.
- New `maxToolRounds` option caps tool-call round trips per `send()`; the following request sends `tool_choice: "none"`.
- Token usage is emitted as a typed `{type: 'usage', usage}` chunk in both API modes (it was previously never surfaced in responses mode); `agent()` usage tracking uses it.
- Completions-mode history no longer sends the internal `streaming` field back to the API.
- `@preact/signals-core` is now an optional peer dependency (only `ko-ai/agent-signals` needs it).
