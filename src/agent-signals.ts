/**
 * agent-signals.ts — A Preact Model wrapping ko-ai/agent as a reactive state container.
 *
 * Stream items are first-class: each text block, reasoning block, tool call,
 * and user input is its own entry in the items array with Signal properties
 * for anything that mutates over time.
 */

import {computed, createModel, effect, signal, type ModelConstructor, type ReadonlySignal, type Signal} from '@preact/signals-core';
import createAgent, {truncateContext, type AgentConfig, type AgentEvent} from './agent.ts';
import type {StreamChunk, ToolCall, ToolResult} from './index.ts';

export {truncateContext};
export type {AgentConfig, AgentEvent};

// ── Item types (discriminated union on `kind`) ─────────────────────────────

export type AgentStatus = 'idle' | 'running' | 'done' | 'error';

interface ItemBase<K extends string> {
  kind: K;
  id: string;
}

export interface UserItem extends ItemBase<'user'> {
  content: Signal<string>;
}

export interface TextItem extends ItemBase<'text'> {
  content: Signal<string>;
}

export interface ReasoningItem extends ItemBase<'reasoning'> {
  content: Signal<string>;
}

export interface ToolCallItem extends ItemBase<'tool_call'> {
  name: Signal<string>;
  args: Signal<string>;
  result: Signal<unknown>;
  error: Signal<unknown>;
  pending: Signal<boolean>;
}

export type Item = UserItem | TextItem | ReasoningItem | ToolCallItem;

// ── Agent ──────────────────────────────────────────────────────────────────

interface AgentModel {
  status: ReadonlySignal<AgentStatus>;
  turn: ReadonlySignal<number>;
  usage: {
    input_tokens: Signal<number>;
    output_tokens: Signal<number>;
    total_tokens: Signal<number>;
  };
  error: ReadonlySignal<unknown>;
  items: ReadonlySignal<Item[]>;
  pendingTools: ReadonlySignal<ToolCallItem[]>;

  prompt(input: string, overrides?: Partial<AgentConfig>): AsyncIterableIterator<AgentEvent>;
  steer(message: string): void;
  queueFollowUp(input: string): void;
  abort(): void;
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
 * import {Agent} from 'ko-ai/agent-signals';
 *
 * const model = new Agent({
 *   apiKey: 'sk-...',
 *   baseURL: 'https://api.openai.com/v1',
 *   model: 'gpt-4o',
 * });
 *
 * for await (const event of model.prompt('Hello!')) {
 *   // model.items, model.status, model.pendingTools update as events arrive
 * }
 *
 * using m = new Agent(config); // auto-disposes (TS 5.2+)
 * ```
 */
export const Agent: ModelConstructor<AgentModel, [config: AgentConfig]> = createModel((config: AgentConfig) => {
  const status = signal<AgentStatus>('idle');
  const turn = signal(0);
  const usage = {
    input_tokens: signal(0),
    output_tokens: signal(0),
    total_tokens: signal(0),
  };
  const error = signal<unknown>(null);
  const items = signal<Item[]>([]);

  const pendingTools = computed(() => items.value.filter(it => it.kind === 'tool_call' && (it as ToolCallItem).pending.value) as ToolCallItem[]);

  const inner = createAgent(config);

  // Dispose pattern: abort in-flight on model disposal.
  effect(() => () => {
    inner.abort();
  });

  // Live lookup map: id → mutable item, for O(1) chunk correlation.
  const live = new Map<string, TextItem | ReasoningItem | ToolCallItem>();

  const push = (item: Item) => {
    items.value = [...items.value, item];
  };

  async function* prompt(input: string, overrides: Partial<AgentConfig> = {}): AsyncIterableIterator<AgentEvent> {
    status.value = 'running';
    error.value = null;
    live.clear();

    push({kind: 'user', id: `user_${++uid}`, content: signal(input)});

    for await (const event of inner.prompt(input, overrides)) {
      if ((event as any).usage) {
        const u = (event as any).usage;
        usage.input_tokens.value += u.input_tokens || u.prompt_tokens || 0;
        usage.output_tokens.value += u.output_tokens || u.completion_tokens || 0;
        usage.total_tokens.value = usage.input_tokens.value + usage.output_tokens.value;
      }

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
            existing.name.value = tc.function.name;
            existing.args.value = tc.function.arguments;
          } else {
            const item: ToolCallItem = {
              kind: 'tool_call',
              id: tc.id,
              name: signal(tc.function.name),
              args: signal(tc.function.arguments),
              result: signal<unknown>(null),
              error: signal<unknown>(null),
              pending: signal(true),
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
            if (tr.result && typeof tr.result === 'object' && 'error' in tr.result) {
              item.error.value = (tr.result as {error: unknown}).error;
            }
            item.result.value = tr.result;
            item.pending.value = false;
          }
          break;
        }

        case 'error':
          error.value = (event as Extract<AgentEvent, {type: 'error'}>).error;
          status.value = 'error';
          break;
      }

      yield event;
    }

    live.clear();
    if (status.value !== 'error') status.value = 'done';
  }

  function steer(message: string) {
    inner.steer(message);
  }
  function queueFollowUp(input: string) {
    inner.queueFollowUp(input);
  }
  function abort() {
    inner.abort();
    live.clear();
    status.value = items.value.length ? 'done' : 'idle';
  }
  function reset() {
    items.value = [];
    abort();
    turn.value = 0;
    usage.input_tokens.value = 0;
    usage.output_tokens.value = 0;
    usage.total_tokens.value = 0;
    error.value = null;
  }

  return {
    status,
    turn,
    usage,
    error,
    items,
    pendingTools,
    prompt,
    steer,
    queueFollowUp,
    abort,
    reset,
  };
});
