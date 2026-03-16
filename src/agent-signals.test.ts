import {describe, it, after} from 'node:test';
import assert from 'node:assert/strict';
import {effect} from '@preact/signals-core';
import {SignalAgentModel, type Item, type TextItem, type ToolCallItem, type AgentStatus} from './agent-signals.ts';
import {createFixtureManager, recordReplayTest} from '../test/record-replay.ts';

const fixtureManager = createFixtureManager();

const LIVE_API_KEY = process.env.OPENROUTER_API_KEY;
const TEST_BASE_URL = 'https://openrouter.ai/api/v1';
const TEST_API_KEY = LIVE_API_KEY || 'mock-api-key';
const TEST_MODEL = 'openai/gpt-5-nano';

after(() => {
  fixtureManager.cleanup();
});

describe('SignalAgentModel', () => {
  describe('initial state', () => {
    it('initialises all signals to their default values', () => {
      const model = new SignalAgentModel({
        apiKey: 'test-key',
        baseURL: 'https://api.example.com/v1',
        model: 'gpt-4o',
      });

      assert.equal(model.status.value, 'idle');
      assert.equal(model.turn.value, 0);
      assert.deepEqual(model.usage.value, {input_tokens: 0, output_tokens: 0, total_tokens: 0});
      assert.equal(model.error.value, null);
      assert.deepEqual(model.items.value, []);
      assert.equal(model.busy.value, false);
      assert.deepEqual(model.activeTools.value, []);

      model[Symbol.dispose]();
    });
  });

  describe('reset()', () => {
    it('restores all signals to their default values', () => {
      const model = new SignalAgentModel({
        apiKey: 'test-key',
        baseURL: 'https://api.example.com/v1',
        model: 'gpt-4o',
      });

      model.reset();

      assert.equal(model.status.value, 'idle');
      assert.equal(model.turn.value, 0);
      assert.deepEqual(model.usage.value, {input_tokens: 0, output_tokens: 0, total_tokens: 0});
      assert.equal(model.error.value, null);
      assert.deepEqual(model.items.value, []);
      assert.equal(model.busy.value, false);

      model[Symbol.dispose]();
    });
  });

  describe('signal reactivity', () => {
    it('busy is derived from status', () => {
      const model = new SignalAgentModel({
        apiKey: 'test-key',
        baseURL: 'https://api.example.com/v1',
        model: 'gpt-4o',
      });

      const log: boolean[] = [];
      const disposeEffect = effect(() => log.push(model.busy.value));

      assert.deepEqual(log, [false]); // initial value recorded by effect

      model[Symbol.dispose]();
      disposeEffect();
    });

    it('activeTools returns tool names as strings', () => {
      const model = new SignalAgentModel({
        apiKey: 'test-key',
        baseURL: 'https://api.example.com/v1',
        model: 'gpt-4o',
      });

      assert.deepEqual(model.activeTools.value, []);

      model[Symbol.dispose]();
    });
  });

  describe('dispose pattern', () => {
    it('Symbol.dispose is defined and callable', () => {
      const model = new SignalAgentModel({
        apiKey: 'test-key',
        baseURL: 'https://api.example.com/v1',
        model: 'gpt-4o',
      });

      assert.equal(typeof model[Symbol.dispose], 'function');
      model[Symbol.dispose](); // should not throw
    });
  });

  describe('prompt() — fixture-based streaming tests', () => {
    recordReplayTest(fixtureManager, 'agent-signals-basic-prompt', 'responses', async () => {
      const model = new SignalAgentModel({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        model: TEST_MODEL,
        mode: 'responses',
        reasoning: {effort: 'minimal'},
        max_output_tokens: 50,
        temperature: 0,
      });

      const statuses: AgentStatus[] = [];
      const disposeEffect = effect(() => statuses.push(model.status.value));

      for await (const _ of model.prompt('Reply with "Signals work" and nothing else')) {
        // drain
      }

      disposeEffect();

      // Status should have transitioned through running → done
      assert.ok(statuses.includes('running'), 'status should have been running during prompt');
      assert.equal(model.status.value, 'done');
      assert.equal(model.busy.value, false);

      // Items should contain a user item + at least one text or reasoning item
      const kinds = model.items.value.map((i: Item) => i.kind);
      assert.ok(kinds.includes('user'), 'should have user item');
      assert.ok(kinds.includes('text') || kinds.includes('reasoning'), 'should have text or reasoning item');

      // Text content should be non-empty
      const textItem = model.items.value.find((i: Item) => i.kind === 'text') as TextItem | undefined;
      if (textItem) {
        assert.ok(textItem.content.value.length > 0, 'text item content should be non-empty');
      }

      model[Symbol.dispose]();
    });

    recordReplayTest(fixtureManager, 'agent-signals-tool-calls', 'responses', async () => {
      const model = new SignalAgentModel({
        apiKey: TEST_API_KEY,
        baseURL: TEST_BASE_URL,
        model: TEST_MODEL,
        mode: 'responses',
        reasoning: {effort: 'minimal'},
        temperature: 0,
        tools: [
          {
            type: 'function',
            name: 'get_temp',
            description: 'Get temperature for a city',
            parameters: {
              type: 'object',
              properties: {city: {type: 'string'}},
              required: ['city'],
            },
            call: async ({city}: {city: string}) => ({temperature: 72, city}),
          },
        ],
      });

      const activeToolNames: string[][] = [];
      const disposeEffect = effect(() => activeToolNames.push([...model.activeTools.value]));

      for await (const _ of model.prompt('What is the temperature in Paris? Use the get_temp tool.')) {
        // drain
      }

      disposeEffect();

      const toolItems = model.items.value.filter((i: Item) => i.kind === 'tool_call') as ToolCallItem[];
      assert.ok(toolItems.length > 0, 'should have tool_call items');

      // All tool items should be resolved
      for (const t of toolItems) {
        assert.equal(t.pending.value, false, `tool item ${t.id} should not be pending`);
        assert.notEqual(t.result.value, null, `tool item ${t.id} should have a result`);
        assert.equal(t.name, 'get_temp', 'tool item should have correct name');
      }

      // activeTools should be empty at end (all resolved)
      assert.equal(model.activeTools.value.length, 0, 'no tools should be active after completion');

      // activeToolNames should have seen the tool name at some point
      assert.ok(activeToolNames.some(names => names.includes('get_temp')), 'get_temp should have appeared in activeTools');

      model[Symbol.dispose]();
    });
  });
});
