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

export type StreamChunk =
	| { type: "text"; text: string; id: string }
	| { type: "reasoning"; text: string; id: string }
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
}

export default function ai(baseConfig: Omit<CompleteOptions, "input">) {
	const { mode = "responses", instructions, ...restConfig } = baseConfig;

	const c = mode === "completions";

	// Closure state - exposed as properties
	const messages: any[] =
		c && instructions ? [{ role: "system", content: instructions }] : [];
	const conversation: any[] = [];

	// Main streaming method
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

		// Inline tool dispatch with error handling
		const callTool = async (name: string, args: Record<string, unknown>) => {
			try {
				return await (tools?.find((t: Tool) => t.name === name)?.call?.(args) ??
					onToolCall?.(name, args) ??
					(() => {
						throw name;
					})());
			} catch (e: any) {
				return { error: e.message ?? e };
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
			const { max_output_tokens, instructions, ...r } = body;
			// Use closure messages array, add new user input
			if (_input) messages.push({ role: "user", content: _input });
			body = { ...r, max_tokens: max_output_tokens, messages };
			// Wrap tools in {function: {...}} for completions API
			if (body.tools)
				body.tools = body.tools.map(({ call, type, ...fn }: Tool) => ({
					type,
					function: fn,
				}));
		} else if (!c && _input) {
			// For responses mode: append user message to conversation once before loop
			conversation.push({ type: "message", role: "user", content: _input });
		}

		// Outer loop for tool continuation
		while (true) {
			const pendingCalls: ToolCall[] = [];
			const toolCallMap: Record<number, ToolCall> = {};
			const outputItems: any[] = [];
			let assistantContent = "";
			let reasoningContent = "";
			let messageId = "";

			// For responses mode: use conversation array if available
			if (!c && conversation.length) {
				body.input = conversation;
			}

			// for (const i of body.input) console.log(i);

			const allHeaders: Record<string, string> = {
				"Content-Type": "application/json",
				...headers,
			};
			if (apiKey) allHeaders.Authorization = `Bearer ${apiKey}`;

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
					if (signal?.aborted) throw new Error('Aborted');
					
					const lines = buffer.split("\n");
					buffer = stream ? (lines.pop() || "") : "";

					for (const line of lines) {
						let dataLine = line;
						if (stream) {
							if (!dataLine.startsWith("data: ")) continue;
							dataLine = dataLine.slice(6);
							if (dataLine === "[DONE]") {
								// Completions: collect accumulated tool calls at stream end
								// if (c)
								//   for (const tc of Object.values(toolCallMap)) {
								//     pendingCalls.push(tc);
								//     yield {...tc, type: 'tool_call' as const};
								//   }
								if (!pendingCalls.length) {
									// Save assistant message before returning
									if (c && (assistantContent || reasoningContent)) {
										const msg: any = { role: "assistant" };
										if (assistantContent) msg.content = assistantContent;
										if (reasoningContent) msg.reasoning_content = reasoningContent;
										messages.push(msg);
									}
									yield { type: "done" };
									return;
								}
								continue;
							}
						}

						let chunk: StreamChunk | null = null;
						try {
							// console.log(dataLine);
							const data = JSON.parse(dataLine);
							if (data.id) messageId = data.id;
							if (data.response?.id) messageId = data.response.id;
							const choice = data.choices?.[0];
							// console.log(choice);
							if (choice) {
								// Completions API
								const delta = choice.delta || choice.message;
								if (delta?.reasoning) {
									chunk = { type: "reasoning", text: delta.reasoning, id: messageId };
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
										if (tc.function?.name)
											call.function.name += tc.function.name;
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
								chunk = {
									type: data.type.includes("reasoning") ? "reasoning" : "text",
									text: data.delta,
									id: messageId,
								};
							} else if (data.item?.type === "function_call") {
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
							} else if (data.response?.status === "completed") {
								// Responses API completed
								if (data.response.output)
									outputItems.push(...data.response.output);
								if (!pendingCalls.length) {
									// Save conversation items before returning
									if (!c && outputItems.length) {
										conversation.push(...outputItems);
									}
									yield { type: "done" };
									return;
								}
								continue;
							} else if (data.usage || data.type === "response.completed") {
								yield data;
							}
						} catch {}

						if (chunk && chunk.type !== "tool_call") {
							if (chunk.type === "text") assistantContent += chunk.text;
							else if (chunk.type === "reasoning")
								reasoningContent += chunk.text;
							// console.log('chunk', chunk);
							// else if (chunk.type === 'tool_call' && !c) pendingCalls.push(chunk);
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
				if (c && (assistantContent || reasoningContent)) {
					const msg: any = { role: "assistant" };
					if (assistantContent) msg.content = assistantContent;
					if (reasoningContent) msg.reasoning_content = reasoningContent;
					messages.push(msg);
				} else if (!c && outputItems.length) {
					conversation.push(...outputItems);
				}
				return;
			}
			pendingCalls.map((tc) => (tc.streaming = false));
			// console.log(pendingCalls);
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
					tool_calls: pendingCalls.map((tc) => ({ ...tc, type: "function" })),
					content: assistantContent || null,
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
