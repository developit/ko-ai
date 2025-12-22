import ai from './ai.ts';

const config = {
  baseURL: 'http://localhost:28100/v1',
  model: process.env.MODEL || 'openai/gpt-5-nano',
};

// Basic streaming
async function streamingDemo() {
  let lastId = '';
  for await (const chunk of ai({
    ...config,
    input: 'Count from 1 to 5',
    mode: 'completions',
    reasoning: {effort: 'minimal'},
  })) {
    if ('text' in chunk) {
      if (chunk.item_id !== lastId) {
        lastId = chunk.item_id;
        process.stdout.write('\n' + chunk.type.toUpperCase() + ': \n');
      }
      process.stdout.write(chunk.text);
    }
  }
}

// Tool calling with inline handlers
async function toolDemo() {
  const tools = [
    {
      type: 'function',
      name: 'get_weather',
      description: 'Get weather for a city',
      parameters: {
        type: 'object',
        properties: {location: {type: 'string'}},
        required: ['location'],
      },
      call: ({location}) => ({temp: 72, conditions: 'sunny', location}),
    },
  ];

  let lastId = '';
  for await (const chunk of ai({...config, input: 'Weather in Tokyo?', mode: 'completions', reasoning: {effort: 'minimal'}, tools})) {
    if ('text' in chunk) {
      if (chunk.item_id !== lastId) {
        lastId = chunk.item_id;
        process.stdout.write('\n' + chunk.type.toUpperCase() + ': \n');
      }
      process.stdout.write(chunk.text);
    }
    if (chunk.type === 'tool_call') {
      if (chunk.streaming) continue;
      // console.log(chunk);
      process.stdout.write('\n\n > call: ' + chunk.function.name + '(' + chunk.function.arguments + ')');
    }
    if (chunk.type === 'tool_result') {
      // console.log(chunk);
      process.stdout.write('\n > result: ' + JSON.stringify(chunk.result) + '\n');
    }
  }
}

console.log('STREAMING DEMO');
await streamingDemo();

console.log('\n\nTOOL DEMO');
await toolDemo();

console.log('\n\ndone.');
