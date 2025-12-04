export type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type Tool = {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  call?: (args: Record<string, unknown>) => unknown | Promise<unknown>;
};

export type ToolCall = {
  type: 'tool_call';
  id: string;
  streaming?: boolean;
  function: {
    name: string;
    arguments: string;
  };
};

export type ToolResult = {type: 'tool_result'; result: unknown} & Omit<ToolCall, 'type'>;

export type StreamChunk =
  | {type: 'text'; text: string}
  | {type: 'reasoning'; text: string}
  | ToolCall
  | ToolResult
  | {type: 'done'};

export type ApiMode = 'completions' | 'responses';

export interface CompleteOptions {
  apiKey: string;
  baseURL: string;
  headers?: Record<string, string>;
  mode?: ApiMode;
  model?: string;
  input: string;
  instructions?: string;
  tools?: Tool[];
  onToolCall?: (
    name: string,
    args: Record<string, unknown>,
  ) => unknown | Promise<unknown>;
  temperature?: number;
  max_output_tokens?: number;
  reasoning?: {effort?: string};
  tool_choice?: string;
}

export default async function* ai(
  options: CompleteOptions,
): AsyncIterableIterator<StreamChunk> {
  const {
    apiKey,
    baseURL,
    headers = {},
    mode = 'responses',
    tools,
    onToolCall,
    ...rest
  } = options;

  const c = mode === 'completions';

  // Inline tool dispatch with error handling
  const callTool = async (name: string, args: Record<string, unknown>) => {
    try {
      return await (tools?.find((t) => t.name === name)?.call?.(args) ??
        onToolCall?.(name, args) ??
        (() => {
          throw name;
        })());
    } catch (e: any) {
      return {error: e.message ?? e};
    }
  };

  // Build request once, mutate body for continuations
  const endpoint = baseURL + (c ? '/chat/completions' : '/responses');
  let body: any = {
    ...rest,
    tools,
    stream: true,
  };

  if (c) {
    const {max_output_tokens, instructions, input, ...r} = body;
    body = {...r, max_tokens: max_output_tokens, messages: []};
    if (instructions)
      body.messages.push({role: 'system', content: instructions});
    if (input) body.messages.push({role: 'user', content: input});
    // Wrap tools in {function: {...}} for completions API
    if (body.tools)
      body.tools = body.tools.map(({call, type, ...fn}: Tool) => ({
        type,
        function: fn,
      }));
  }

  // Track conversation for responses mode (normalize to array)
  let conversationInput: any =
    !c && body.input
      ? [{type: 'message', role: 'user', content: body.input}]
      : null;

  // Outer loop for tool continuation
  while (true) {
    const pendingCalls: ToolCall[] = [];
    const toolCallMap: Record<number, ToolCall> = {};
    const outputItems: any[] = [];
    let assistantContent = '';

    // For responses mode continuation, use the built conversation array
    if (conversationInput) body.input = conversationInput;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw Error(await response.text());

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, {stream: true});
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataLine = line.slice(6);
          if (dataLine === '[DONE]') {
            // Completions: collect accumulated tool calls at stream end
            if (c)
              for (const tc of Object.values(toolCallMap)) {
                pendingCalls.push(tc);
                yield {...tc, type: 'tool_call' as const};
              }
            if (!pendingCalls.length) {
              yield {type: 'done'};
              return;
            }
            continue;
          }

          let chunk: StreamChunk | null = null;
          try {
            const data = JSON.parse(dataLine);
            const choice = data.choices?.[0];
            if (choice) {
              // Completions API
              const delta = choice.delta;
              if (delta?.content) {
                chunk = {type: 'text', text: delta.content};
              } else if (delta?.reasoning) {
                chunk = {type: 'reasoning', text: delta.reasoning};
              } else if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  let call = toolCallMap[idx];
                  if (!call) {
                    call = toolCallMap[idx] = {
                      type: 'tool_call',
                      id: '',
                      streaming: true,
                      function: {name: '', arguments: ''},
                    };
                    pendingCalls.push(call);
                  }
                  if (tc.id) call.id = tc.id;
                  if (tc.function?.name) call.function.name += tc.function.name;
                  if (tc.function?.arguments)
                    call.function.arguments += tc.function.arguments;
                  chunk = call;
                }
              }
              // finish_reason signals end of content - [DONE] will handle cleanup
            } else if (data.delta) {
              // Responses API text delta
              chunk = {...data, type: data.type.includes('reasoning') ? 'reasoning' : 'text', text: data.delta};
            } else if (data.item?.type === 'function_call') {
              // Responses API tool call
              const id = data.item.call_id || data.item.id || '';
              const pending = toolCallMap[id];
              if (pending) {
                pending.function.arguments += data.item.arguments;
                chunk = pending;
              } else {
                chunk = {
                  type: 'tool_call',
                  id,
                  streaming: true,
                  function: {
                    name: data.item.name || '',
                    arguments: data.item.arguments || '',
                  },
                };
                pendingCalls.push(chunk);
                toolCallMap[id] = chunk;
              }
            } else if (data.response?.status === 'completed') {
              // Responses API completed
              if (data.response.output)
                outputItems.push(...data.response.output);
              if (!pendingCalls.length) {
                yield {type: 'done'};
                return;
              }
              continue;
            }
          } catch {}

          if (chunk) {
            if (chunk.type === 'text') assistantContent += chunk.text;
            // else if (chunk.type === 'tool_call' && !c) pendingCalls.push(chunk);
            yield chunk;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!pendingCalls.length) return;
    pendingCalls.map(tc => tc.streaming = false);
    yield* pendingCalls;
    const results = await Promise.all(
      pendingCalls.map(async (tc) => {
        const args = JSON.parse(tc.function.arguments || '{}');
        const result = await callTool(tc.function.name, args);
        return {...tc, type: 'tool_result', result} satisfies ToolResult;
      }),
    );
    yield* results;
    body.tool_choice = undefined;
    if (c) {
      body.messages.push(
        {
          role: 'assistant',
          content: assistantContent || null,
          tool_calls: pendingCalls.map((tc) => ({...tc, type: 'function'})),
        },
        ...pendingCalls.map((tc, i) => ({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(results[i].result),
        })),
      );
    } else {
      conversationInput = [
        ...conversationInput,
        ...outputItems,
        ...pendingCalls.map((tc, i) => ({
          type: 'function_call_output',
          call_id: tc.id,
          output: JSON.stringify(results[i].result),
        })),
      ];
    }
  }
}
