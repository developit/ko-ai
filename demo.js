import ai from './dist/ai.js';

const config = {
  apiKey: '1',
  baseURL: 'https://proxy-shopify-ai.local.shop.dev/v1',
  model: 'gpt-4o-mini',
};

// Basic streaming
async function streamingDemo() {
  let text = '';
  for await (const chunk of ai({
    ...config,
    input: 'Count from 1 to 5',
    max_output_tokens: 50,
  })) {
    if (chunk.type === 'text') text += chunk.text;
  }
  console.log('Streaming:', text);
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

  let text = '';
  for await (const chunk of ai({...config, input: 'Weather in Tokyo?', tools})) {
    if (chunk.type === 'text') text += chunk.text;
  }
  console.log('Tool call:', text);
}

await streamingDemo();
await toolDemo();
