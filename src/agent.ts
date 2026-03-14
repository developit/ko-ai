import { resolve } from 'node:path';
import ai, { type CompleteOptions, type Tool, type StreamChunk } from './index.ts';

export type AgentTool = Tool;

export interface AgentUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface AgentConfig extends Omit<CompleteOptions, 'input' | 'onToolCall'> {
  tools?: AgentTool[];
  /** Max LLM round-trips per prompt() call (default: Infinity) */
  maxTurns?: number;
  /** Working directory for file-based tools (shell, read_file, write_file, edit_file) */
  cwd?: string;
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
  queueFollowUp(input: string): void;
  abort(): void;
  usage: AgentUsage;
  session: ReturnType<typeof ai>;
}

/** Tools that receive a `path` arg — resolved against `cwd` when set. */
const PATH_TOOLS = new Set(['shell', 'read_file', 'write_file', 'edit_file']);

export default function agent(config: AgentConfig): Agent {
  const {
    tools = [],
    maxTurns = Infinity,
    cwd,
    transformContext,
    onToolCall: userOnToolCall,
    ...aiConfig
  } = config;

  // Build tool lookup and strip `call` handlers — agent dispatches via onToolCall
  const toolMap = new Map<string, AgentTool>(tools.map(t => [t.name, t]));
  const apiTools: Tool[] = tools.map(({ call, ...rest }) => rest as Tool);

  /** Resolve path args against cwd for file-based tools. */
  const resolveArgs = (name: string, args: Record<string, unknown>) => {
    if (!cwd || !PATH_TOOLS.has(name)) return args;
    if (name === 'shell') return args; // shell uses cwd via exec option
    if (typeof args.path === 'string' && !args.path.startsWith('/')) {
      return { ...args, path: resolve(cwd, args.path) };
    }
    return args;
  };

  const session = ai({
    ...aiConfig,
    tools: apiTools.length ? apiTools : undefined,
    onToolCall: async (name, rawArgs) => {
      const args = resolveArgs(name, rawArgs);
      const tool = toolMap.get(name);
      const callFn = async (a: Record<string, unknown>) => {
        // For shell tool, pass cwd via exec options
        if (cwd && name === 'shell' && tool?.call) {
          const origCall = tool.call;
          // Inject cwd into the args for the shell tool
          return origCall({ ...a, cwd });
        }
        return tool?.call?.(a);
      };
      return userOnToolCall ? userOnToolCall(name, args, callFn) : callFn(args);
    },
  });

  const usage: AgentUsage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
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
          // Track usage from API responses
          if ((chunk as any).usage) {
            const u = (chunk as any).usage;
            usage.input_tokens += u.input_tokens || u.prompt_tokens || 0;
            usage.output_tokens += u.output_tokens || u.completion_tokens || 0;
            usage.total_tokens = usage.input_tokens + usage.output_tokens;
          }
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
    queueFollowUp: (input: string) => followUpQueue.push(input),
    abort: () => controller.abort(),
    usage,
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
