/**
 * signal-agent.ts — A Preact Model wrapping ko-ai/agent as a reactive state container.
 *
 * Stream items are first-class: each text block, reasoning block, tool call,
 * and user input is its own entry in the items array with Signal properties
 * for anything that mutates over time.
 */

import {
  computed,
  createModel,
  effect,
  signal,
  type ModelConstructor,
  type ReadonlySignal,
  type Signal,
} from '@preact/signals-core';
import agent, {truncateContext, type AgentConfig, type AgentEvent, type AgentUsage} from './agent.ts';
import type {StreamChunk, ToolCall, ToolResult} from './index.ts';

export {truncateContext};
export type {AgentConfig, AgentEvent, AgentUsage};

// ── Item types (discriminated union on `kind`) ─────────────────────────────

export type AgentStatus = 'idle' | 'running' | 'done' | 'error';

interface ItemBase<K extends string> {
  kind: K;
  id:   string;
}

export interface UserItem extends ItemBase<'user'> {
  content: string;
}

export interface TextItem extends ItemBase<'text'> {
  content: Signal<string>;
}

export interface ReasoningItem extends ItemBase<'reasoning'> {
  content: Signal<string>;
}

export interface ToolCallItem extends ItemBase<'tool_call'> {
  /** Tool function name. */
  name:    string;
  /** Accumulated JSON argument string (may be partial while `pending`). */
  args:    Signal<string>;
  /** Tool result once the call resolves (`null` while `pending`). */
  result:  Signal<unknown>;
  /** `true` while awaiting the tool result. */
  pending: Signal<boolean>;
}

export type Item = UserItem | TextItem | ReasoningItem | ToolCallItem;

// ── SignalAgentModel ───────────────────────────────────────────────────────

interface SignalAgent {
  /** Reactive lifecycle status. */
  status:      ReadonlySignal<AgentStatus>;
  /** Current turn number within the active prompt (0-based). */
  turn:        ReadonlySignal<number>;
  /** Cumulative token usage across all prompts. */
  usage:       ReadonlySignal<AgentUsage>;
  /** Last error value, or `null` if none. Set when `status === 'error'`. */
  error:       ReadonlySignal<unknown>;
  /** Append-only conversation timeline — one item per distinct streamed entity. */
  items:       ReadonlySignal<Item[]>;
  /** `true` while a prompt is actively running. */
  busy:        ReadonlySignal<boolean>;
  /** Names of tool calls currently awaiting results. */
  activeTools: ReadonlySignal<string[]>;

  /** Run a prompt; yields raw `AgentEvent`s while reactively updating signals. */
  prompt(input: string, overrides?: Partial<AgentConfig>): AsyncIterableIterator<AgentEvent>;
  /** Inject a steering message before the next LLM turn. */
  steer(message: string): void;
  /** Queue a follow-up prompt to run after the current one completes. */
  queueFollowUp(input: string): void;
  /** Cancel the in-flight prompt. */
  abort(): void;
  /** Clear all signal state. Any in-flight prompt is aborted first. */
  reset(): void;
}

let uid = 0;

/**
 * Signals-based reactive wrapper for `ko-ai/agent`, built as a Preact Model.
 *
 * Wraps an `agent()` instance in a fully-typed reactive interface where
 * streaming chunks are correlated by `.id` and projected into a live item
 * timeline. Methods are automatically batched/untracked by `createModel` so
 * they're safe to call from reactive contexts.
 *
 * Dispose via `model[Symbol.dispose]()` (or a `using` declaration in TS 5.2+)
 * to abort any in-flight prompt and clean up internal effects.
 *
 * @example
 * ```ts
 * import { SignalAgentModel } from 'ko-ai/agent-signals';
 *
 * const model = new SignalAgentModel({
 *   apiKey: 'sk-...',
 *   baseURL: 'https://api.openai.com/v1',
 *   model: 'gpt-4o',
 * });
 *
 * for await (const event of model.prompt('Hello!')) {
 *   // model.items, model.status, model.activeTools update as events arrive
 * }
 *
 * using m = new SignalAgentModel(config); // auto-disposes (TS 5.2+)
 * ```
 */
export const SignalAgentModel: ModelConstructor<SignalAgent, [config: AgentConfig]> =
  createModel((config: AgentConfig) => {

  const status = signal<AgentStatus>('idle');
  const turn   = signal(0);
  const usage  = signal<AgentUsage>({input_tokens: 0, output_tokens: 0, total_tokens: 0});
  const error  = signal<unknown>(null);
  const items  = signal<Item[]>([]);

  const busy = computed(() => status.value === 'running');
  const activeTools = computed(() =>
    (items.value.filter(it => it.kind === 'tool_call' && (it as ToolCallItem).pending.value) as ToolCallItem[])
      .map(it => it.name),
  );

  const inner = agent(config);

  // Dispose pattern: abort in-flight on model disposal.
  effect(() => () => { inner.abort(); });

  const syncUsage = () => { usage.value = {...inner.usage}; };

  // Live lookup map: id → mutable item, for O(1) chunk correlation.
  const live = new Map<string, TextItem | ReasoningItem | ToolCallItem>();

  const push = (item: Item) => { items.value = [...items.value, item]; };

  async function* prompt(
    input: string,
    overrides: Partial<AgentConfig> = {},
  ): AsyncIterableIterator<AgentEvent> {
    status.value = 'running';
    error.value = null;
    live.clear();

    push({kind: 'user', id: `user_${++uid}`, content: input});

    for await (const event of inner.prompt(input, overrides)) {
      switch (event.type) {

        case 'turn_start':
          turn.value = event.turn;
          break;

        case 'text': {
          const e = event as Extract<StreamChunk, {type: 'text'}>;
          const existing = live.get(e.id);
          if (existing && existing.kind === 'text') {
            existing.content.value += e.text;
          } else {
            const item: TextItem = {kind: 'text', id: e.id, content: signal(e.text)};
            live.set(e.id, item);
            push(item);
          }
          break;
        }

        case 'reasoning': {
          const e = event as Extract<StreamChunk, {type: 'reasoning'}>;
          const existing = live.get(e.id);
          if (existing && existing.kind === 'reasoning') {
            existing.content.value += e.text;
          } else {
            const item: ReasoningItem = {kind: 'reasoning', id: e.id, content: signal(e.text)};
            live.set(e.id, item);
            push(item);
          }
          break;
        }

        case 'tool_call': {
          const tc = event as ToolCall;
          if (!tc.id) break;
          const existing = live.get(tc.id);
          if (existing && existing.kind === 'tool_call') {
            existing.args.value = tc.function.arguments;
          } else {
            const item: ToolCallItem = {
              kind: 'tool_call', id: tc.id, name: tc.function.name,
              args: signal(tc.function.arguments), result: signal<unknown>(null), pending: signal(true),
            };
            live.set(tc.id, item);
            push(item);
          }
          break;
        }

        case 'tool_result': {
          const tr = event as ToolResult;
          const item = live.get(tr.id);
          if (item && item.kind === 'tool_call') {
            item.result.value = tr.result;
            item.pending.value = false;
          }
          break;
        }

        case 'error':
          error.value = (event as Extract<AgentEvent, {type: 'error'}>).error;
          status.value = 'error';
          break;

        case 'agent_end':
          live.clear();
          if (status.value !== 'error') status.value = 'done';
          break;
      }

      syncUsage();
      yield event;
    }
  }

  function steer(message: string)       { inner.steer(message); }
  function queueFollowUp(input: string) { inner.queueFollowUp(input); }
  function abort() {
    inner.abort();
    live.clear();
    status.value = items.value.length ? 'done' : 'idle';
  }
  function reset() {
    inner.abort();
    live.clear();
    status.value = 'idle';
    turn.value = 0;
    usage.value = {input_tokens: 0, output_tokens: 0, total_tokens: 0};
    error.value = null;
    items.value = [];
  }

  return {
    status, turn, usage, error, items,
    busy, activeTools,
    prompt, steer, queueFollowUp, abort, reset,
  };
});
