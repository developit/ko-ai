export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type Tool<TArgs = Record<string, unknown>, TResult = unknown> = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  call?: (args: TArgs) => TResult | Promise<TResult>;
};

export type ToolCall = {
  type: "tool_call";
  id: string;
  streaming?: boolean;
  function: {
    name: string;
    arguments: string;
  };
};

export type ToolResult = { type: "tool_result"; result: unknown } & Omit<
  ToolCall,
  "type"
>;

export type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  /** Provider-reported cost (e.g. OpenRouter with `usage: {include: true}`). */
  cost?: number;
};

export type StreamChunk =
  | { type: "text"; text: string; id: string }
  | { type: "reasoning"; text: string; id: string }
  | ToolCall
  | ToolResult
  | { type: "usage"; usage: Usage }
  | { type: "done" };

export type ApiMode = "completions" | "responses";

export interface CompleteOptions {
  apiKey: string;
  baseURL: string;
  headers?: Record<string, string>;
  mode?: ApiMode;
  model?: string;
  input?: string | any[];
  instructions?: string;
  tools?: Tool[];
  stream?: boolean;
  onToolCall?: (
    name: string,
    args: Record<string, unknown>,
  ) => unknown | Promise<unknown>;
  temperature?: number;
  max_output_tokens?: number;
  reasoning?: { effort?: string };
  tool_choice?: string;
  /** Retries for 429, 5xx and network errors, backing off exponentially and honoring Retry-After (default 2). */
  retries?: number;
  /** Base backoff delay in ms (default 500). */
  retryDelay?: number;
  /**
   * Max tool-call round trips per `send()` (default: unlimited). The request
   * after the last allowed round sends `tool_choice: "none"`, so the model has
   * to answer in text; tool calls it makes anyway are yielded but not run.
   */
  maxToolRounds?: number;
}

export default function ai(baseConfig: Omit<CompleteOptions, "input">) {
  const { mode = "responses", instructions, ...restConfig } = baseConfig;

  const c = mode === "completions";

  const messages: any[] =
    c && instructions ? [{ role: "system", content: instructions }] : [];
  const conversation: any[] = [];

  async function* send(
    input: string | any[],
    overrides: Partial<CompleteOptions> = {},
    signal?: AbortSignal,
  ): AsyncIterableIterator<StreamChunk> {
    const options: CompleteOptions = {
      ...restConfig,
      ...overrides,
      mode,
      input,
      instructions: c ? undefined : instructions,
    };

    const {
      apiKey,
      baseURL,
      headers = {},
      tools,
      onToolCall,
      stream = true,
      retries = 2,
      retryDelay = 500,
      maxToolRounds = Infinity,
      mode: _mode,
      input: _input,
      ...rest
    } = options;

    // Parsing here means malformed arguments share the tool-error path: the
    // model gets `{error}` back and the tool never runs.
    const callTool = async (name: string, json: string) => {
      try {
        const args = JSON.parse(json || "{}");
        return await (tools?.find((t: Tool) => t.name == name)?.call?.(args) ??
          onToolCall?.(name, args) ??
          (() => {
            throw name;
          })());
      } catch (e: any) {
        return { error: e.message || e };
      }
    };

    // Build request once, mutate body for continuations
    const endpoint = baseURL + (c ? "/chat/completions" : "/responses");
    let body: any = {
      stream,
      tools,
      ...rest,
    };

    if (c) {
      // Use closure messages array, add new user input
      if (_input) messages.push({ role: "user", content: _input });
      // Wrap tools in {function: {...}} for completions API
      if (body.tools) {
        body.tools = body.tools.map(({ call, type, ...fn }: Tool) => ({
          type,
          function: fn,
        }));
      }
      body.messages = messages;
      // Rename max_output_tokens to max_tokens for completions API
      if (body.max_output_tokens != null) {
        body.max_tokens = body.max_output_tokens;
        delete body.max_output_tokens;
      }
    } else if (_input) {
      conversation.push({ type: "message", role: "user", content: _input });
    }

    // POST with retries: transient failures (no response, 429, 5xx) back off
    // and try again; anything else throws an Error carrying the HTTP `status`.
    // Written for minified+gzipped size, not source size.
    const post = async (
      headers: Record<string, string>,
      attempt = 0,
    ): Promise<Response> => {
      let res: Response | undefined, err: unknown;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal,
        });
        if (res.ok) return res;
      } catch (e) {
        err = e;
      }
      const status = res?.status as number;
      // No response (network error) compares false on both sides → retryable.
      if (signal?.aborted || attempt >= retries || (status < 500 && status != 429)) {
        if (!res) throw err;
        throw Object.assign(Error(await res.text()), { status });
      }
      // Retry-After in seconds; anything else (an HTTP date) is NaN → backoff.
      const after: any = res?.headers.get("retry-after");
      await new Promise((r) =>
        setTimeout(r, Math.min(after * 1e3 || retryDelay * 2 ** attempt, 6e4)),
      );
      return post(headers, attempt + 1);
    };

    let rounds = 0;
    while (true) {
      const pendingCalls: ToolCall[] = [];
      const toolCallMap: Record<any, ToolCall> = {};
      const outputItems: any[] = [];
      let assistantContent = "";
      let reasoningContent = "";
      let messageId = "";
      let resp: any;

      const saveAssistant = () => {
        if (c && (assistantContent || reasoningContent)) {
          const msg: any = { role: "assistant" };
          if (assistantContent) msg.content = assistantContent;
          if (reasoningContent) msg.reasoning_content = reasoningContent;
          messages.push(msg);
        }
      };

      if (!c && conversation.length) {
        body.input = conversation;
      }

      const allHeaders: Record<string, string> = {
        "content-type": "application/json",
        ...headers,
      };
      if (apiKey) allHeaders.authorization = `Bearer ${apiKey}`;

      const response = await post(allHeaders);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          if (signal?.aborted) throw Error();

          const lines = stream ? buffer.split("\n") : [buffer];
          if (stream) buffer = lines.pop() || "";

          for (const line of lines) {
            let dataLine = line;
            if (stream) {
              if (!dataLine.startsWith("data: ")) continue;
              dataLine = dataLine.slice(6);
              if (dataLine == "[DONE]") {
                if (!pendingCalls.length) {
                  saveAssistant();
                  yield { type: "done" };
                  return;
                }
                continue;
              }
            }

            let chunk: StreamChunk | null = null;
            try {
              const data = JSON.parse(dataLine);
              if (!stream) buffer = "";
              // Usage can ride on any chunk (a final `choices: []` chunk in
              // completions mode, `response.completed` in responses mode).
              const usage = data.usage || data.response?.usage;
              if (usage) yield { type: "usage", usage };
              messageId = data.id || data.response?.id || messageId;
              const choice = data.choices?.[0];
              if (choice) {
								// Completions API
                const delta = choice.delta || choice.message;
                if (delta?.reasoning) {
                  chunk = { type: "reasoning", text: delta.reasoning, id: messageId + '_R' };
                } else if (delta?.content) {
                  chunk = { type: "text", text: delta.content, id: messageId };
                } else if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    let call = toolCallMap[idx];
                    if (!call) {
                      call = toolCallMap[idx] = {
                        type: "tool_call",
                        id: "",
                        streaming: true,
                        function: { name: "", arguments: "" },
                      };
                      pendingCalls.push(call);
                    }
                    if (tc.id) call.id = tc.id;
                    if (tc.function?.name) {
                      call.function.name += tc.function.name;
                    }
                    if (tc.function?.arguments) {
                      call.function.arguments += tc.function.arguments;
                      yield call;
                    }
                    chunk = call;
                  }
                }
                // finish_reason signals end of content - [DONE] will handle cleanup
              } else if (data.delta) {
                // Responses API text delta
                const isReasoning = data.type.includes("reasoning");
                chunk = {
                  type: isReasoning ? "reasoning" : "text",
                  text: data.delta,
                  id: isReasoning ? messageId + '_R' : messageId,
                };
              } else if (data.item?.type == "function_call") {
                // Responses API tool call
                const id = data.item.call_id || data.item.id || "";
                const pending = toolCallMap[id];
                if (pending) {
                  pending.function.arguments += data.item.arguments;
                  yield pending;
                  chunk = pending;
                } else {
                  chunk = {
                    type: "tool_call",
                    id,
                    streaming: true,
                    function: {
                      name: data.item.name || "",
                      arguments: data.item.arguments || "",
                    },
                  };
                  pendingCalls.push(chunk);
                  toolCallMap[id] = chunk;
                }
              } else if ((resp = data.response || data).status == "completed") {
                if (resp.output) {
                  outputItems.push(...resp.output);
                  if (!stream) {
                    for (const item of resp.output) {
                      if (item.type == "function_call") {
                        pendingCalls.push(chunk = {
                          type: "tool_call",
                          id: item.call_id,
                          function: item,
                        });
                      }
                      for (const c of item.content || []) {
                        if (c.text) yield { type: "text", text: c.text, id: messageId };
                      }
                    }
                  }
                }
                if (!pendingCalls.length) {
                  if (!c && outputItems.length) {
                    conversation.push(...outputItems);
                  }
                  yield { type: "done" };
                  return;
                }
                continue;
              }
            } catch {}

            if (chunk && chunk.type != "tool_call") {
              if (chunk.type == "text") assistantContent += chunk.text;
              else if (chunk.type == "reasoning") reasoningContent += chunk.text;
              yield chunk;
            }
          }

          const { done, value } = await reader.read();
          if (done) {
            if (stream && buffer.trim()) {
              buffer += "\ndata: [DONE]";
              continue;
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });
        }
      } finally {
        reader.releaseLock();
      }

      // If no tool calls, we're done - append to history
      if (!pendingCalls.length) {
        saveAssistant();
        if (!c && outputItems.length) {
          conversation.push(...outputItems);
        }
        yield { type: "done" };
        return;
      }
      pendingCalls.map((tc) => (tc.streaming = false));
      yield* pendingCalls;
      if (rounds >= maxToolRounds) {
        // Over the limit and the model still called tools: stop here.
        saveAssistant();
        yield { type: "done" };
        return;
      }
      const results = await Promise.all(
        pendingCalls.map(async (tc) => {
          const result = await callTool(tc.function.name, tc.function.arguments);
          return { ...tc, type: "tool_result", result } satisfies ToolResult;
        }),
      );
      yield* results;
      body.tool_choice = ++rounds >= maxToolRounds ? "none" : undefined;
      if (c) {
        const msg: any = {
          role: "assistant",
          content: assistantContent || null,
          // Only wire fields: `streaming` is ours, not the API's.
          tool_calls: pendingCalls.map(({ id, function: fn }) => ({
            id,
            type: "function",
            function: fn,
          })),
        };
        if (reasoningContent) msg.reasoning_content = reasoningContent;
        messages.push(
          msg,
          ...pendingCalls.map((tc, i) => ({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(results[i].result),
          })),
        );
      } else {
        // For responses mode: append output items and function results
        if (outputItems.length) conversation.push(...outputItems);
        conversation.push(
          ...pendingCalls.map((tc, i) => ({
            type: "function_call_output",
            call_id: tc.id,
            output: JSON.stringify(results[i].result),
          })),
        );
      }
    }
  }

  return {
    send,
    messages,
    conversation,
  };
}
