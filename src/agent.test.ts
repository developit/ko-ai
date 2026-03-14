import { describe, after } from 'node:test';
import assert from 'node:assert/strict';
import agent, { type AgentEvent } from './agent.ts';
import { createFixtureManager, recordReplayTest } from '../test/record-replay.ts';

const fixtureManager = createFixtureManager();

const LIVE_API_KEY = process.env.OPENROUTER_API_KEY;
const TEST_BASE_URL = 'https://openrouter.ai/api/v1';
const TEST_API_KEY = LIVE_API_KEY || 'mock-api-key';
const TEST_MODEL = 'openai/gpt-5-nano';

after(() => {
  fixtureManager.cleanup();
});

/** Collect all events from a prompt */
async function collect(iter: AsyncIterableIterator<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const e of iter) events.push(e);
  return events;
}

describe('Agent SDK', () => {
  recordReplayTest(
    fixtureManager,
    'agent-basic-prompt',
    'responses',
    async () => {
      const a = agent({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        model: TEST_MODEL,
        mode: 'responses',
        reasoning: { effort: 'minimal' },
        max_output_tokens: 50,
        temperature: 0,
      });

      const events = await collect(a.prompt('Reply with "Agent works" and nothing else'));
      const types = events.map(e => e.type);

      assert.equal(types[0], 'agent_start', 'Should start with agent_start');
      assert.equal(types[1], 'turn_start', 'Second should be turn_start');
      assert.equal(types.at(-1), 'agent_end', 'Should end with agent_end');
      assert.ok(types.includes('text') || types.includes('reasoning'), 'Should have text or reasoning');
      assert.ok(types.includes('done'), 'Should have done');
      assert.ok(types.includes('turn_end'), 'Should have turn_end');

      const text = events
        .filter((e): e is Extract<AgentEvent, { type: 'text' }> => e.type === 'text')
        .map(e => e.text)
        .join('');
      assert.ok(text, 'Should have non-empty text');
      console.log('Agent basic prompt:', text.slice(0, 100));
    },
  );

  recordReplayTest(
    fixtureManager,
    'agent-tool-calling',
    'responses',
    async () => {
      const a = agent({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        model: TEST_MODEL,
        mode: 'responses',
        reasoning: { effort: 'minimal' },
        temperature: 0,
        tools: [
          {
            type: 'function',
            name: 'get_weather',
            description: 'Get weather for a city',
            parameters: {
              type: 'object',
              properties: { city: { type: 'string' } },
              required: ['city'],
            },
            call: async ({ city }: any) => ({ temperature: 72, city }),
          },
        ],
      });

      const events = await collect(a.prompt('What is the weather in Paris? Use the get_weather tool.'));
      const types = events.map(e => e.type);

      assert.ok(types.includes('tool_call'), 'Should have tool_call');
      assert.ok(types.includes('tool_result'), 'Should have tool_result');
      assert.ok(types.includes('text') || types.includes('reasoning'), 'Should have text after tool result');
      console.log('Agent tool calling: chunks =', types.join(', '));
    },
  );

  recordReplayTest(
    fixtureManager,
    'agent-on-tool-call-wrapper',
    'responses',
    async () => {
      const log: string[] = [];

      const a = agent({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        model: TEST_MODEL,
        mode: 'responses',
        reasoning: { effort: 'minimal' },
        temperature: 0,
        tools: [
          {
            type: 'function',
            name: 'add',
            description: 'Add two numbers',
            parameters: {
              type: 'object',
              properties: { a: { type: 'number' }, b: { type: 'number' } },
              required: ['a', 'b'],
            },
            call: async ({ a, b }: any) => ({ result: a + b }),
          },
        ],
        onToolCall: async (name, args, call) => {
          log.push(`before:${name}`);
          const result = await call(args);
          log.push(`after:${name}`);
          return result;
        },
      });

      const events = await collect(a.prompt('Calculate 3 + 4 using the add tool'));

      assert.ok(log.includes('before:add'), 'onToolCall should fire before');
      assert.ok(log.includes('after:add'), 'onToolCall should fire after');
      assert.ok(log.indexOf('before:add') < log.indexOf('after:add'), 'before should come before after');
      console.log('Agent onToolCall wrapper:', log);
    },
  );

  recordReplayTest(
    fixtureManager,
    'agent-on-tool-call-skip',
    'responses',
    async () => {
      const a = agent({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        model: TEST_MODEL,
        mode: 'responses',
        reasoning: { effort: 'minimal' },
        temperature: 0,
        tools: [
          {
            type: 'function',
            name: 'dangerous_tool',
            description: 'A tool that should be blocked',
            parameters: { type: 'object', properties: {} },
            call: async () => {
              throw new Error('Should not be called');
            },
          },
        ],
        onToolCall: async (_name, _args, _call) => {
          // Skip the call entirely
          return { blocked: true, reason: 'Tool execution was skipped by onToolCall' };
        },
      });

      const events = await collect(a.prompt('Call the dangerous_tool'));
      const toolResults = events.filter(e => e.type === 'tool_result') as any[];

      assert.ok(toolResults.length > 0, 'Should have tool_result');
      assert.ok(toolResults[0].result?.blocked, 'Result should show blocked');
      console.log('Agent onToolCall skip:', toolResults[0].result);
    },
  );

  recordReplayTest(
    fixtureManager,
    'agent-completions-mode',
    'completions',
    async () => {
      const a = agent({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        model: TEST_MODEL,
        mode: 'completions',
        reasoning: { effort: 'minimal' },
        max_output_tokens: 50,
        temperature: 0,
        instructions: 'You are a helpful assistant.',
      });

      const events = await collect(a.prompt('Reply with "Completions agent works" and nothing else'));
      const types = events.map(e => e.type);

      assert.equal(types[0], 'agent_start');
      assert.equal(types.at(-1), 'agent_end');
      assert.ok(types.includes('text') || types.includes('reasoning'));
      console.log('Agent completions mode: event types =', [...new Set(types)].join(', '));
    },
  );

  recordReplayTest(
    fixtureManager,
    'agent-session-access',
    'completions',
    async () => {
      const a = agent({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        model: TEST_MODEL,
        mode: 'completions',
        reasoning: { effort: 'minimal' },
        max_output_tokens: 50,
        temperature: 0,
        instructions: 'You are a helpful assistant.',
      });

      // Session should be accessible
      assert.ok(a.session, 'Should have session');
      assert.ok(Array.isArray(a.session.messages), 'Should have messages array');

      // Before any prompt, should have system message from instructions
      assert.equal(a.session.messages.length, 1);
      assert.equal(a.session.messages[0].role, 'system');

      await collect(a.prompt('Hi'));

      // After prompt, should have user + assistant messages
      assert.ok(a.session.messages.length >= 3, `Should have >= 3 messages, got ${a.session.messages.length}`);
      console.log('Agent session access: messages =', a.session.messages.length);
    },
  );
});
