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
    const {
      apiKey,
      baseURL,
      headers,
      tools,
      onToolCall,
      stream = true,
      retries = 2,
      retryDelay = 500,
      maxToolRounds = Infinity,
      mode: _mode,
      input: _input,
      ...rest
    }: CompleteOptions = {
      ...restConfig,
      ...overrides,
      instructions: c ? undefined : instructions,
    };

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
    let body: any = {
      stream,
      tools,
      ...rest,
    };

    if (c) {
      // Use closure messages array, add new user input
      if (input) messages.push({ role: "user", content: input });
      // Wrap tools in {function: {...}} for completions API
      body.tools = body.tools?.map(({ call, type, ...fn }: Tool) => ({
        type,
        function: fn,
      }));
      body.messages = messages;
      // Rename max_output_tokens to max_tokens for completions API. (When it's
      // unset, max_tokens is undefined and JSON.stringify drops it.)
      ({ max_output_tokens: body.max_tokens, ...body } = body);
    } else {
      if (input) conversation.push({ type: "message", role: "user", content: input });
      // Same array every round, so later pushes are picked up automatically.
      body.input = conversation;
    }

    // POST with retries: transient failures (no response, 429, 5xx) back off
    // and try again; anything else throws an Error carrying the HTTP `status`.
    // Written for minified+gzipped size, not source size.
    const post = async (attempt = 0): Promise<Response> => {
      // A network error resolves to the error itself: no status, so retryable.
      const res: any = await fetch(
        baseURL + (c ? "/chat/completions" : "/responses"),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(apiKey && { authorization: `Bearer ${apiKey}` }),
            ...headers,
          },
          body: JSON.stringify(body),
          signal,
        },
      ).catch((e) => e);
      if (res.ok) return res;
      const status = res.status;
      if (signal?.aborted || attempt >= retries || (status < 500 && status != 429)) {
        throw res.text ? Object.assign(Error(await res.text()), { status }) : res;
      }
      // Retry-After in seconds; anything else (an HTTP date) is NaN → backoff.
      const after = res.headers?.get("retry-after");
      await new Promise((r) =>
        setTimeout(r, Math.min(after * 1e3 || retryDelay * 2 ** attempt, 6e4)),
      );
      return post(attempt + 1);
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

      const reader = (await post())
        .body!.pipeThrough(new TextDecoderStream())
        .getReader();
      let buffer = "";

      // An abort errors the body stream, so read() rejects on its own.
      read: while (true) {
        const lines = stream ? buffer.split("\n") : [buffer];
        if (stream) buffer = lines.pop() || "";

        for (const line of lines) {
          let dataLine = line;
          if (stream) {
            if (!dataLine.startsWith("data: ")) continue;
            dataLine = dataLine.slice(6);
            // End of stream: the code after the read loop finishes up.
            if (dataLine == "[DONE]") break read;
          }

          let chunk: { type: "text" | "reasoning"; text: string; id?: string } | undefined;
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
                chunk = { type: "reasoning", text: delta.reasoning };
              } else if (delta?.content) {
                chunk = { type: "text", text: delta.content };
              } else if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const fn = tc.function || {};
                  const call = (toolCallMap[tc.index ?? 0] ||=
                    pendingCalls[
                      pendingCalls.push({
                        type: "tool_call",
                        id: "",
                        streaming: true,
                        function: { name: "", arguments: "" },
                      }) - 1
                    ]);
                  call.id = tc.id || call.id;
                  call.function.name += fn.name || "";
                  if (fn.arguments) {
                    call.function.arguments += fn.arguments;
                    yield call;
                  }
                }
              }
              // finish_reason signals end of content - [DONE] will handle cleanup
            } else if (data.delta) {
              // Responses API text delta
              chunk = {
                type: data.type.includes("reasoning") ? "reasoning" : "text",
                text: data.delta,
              };
            } else if (data.item?.type == "function_call") {
              // Responses API tool call
              const id = data.item.call_id || data.item.id || "";
              const pending = toolCallMap[id];
              if (pending) {
                pending.function.arguments += data.item.arguments;
                yield pending;
              } else {
                pendingCalls.push(
                  (toolCallMap[id] = {
                    type: "tool_call",
                    id,
                    streaming: true,
                    function: {
                      name: data.item.name || "",
                      arguments: data.item.arguments || "",
                    },
                  }),
                );
              }
            } else if ((resp = data.response || data).status == "completed") {
              if (resp.output) {
                outputItems.push(...resp.output);
                if (!stream) {
                  for (const item of resp.output) {
                    if (item.type == "function_call") {
                      pendingCalls.push({
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
              break read;
            }
          } catch {}

          // Only text and reasoning land here; tool calls are yielded above.
          if (chunk) {
            chunk.id = messageId;
            if (chunk.type == "text") assistantContent += chunk.text;
            else {
              reasoningContent += chunk.text;
              chunk.id += "_R";
            }
            yield chunk as StreamChunk;
          }
        }

        const { done, value } = await reader.read();
        if (done && !(stream && buffer)) break;
        // At the end, a newline flushes a final unterminated line.
        buffer += done ? "\n" : value;
      }

      // Done streaming: dropping the flag (rather than setting false) keeps
      // these wire-clean, so they go back to the API as-is below.
      pendingCalls.map((tc) => delete tc.streaming);
      yield* pendingCalls;
      // No tool calls → done. Over the round limit → also done, without
      // running them (and without leaving unanswered calls in history).
      if (!pendingCalls.length || rounds >= maxToolRounds) {
        if (c) {
          if (assistantContent || reasoningContent)
            messages.push({
              role: "assistant",
              content: assistantContent || undefined,
              reasoning_content: reasoningContent || undefined,
            });
        } else if (!pendingCalls.length) conversation.push(...outputItems);
        yield { type: "done" };
        return;
      }
      const results = await Promise.all(
        pendingCalls.map(
          async (tc): Promise<ToolResult> => ({
            ...tc,
            type: "tool_result",
            result: await callTool(tc.function.name, tc.function.arguments),
          }),
        ),
      );
      yield* results;
      body.tool_choice = ++rounds >= maxToolRounds ? "none" : undefined;
      // Results carry their call's id, so history is built straight from them.
      if (c) {
        messages.push(
          {
            role: "assistant",
            content: assistantContent || null,
            tool_calls: pendingCalls.map((tc) => ({ ...tc, type: "function" })),
            // Undefined keys are dropped by JSON.stringify.
            reasoning_content: reasoningContent || undefined,
          },
          ...results.map((r) => ({
            role: "tool",
            tool_call_id: r.id,
            content: JSON.stringify(r.result),
          })),
        );
      } else {
        conversation.push(
          ...outputItems,
          ...results.map((r) => ({
            type: "function_call_output",
            call_id: r.id,
            output: JSON.stringify(r.result),
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
