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

/** Token accounting, as reported by the provider. Extra fields vary by provider. */
export type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  [key: string]: any;
};

export type StreamChunk =
  | { type: "text"; text: string; id: string }
  | { type: "reasoning"; text: string; id: string }
  /** A generated image. `url` is usually a `data:` URL, which carries its own mime type. */
  | { type: "image"; url: string; id: string }
  | { type: "usage"; usage: Usage }
  | ToolCall
  | ToolResult
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
  /** Output modalities to request, e.g. `["image", "text"]`. */
  modalities?: string[];
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
      mode: _mode,
      input: _input,
      ...rest
    } = options;

    const callTool = async (name: string, args: any) => {
      try {
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

    while (true) {
      const pendingCalls: ToolCall[] = [];
      const toolCallMap: Record<any, ToolCall> = {};
      const outputItems: any[] = [];
      const assistantImages: any[] = [];
      let assistantContent = "";
      let reasoningContent = "";
      let messageId = "";
      let resp: any;

      const saveAssistant = () => {
        if (c && (assistantContent || reasoningContent || assistantImages.length)) {
          const msg: any = { role: "assistant" };
          if (assistantContent) msg.content = assistantContent;
          if (reasoningContent) msg.reasoning_content = reasoningContent;
          // Images must go back as-received, or the model can't iterate on what it made.
          if (assistantImages.length) {
            msg.content ??= "";
            msg.images = assistantImages;
          }
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

      const response = await fetch(endpoint, {
        method: "POST",
        headers: allHeaders,
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) throw Error(await response.text());

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
              messageId = data.id || data.response?.id || messageId;
              const usage = data.usage || data.response?.usage;
              if (usage) yield { type: "usage", usage };
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
                // Not part of the chain above: a delta can carry content and images together.
                for (const img of delta?.images || []) {
                  const url = img.image_url?.url;
                  if (url) yield { type: "image", url, id: messageId + "_I" + assistantImages.length };
                  assistantImages.push(img);
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
                  for (const item of resp.output) {
                    // Images never arrive as deltas, so they surface here in both modes.
                    if (item.type == "image_generation_call") {
                      yield { type: "image", url: item.result, id: item.id };
                    } else if (!stream) {
                      if (item.type == "function_call") {
                        pendingCalls.push(chunk = {
                          type: "tool_call",
                          id: item.call_id,
                          function: item,
                        });
                      }
                      for (const p of item.content || []) {
                        if (p.text) yield { type: "text", text: p.text, id: messageId };
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
      const results = await Promise.all(
        pendingCalls.map(async (tc) => {
          const args = JSON.parse(tc.function.arguments || "{}");
          const result = await callTool(tc.function.name, args);
          return { ...tc, type: "tool_result", result } satisfies ToolResult;
        }),
      );
      yield* results;
      body.tool_choice = undefined;
      if (c) {
        const msg: any = {
          role: "assistant",
          content: assistantContent || null,
          tool_calls: pendingCalls.map((tc) => ({ ...tc, type: "function" })),
        };
        if (reasoningContent) msg.reasoning_content = reasoningContent;
        if (assistantImages.length) msg.images = assistantImages;
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
