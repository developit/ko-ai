import ai, { type CompleteOptions, type Tool, type StreamChunk } from './index.ts';

export type AgentTool = Tool;

export interface AgentConfig extends Omit<CompleteOptions, 'input' | 'onToolCall'> {
  tools?: AgentTool[];
  /** Max LLM round-trips per prompt() call (default: 25) */
  maxTurns?: number;
  /** Transform message history before each LLM call */
  transformContext?: (messages: any[]) => any[];
  /** Wrap any tool call — modify args, skip, transform result, add logging, etc. */
  onToolCall?: (
    name: string,
    args: Record<string, unknown>,
    call: (args: Record<string, unknown>) => Promise<unknown>,
  ) => unknown | Promise<unknown>;
  /** AbortSignal for external cancellation */
  signal?: AbortSignal;
}

export type AgentEvent =
  | { type: 'agent_start' }
  | { type: 'turn_start'; turn: number }
  | StreamChunk
  | { type: 'turn_end'; turn: number }
  | { type: 'agent_end' }
  | { type: 'error'; error: unknown };

export interface Agent {
  prompt(input: string, overrides?: Partial<AgentConfig>): AsyncIterableIterator<AgentEvent>;
  steer(message: string): void;
  followUp(input: string): void;
  abort(): void;
  session: ReturnType<typeof ai>;
}

export default function agent(config: AgentConfig): Agent {
  const {
    tools = [],
    maxTurns = 25,
    transformContext,
    onToolCall: userOnToolCall,
    ...aiConfig
  } = config;

  // Build tool lookup and strip `call` handlers — agent dispatches via onToolCall
  const toolMap = new Map<string, AgentTool>(tools.map(t => [t.name, t]));
  const apiTools: Tool[] = tools.map(({ call, ...rest }) => rest as Tool);

  const session = ai({
    ...aiConfig,
    tools: apiTools.length ? apiTools : undefined,
    onToolCall: async (name, args) => {
      const tool = toolMap.get(name);
      const callFn = async (a: Record<string, unknown>) => tool?.call?.(a);
      return userOnToolCall ? userOnToolCall(name, args, callFn) : callFn(args);
    },
  });

  const steerQueue: string[] = [];
  const followUpQueue: string[] = [];
  let controller = new AbortController();

  const isCompletions = (config.mode ?? 'responses') === 'completions';
  const history = () => isCompletions ? session.messages : session.conversation;

  async function* prompt(
    input: string,
    overrides: Partial<AgentConfig> = {},
  ): AsyncIterableIterator<AgentEvent> {
    controller = new AbortController();
    const signal = config.signal
      ? AbortSignal.any([config.signal, controller.signal])
      : controller.signal;

    const { tools: _t, maxTurns: _m, transformContext: _tc, onToolCall: _otc, ...sendOverrides } = overrides;

    let currentInput: string | undefined = input;
    let turn = 0;

    yield { type: 'agent_start' };

    try {
      while (currentInput != null && turn < maxTurns) {
        // Apply context transformation
        if (transformContext) {
          const h = history();
          const transformed = transformContext(h);
          if (transformed !== h) {
            h.length = 0;
            h.push(...transformed);
          }
        }

        // Inject steering messages
        if (steerQueue.length) {
          const msgs = steerQueue.splice(0);
          const h = history();
          for (const msg of msgs) {
            if (isCompletions) {
              h.push({ role: 'user', content: msg });
            } else {
              h.push({ type: 'message', role: 'user', content: msg });
            }
          }
        }

        yield { type: 'turn_start', turn };

        for await (const chunk of session.send(currentInput, sendOverrides, signal)) {
          yield chunk;
        }

        yield { type: 'turn_end', turn };
        turn++;
        currentInput = followUpQueue.shift();
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        yield { type: 'error', error: e };
      }
    }

    yield { type: 'agent_end' };
  }

  return {
    prompt,
    steer: (msg: string) => steerQueue.push(msg),
    followUp: (input: string) => followUpQueue.push(input),
    abort: () => controller.abort(),
    session,
  };
}

/** Utility: truncate message history, preserving the system message. */
export function truncateContext(maxMessages: number) {
  return (msgs: any[]) => {
    if (msgs.length <= maxMessages) return msgs;
    const hasSystem = msgs[0]?.role === 'system';
    const keep = hasSystem ? [msgs[0], ...msgs.slice(-(maxMessages - 1))] : msgs.slice(-maxMessages);
    msgs.length = 0;
    msgs.push(...keep);
    return msgs;
  };
}
