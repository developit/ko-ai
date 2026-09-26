import {afterEach, describe, test} from 'node:test';
import assert from 'node:assert/strict';
import ai from './index.ts';
import agent from './agent.ts';

/** Stub fetch: each call takes the next handler; records request bodies. */
function stub(...handlers: ((body: any) => Response | Promise<Response>)[]) {
  const bodies: any[] = [];
  globalThis.fetch = (async (_url: any, init: any) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    const h = handlers[bodies.length - 1];
    if (!h) throw new Error('unexpected request');
    return h(body);
  }) as typeof fetch;
  return bodies;
}

const sse = (...frames: unknown[]) =>
  new Response(frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join('') + 'data: [DONE]\n\n');
const text = (t: string) => ({id: 'g', choices: [{index: 0, delta: {content: t}}]});
const call = (name: string, args: string, id = 'c1') => ({
  id: 'g',
  choices: [{index: 0, delta: {tool_calls: [{index: 0, id, type: 'function', function: {name, arguments: args}}]}}],
});

const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
});

const client = (extra: Record<string, unknown> = {}) =>
  ai({apiKey: 'k', baseURL: 'https://api.test/v1', mode: 'completions', model: 'm', retryDelay: 1, ...extra});

describe('resilience', () => {
  test('malformed tool arguments go back to the model instead of throwing', async () => {
    let called = false;
    const bodies = stub(
      () => sse(call('add', '{"a":1,')),
      () => sse(text('fixed')),
    );
    const chat = client({
      tools: [{type: 'function', name: 'add', description: '', parameters: {}, call: () => (called = true)}],
    });
    const chunks = await Array.fromAsync(chat.send('hi'));
    assert.equal(called, false);
    const result = chunks.find((c) => c.type === 'tool_result') as any;
    assert.ok(result.result.error, 'parse error comes back as a tool error');
    const toolMsg = bodies[1].messages.find((m: any) => m.role === 'tool');
    assert.match(toolMsg.content, /"error"/);
    assert.equal(chunks.at(-1)!.type, 'done');
  });

  test('retries 429 and 5xx, honoring Retry-After; errors keep their status', async () => {
    let t0 = 0;
    stub(
      () => {
        t0 = Date.now();
        return new Response('slow down', {status: 429, headers: {'retry-after': '0.05'}});
      },
      () => new Response('oops', {status: 503}),
      () => sse(text('ok')),
    );
    const chunks = await Array.fromAsync(client().send('hi'));
    assert.ok(Date.now() - t0 >= 45, 'waited for Retry-After');
    assert.equal(chunks.filter((c) => c.type === 'text').map((c: any) => c.text).join(''), 'ok');

    stub(() => new Response('bad key', {status: 401}));
    await assert.rejects(Array.fromAsync(client().send('hi')), (e: any) => e.status === 401 && e.message === 'bad key');

    stub(
      () => new Response('down', {status: 500}),
      () => new Response('down', {status: 500}),
    );
    await assert.rejects(Array.fromAsync(client({retries: 1}).send('hi')), (e: any) => e.status === 500);
  });

  test('retries network errors but not aborts', async () => {
    stub(
      () => {
        throw new TypeError('fetch failed');
      },
      () => sse(text('ok')),
    );
    const chunks = await Array.fromAsync(client().send('hi'));
    assert.equal(chunks.at(-1)!.type, 'done');

    const ctl = new AbortController();
    const bodies = stub(() => {
      ctl.abort();
      throw new DOMException('aborted', 'AbortError');
    });
    await assert.rejects(Array.fromAsync(client().send('hi', {}, ctl.signal)));
    assert.equal(bodies.length, 1);
  });

  test('maxToolRounds forces a text answer', async () => {
    let calls = 0;
    const bodies = stub(
      () => sse(call('ping', '{}', 'c1')),
      () => sse(text('done pinging')),
    );
    const chat = client({
      maxToolRounds: 1,
      tools: [{type: 'function', name: 'ping', description: '', parameters: {}, call: () => ++calls}],
    });
    await Array.fromAsync(chat.send('go'));
    assert.equal(calls, 1);
    assert.equal(bodies[1].tool_choice, 'none');
    for (const k of ['retries', 'retryDelay', 'maxToolRounds']) assert.equal(k in bodies[0], false, `${k} not sent`);

    // A model that ignores tool_choice "none" doesn't get its calls run.
    stub(
      () => sse(call('ping', '{}', 'c1')),
      () => sse(call('ping', '{}', 'c2')),
    );
    calls = 0;
    const chunks = await Array.fromAsync(chat.send('again'));
    assert.equal(calls, 1);
    assert.equal(chunks.at(-1)!.type, 'done');
  });

  test('usage is a typed chunk, including a trailing choices:[] chunk', async () => {
    stub(() => sse(text('hi'), {id: 'g', choices: [], usage: {prompt_tokens: 7, completion_tokens: 3, cost: 0.001}}));
    const chunks = await Array.fromAsync(client().send('hi'));
    const usage = chunks.find((c) => c.type === 'usage') as any;
    assert.deepEqual(usage.usage, {prompt_tokens: 7, completion_tokens: 3, cost: 0.001});

    stub(() => sse(text('hi'), {id: 'g', choices: [], usage: {prompt_tokens: 7, completion_tokens: 3}}));
    const a = agent({apiKey: 'k', baseURL: 'https://api.test/v1', mode: 'completions', model: 'm'});
    await Array.fromAsync(a.prompt('hi'));
    assert.deepEqual(a.usage, {input_tokens: 7, output_tokens: 3, total_tokens: 10});
  });

  test('tool call history carries only wire fields', async () => {
    const bodies = stub(
      () => sse(call('ping', '{}')),
      () => sse(text('ok')),
    );
    const chat = client({tools: [{type: 'function', name: 'ping', description: '', parameters: {}, call: () => 1}]});
    await Array.fromAsync(chat.send('go'));
    const assistant = bodies[1].messages.find((m: any) => m.tool_calls);
    assert.deepEqual(assistant.tool_calls, [{id: 'c1', type: 'function', function: {name: 'ping', arguments: '{}'}}]);
  });
});
