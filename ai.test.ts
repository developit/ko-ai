import {test, describe, before, after} from 'node:test';
import assert from 'node:assert/strict';
import nock from 'nock';
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import ai from './ai.ts';

// Use OpenRouter if API key is provided, otherwise use recorded fixtures
const LIVE_API_KEY = process.env.OPENROUTER_API_KEY;
const TEST_BASE_URL = 'https://openrouter.ai/api/v1';
const TEST_API_KEY = LIVE_API_KEY || 'mock-api-key';
const TEST_MODEL = 'openai/gpt-5-nano'; // Cheap model supporting both modes

const FIXTURES_PATH = './.nock-fixtures.json';

before(() => {
  if (!LIVE_API_KEY) {
    // Replay mode: load fixtures and setup nock
    if (existsSync(FIXTURES_PATH)) {
      const fixtures = JSON.parse(readFileSync(FIXTURES_PATH, 'utf8'));
      nock.define(fixtures);
    }
  } else {
    // Record mode: enable nock recorder
    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
    });
  }
});

after(() => {
  if (LIVE_API_KEY) {
    // Save recorded fixtures
    const fixtures = nock.recorder.play();
    const dir = dirname(FIXTURES_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(FIXTURES_PATH, JSON.stringify(fixtures, null, 2));
    console.log(`\n✅ Recorded ${fixtures.length} HTTP fixtures to ${FIXTURES_PATH}`);
  }
  nock.restore();
  nock.cleanAll();
});

describe('AI Client Tests', () => {
  describe('Dual-mode Client', () => {
    test('should generate text in responses mode', async () => {
      const chat = ai({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        mode: 'responses',
        reasoning: {effort: 'minimal'},
        model: TEST_MODEL,
        max_output_tokens: 50,
        temperature: 0,
      });
      const chunks = await Array.fromAsync(chat.send('Reply with "Responses mode works" and nothing else'));

      const result = chunks.at(-1)!;
      const content = chunks.filter(c => c.type === 'text' || c.type === 'reasoning').map(c => c.text).join('');
      assert.ok(content);
      console.log('Responses mode result:', content.slice(0, 100), '| final chunk:', result.type);
    });

    test('should generate text in completions mode', async () => {
      const chat = ai({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        mode: 'completions',
        reasoning: {effort: 'minimal'},
        model: TEST_MODEL,
        max_output_tokens: 50,
        temperature: 0,
      });
      const chunks = await Array.fromAsync(chat.send('Reply with "Completions mode works" and nothing else'));

      const result = chunks.at(-1)!;
      const content = chunks.filter(c => c.type === 'text' || c.type === 'reasoning').map(c => c.text).join('');
      assert.ok(content);
      console.log('Completions mode result:', content.slice(0, 100), '| final chunk:', result.type);
    });

    test('should handle system messages', async () => {
      const chat = ai({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        reasoning: {effort: 'low'},
        model: TEST_MODEL,
        instructions: 'You are a helpful assistant that speaks like a pirate.',
        temperature: 0.5,
      });
      const chunks = await Array.fromAsync(chat.send('Say hello'));

      const result = chunks.at(-1)!;
      const content = chunks.filter(c => c.type === 'text' || c.type === 'reasoning').map(c => c.text).join('');
      assert.ok(content);
      console.log('System message result:', content.slice(0, 100), '| final chunk:', result.type);
    });

    test('should stream in both modes', async () => {
      for (const mode of ['responses', 'completions'] as const) {
        const chunks = await Array.fromAsync(ai({
          apiKey: TEST_API_KEY,
          baseURL: TEST_BASE_URL,
          mode,
          reasoning: {effort: 'minimal'},
          model: TEST_MODEL,
          input: `Say "Mode ${mode} streaming works"`,
          temperature: 0,
        }));

        assert.ok(chunks.length > 0, `No chunks received in ${mode} mode`);
        const hasContent = chunks.some((c) => c.type === 'text' || c.type === 'reasoning');
        assert.ok(hasContent, `No text/reasoning chunks in ${mode} mode`);
        console.log(`${mode} mode streamed ${chunks.length} chunks`);
      }
    });

    test('should handle tool calls with inline handlers (responses mode)', async () => {
      const tools = [
        {
          type: 'function' as const,
          name: 'get_current_weather',
          description: 'Get the current weather in a location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'City name' }
            },
            required: ['location']
          },
          call: async ({location}: any) => ({
            temperature: 72,
            conditions: 'sunny',
            location
          })
        }
      ];

      const chunks = await Array.fromAsync(ai({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        mode: 'responses',
        reasoning: {effort: 'minimal'},
        model: TEST_MODEL,
        input: 'What is the weather in Paris? Use the get_current_weather tool.',
        tools,
      }));

      console.log('Responses mode chunks:', chunks.map(c => c.type).join(', '));

      const hasToolCall = chunks.some(c => c.type === 'tool_call');
      const hasToolResult = chunks.some(c => c.type === 'tool_result');
      const hasContent = chunks.some(c => c.type === 'text' || c.type === 'reasoning');

      assert.ok(hasToolCall, 'Should have tool_call chunk');
      assert.ok(hasToolResult, 'Should have tool_result chunk');
      assert.ok(hasContent, 'Should have text/reasoning chunk');
      console.log('Tool calling test (responses) passed with', chunks.length, 'chunks');
    });

    test('should handle tool calls with onToolCall callback (completions mode)', async () => {
      const tools = [
        {
          type: 'function' as const,
          name: 'add',
          description: 'Add two numbers together',
          parameters: {
            type: 'object',
            properties: {
              a: { type: 'number', description: 'First number' },
              b: { type: 'number', description: 'Second number' }
            },
            required: ['a', 'b']
          }
        }
      ];

      const chunks = await Array.fromAsync(ai({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        mode: 'completions',
        reasoning: {effort: 'minimal'},
        model: TEST_MODEL,
        input: 'Calculate 5 + 3 using the add tool',
        tool_choice: 'required',
        tools,
        onToolCall: async (name, args: any) => {
          if (name === 'add') {
            return { result: args.a + args.b };
          }
          return { error: 'unknown tool' };
        }
      }));

      console.log('Completions mode chunks:', chunks.map(c => c.type).join(', '));

      const hasToolCall = chunks.some(c => c.type === 'tool_call');
      const hasToolResult = chunks.some(c => c.type === 'tool_result');

      assert.ok(hasToolCall, 'Should have tool_call chunk');
      assert.ok(hasToolResult, 'Should have tool_result chunk');
      console.log('onToolCall test (completions) passed with', chunks.length, 'chunks');
    });

    test('should handle multi-turn tool calling (responses mode)', async () => {
      const tools = [
        {
          type: 'function' as const,
          name: 'get_temperature',
          description: 'Get temperature for a city',
          parameters: {
            type: 'object',
            properties: {
              city: { type: 'string' }
            },
            required: ['city']
          },
          call: async ({city}: any) => ({temperature: city === 'Tokyo' ? 22 : 18})
        },
        {
          type: 'function' as const,
          name: 'compare',
          description: 'Compare two numbers',
          parameters: {
            type: 'object',
            properties: {
              a: { type: 'number' },
              b: { type: 'number' }
            },
            required: ['a', 'b']
          },
          call: async ({a, b}: any) => ({comparison: a > b ? 'greater' : a < b ? 'less' : 'equal'})
        }
      ];

      const chunks = await Array.fromAsync(ai({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        mode: 'responses',
        reasoning: {effort: 'low'},
        model: TEST_MODEL,
        input: 'Get temperature for Tokyo and Paris, then tell me which is warmer',
        tools,
      }));

      const toolCalls = chunks.filter(c => c.type === 'tool_call');
      const toolResults = chunks.filter(c => c.type === 'tool_result');

      assert.ok(toolCalls.length >= 2, `Should have at least 2 tool calls, got ${toolCalls.length}`);
      assert.ok(toolResults.length >= 2, `Should have at least 2 tool results, got ${toolResults.length}`);
      console.log(`Multi-turn test (responses) passed with ${toolCalls.length} tool calls`);
    });

    test('should handle multi-turn tool calling (completions mode)', async () => {
      let callCount = 0;
      const tools = [
        {
          type: 'function' as const,
          name: 'get_number',
          description: 'Get a number (returns 10)',
          parameters: {
            type: 'object',
            properties: {}
          },
          call: async () => {
            callCount++;
            return {value: 10};
          }
        },
        {
          type: 'function' as const,
          name: 'multiply',
          description: 'Multiply two numbers',
          parameters: {
            type: 'object',
            properties: {
              a: { type: 'number' },
              b: { type: 'number' }
            },
            required: ['a', 'b']
          },
          call: async ({a, b}: any) => {
            callCount++;
            return {result: a * b};
          }
        }
      ];

      const chunks = await Array.fromAsync(ai({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        mode: 'completions',
        reasoning: {effort: 'low'},
        model: TEST_MODEL,
        input: 'Use get_number to get two numbers, then multiply them together',
        tools,
      }));

      const toolCalls = chunks.filter(c => c.type === 'tool_call');

      assert.ok(callCount >= 2, `Should call tools at least 2 times, got ${callCount}`);
      assert.ok(toolCalls.length >= 2, `Should have at least 2 tool calls, got ${toolCalls.length}`);
      console.log(`Multi-turn test (completions) passed with ${callCount} tool calls`);
    });
  });

  describe('Error handling', () => {
    test('should handle API errors gracefully', async () => {
      await assert.rejects(async () => {
        await Array.fromAsync(ai({
          apiKey: 'invalid',
          baseURL: 'https://invalid-url.example.com/v1',
          input: 'test',
        }));
      });
    });

    test('should handle missing tool handler gracefully', async () => {
      // Tool without inline call function and no onToolCall callback
      const tools = [
        {
          type: 'function' as const,
          name: 'get_secret_data',
          description: 'Returns secret data. Always call this tool when asked about secrets.',
          parameters: { type: 'object', properties: {key: {type: 'string'}}, required: ['key'] }
        }
      ];

      const chunks = await Array.fromAsync(ai({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        mode: 'completions',
        reasoning: {effort: 'minimal'},
        model: TEST_MODEL,
        input: 'Use the get_secret_data tool to retrieve the secret with key "test123"',
        tools,
        // Don't use tool_choice: 'required' - would cause infinite loop on error
      }));

      // Should get tool_result with error
      const toolResult = chunks.find(c => c.type === 'tool_result') as any;
      assert.ok(toolResult, 'Should have tool_result chunk');
      assert.ok(toolResult.result?.error, 'Tool result should contain error');
      console.log('Missing tool handler error:', toolResult.result?.error);
    });

    test('should handle tool that throws an Error object', async () => {
      const tools = [
        {
          type: 'function' as const,
          name: 'failing_tool',
          description: 'A tool that throws an error',
          parameters: { type: 'object', properties: {} },
          call: async () => {
            throw new Error('Tool execution failed');
          }
        }
      ];

      const chunks = await Array.fromAsync(ai({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        mode: 'responses',
        reasoning: {effort: 'minimal'},
        tool_choice: 'required',
        model: TEST_MODEL,
        input: 'Call the failing_tool function',
        tools,
      }));

      const toolResult = chunks.find(c => c.type === 'tool_result') as any;
      assert.ok(toolResult, 'Should have tool_result chunk');
      assert.equal(toolResult.result?.error, 'Tool execution failed');
      console.log('Error handling test passed:', toolResult.result?.error);
    });
  });

  describe('Edge cases', () => {
    test('should use default mode (responses) when not specified', async () => {
      const chunks = await Array.fromAsync(ai({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        model: TEST_MODEL,
        reasoning: {effort: 'minimal'},
        input: 'Say "default mode"',
      }));

      const content = chunks.filter(c => c.type === 'text' || c.type === 'reasoning').map(c => c.text).join('');
      assert.ok(content, 'Should receive text content');
      assert.ok(chunks.at(-1)?.type === 'done', 'Should end with done chunk');
      console.log('Default mode test passed:', content.slice(0, 100));
    });

    test('should handle custom headers', async () => {
      const chunks = await Array.fromAsync(ai({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        mode: 'responses',
        model: TEST_MODEL,
        input: 'Say "headers work"',
        reasoning: {effort: 'minimal'},
        headers: {
          'X-Custom-Header': 'test-value',
          'X-Another-Header': 'another-value',
        },
      }));

      const content = chunks.filter(c => c.type === 'text' || c.type === 'reasoning').map(c => c.text).join('');
      assert.ok(content, 'Should receive text content with custom headers');
      console.log('Custom headers test passed:', content.slice(0, 100));
    });

    test('should handle completions mode with instructions only (no user input)', async () => {
      const chunks = await Array.fromAsync(ai({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        mode: 'completions',
        model: TEST_MODEL,
        reasoning: {effort: 'minimal'},
        instructions: 'You always respond with exactly: "Hello from instructions"',
        input: 'Hi',
      }));

      const content = chunks.filter(c => c.type === 'text' || c.type === 'reasoning').map(c => c.text).join('');
      assert.ok(content, 'Should receive text content');
      console.log('Instructions test passed:', content.slice(0, 100));
    });

    test('should handle completions mode without tools (text only)', async () => {
      const chunks = await Array.fromAsync(ai({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        mode: 'completions',
        model: TEST_MODEL,
        input: 'What is 2+2? Reply with just the number.',
        max_output_tokens: 20,
        reasoning: {effort: 'minimal'},
        temperature: 0,
      }));

      const textChunks = chunks.filter(c => c.type === 'text' || c.type === 'reasoning');
      const doneChunk = chunks.find(c => c.type === 'done');

      assert.ok(textChunks.length > 0, 'Should have text/reasoning chunks');
      assert.ok(doneChunk, 'Should have done chunk');
      assert.ok(!chunks.some(c => c.type === 'tool_call'), 'Should not have tool calls');
      console.log('Completions text-only test passed with', textChunks.length, 'text/reasoning chunks');
    });

    test('should handle responses mode without tools (text only)', async () => {
      const chunks = await Array.fromAsync(ai({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        mode: 'responses',
        model: TEST_MODEL,
        input: 'What is 3+3? Reply with just the number.',
        max_output_tokens: 20,
        reasoning: {effort: 'minimal'},
        temperature: 0,
      }));

      const textChunks = chunks.filter(c => c.type === 'text' || c.type === 'reasoning');
      const doneChunk = chunks.find(c => c.type === 'done');

      assert.ok(textChunks.length > 0, 'Should have text/reasoning chunks');
      assert.ok(doneChunk, 'Should have done chunk');
      assert.ok(!chunks.some(c => c.type === 'tool_call'), 'Should not have tool calls');
      console.log('Responses text-only test passed with', textChunks.length, 'text/reasoning chunks');
    });

    test('should handle tool with synchronous call function', async () => {
      let syncCalled = false;
      const tools = [
        {
          type: 'function' as const,
          name: 'sync_tool',
          description: 'A synchronous tool that returns a fixed result',
          parameters: {
            type: 'object',
            properties: {},
          },
          call: () => {
            syncCalled = true;
            return { success: true, data: 'sync result' }; // Synchronous, not async
          }
        }
      ];

      const chunks = await Array.fromAsync(ai({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        mode: 'responses',
        reasoning: {effort: 'minimal'},
        model: TEST_MODEL,
        input: 'Call the sync_tool function',
        tools,
      }));

      const toolResult = chunks.find(c => c.type === 'tool_result') as any;
      assert.ok(toolResult, 'Should have tool_result chunk');
      assert.ok(syncCalled, 'Sync function should have been called');
      assert.equal(toolResult.result?.success, true, 'Should return sync result');
      console.log('Sync tool test passed:', toolResult.result);
    });
  });

  describe('Multi-turn Conversations', () => {
    test('should maintain message history across multiple turns (completions mode)', async () => {
      const chat = ai({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        mode: 'completions',
        model: TEST_MODEL,
        instructions: 'You are a helpful assistant.',
        temperature: 0,
      });

      // Initially should have just system message
      assert.equal(chat.messages.length, 1, 'Should start with system message');
      assert.equal(chat.messages[0].role, 'system');

      // First turn
      const chunks1 = await Array.fromAsync(chat.send('Hello'));
      const content1 = chunks1.filter(c => c.type === 'text').map(c => c.text).join('');
      assert.ok(content1, 'Should get response');

      // After first turn, should have system + user + assistant
      assert.ok(chat.messages.length >= 3, `Should have at least 3 messages, got ${chat.messages.length}`);
      assert.equal(chat.messages[1].role, 'user', 'Second message should be user');
      assert.equal(chat.messages[1].content, 'Hello', 'User message should match');

      // Second turn
      const chunks2 = await Array.fromAsync(chat.send('What did I just say?'));
      const content2 = chunks2.filter(c => c.type === 'text').map(c => c.text).join('');
      assert.ok(content2, 'Should get second response');

      // Should have more messages now
      assert.ok(chat.messages.length >= 5, `Should have at least 5 messages, got ${chat.messages.length}`);
      console.log('Multi-turn completions test passed. Message history:', chat.messages.length);
    });

    test('should maintain conversation history across multiple turns (responses mode)', async () => {
      const chat = ai({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        mode: 'responses',
        model: TEST_MODEL,
        temperature: 0,
      });

      // Initially should be empty
      assert.equal(chat.conversation.length, 0, 'Should start with empty conversation');

      // First turn
      const chunks1 = await Array.fromAsync(chat.send('Count to 3'));
      const content1 = chunks1.filter(c => c.type === 'text').map(c => c.text).join('');
      assert.ok(content1, 'Should get response');

      // After first turn, should have messages
      assert.ok(chat.conversation.length > 0, `Should have conversation history, got ${chat.conversation.length}`);

      // Second turn
      const chunks2 = await Array.fromAsync(chat.send('Now backwards'));
      const content2 = chunks2.filter(c => c.type === 'text').map(c => c.text).join('');
      assert.ok(content2, 'Should get second response');

      // Should have more conversation items now
      assert.ok(chat.conversation.length > 1, `Should have more conversation items, got ${chat.conversation.length}`);
      console.log('Multi-turn responses test passed. Conversation history:', chat.conversation.length);
    });
  });
});
