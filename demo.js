import ai from './ai.ts';

const config = {
  apiKey: process.env.OPENROUTER_API_KEY || process.env.API_KEY || 'sk-fake',
  baseURL: 'https://openrouter.ai/api/v1',
  model: 'openai/gpt-5-nano',
  // model: '@preset/free-tool-calling',
  // baseURL: 'http://woody.the-millers.ca:11434/v1',
  // model: 'ministral-3:3b',
  /** @type {'completions'} */
  mode: 'completions',
  // stream: false,
};

// Basic streaming
async function streamingDemo() {
  const chat = ai({
    ...config,
    // reasoning: {effort: 'none'},
  });

  let lastType = '';
  let lastId = '';
  for await (const chunk of chat.send('Count from 1 to 5')) {
    if ('text' in chunk) {
      // if (chunk.type !== lastType || chunk.id !== lastId) {
      if (chunk.id !== lastId) {
        lastType = chunk.type;
        lastId = chunk.id;
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
      type: /** @type {'function'} */ ('function'),
      name: 'get_weather',
      description: 'Get weather for a city',
      parameters: {
        type: 'object',
        properties: {location: {type: 'string'}},
        required: ['location'],
      },
      call: (args) => ({temp: 72, conditions: 'sunny', location: args.location}),
    },
  ];

  // const chat = ai({...config, reasoning: {effort: 'none'}, tools});
  const chat = ai({...config, reasoning: {effort: 'minimal'}, tools});

  let lastType = '';
  let lastId = '';
  for await (const chunk of chat.send('Weather in Asakusa?')) {
    if ('text' in chunk) {
      // if (chunk.type !== lastType || chunk.id !== lastId) {
      if (chunk.id !== lastId) {
        lastType = chunk.type;
        lastId = chunk.id;
        process.stdout.write('\n' + chunk.type.toUpperCase() + ': \n');
      }
      process.stdout.write(chunk.text);
    }
    if (chunk.type === 'tool_call') {
      if (chunk.streaming) continue;
      process.stdout.write('\n\n > call: ' + chunk.function.name + '(' + chunk.function.arguments + ')');
    }
    if (chunk.type === 'tool_result') {
      process.stdout.write('\n > result: ' + JSON.stringify(chunk.result) + '\n');
    }
  }
}

console.log('STREAMING DEMO');
await streamingDemo();

console.log('\n\nTOOL DEMO');
await toolDemo();

console.log('\n\ndone.');
