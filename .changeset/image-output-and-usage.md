---
"ko-ai": minor
---

Surface generated images, and stop corrupting conversation history when a turn produces one.

ko-ai never read the `images` field that OpenAI-compatible providers return on chat completions, so
pointing it at an image model produced a plausible-looking text-only result with no error. The
subtler half of that bug was in the history ko-ai owns: an assistant turn that produced an image was
replayed to the model as text alone, and an **image-only** turn appended *nothing at all*, leaving
two consecutive user messages. Iterative editing ("now make it bluer") could not work even if the
caller captured the image itself, because the model was never shown that it had produced one.

- New `image` chunk (`{type, url, id}`), emitted in completions mode (streaming and non-streaming)
  and in responses mode, where images arrive as `image_generation_call` output items. `url` is the
  provider's data URL, which already carries its own mime type.
- Assistant messages now carry their images back into `messages`, in the shape the API accepts, and
  an image-only turn appends exactly one assistant message.
- New `usage` chunk replaces the previous untyped raw-JSON passthrough, and is now emitted wherever
  the provider reports usage — including OpenRouter-shaped completions streams, non-streaming
  completions, and responses mode, where it was previously dropped. `agent().usage` accumulates in
  those cases for the first time. `.usage` is still a plain property on the event, so existing casts
  keep working.
- `modalities?: string[]` is now declared on the config type (it already worked via rest-spread).
- `ko-ai/agent-signals` gains an `ImageItem` timeline item.

Note: adding variants to the `StreamChunk` (and therefore `AgentEvent`) union is source-breaking for
consumers with exhaustive `switch` statements over it, and streams now include `usage` chunks where
they previously included none.
