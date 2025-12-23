import ai from './ai.ts';

const config = {
  apiKey: process.env.API_KEY || 'sk-fake',
  baseURL: 'http://localhost:28100/v1',
  model: process.env.MODEL || 'openai/gpt-5-nano',
  mode: /** @type {'completions'} */ ('completions'),
  reasoning: {effort: 'minimal'},
};

// Multi-turn conversation demo
async function conversationDemo() {
  console.log('MULTI-TURN CONVERSATION DEMO');
  const chat = ai({...config, instructions: 'You are a helpful assistant.'});

  console.log('\n> Turn 1: Count from 1 to 3');
  for await (const chunk of chat.send('Count from 1 to 3')) {
    if (chunk.type === 'text') process.stdout.write(chunk.text);
  }

  console.log('\n\n> Turn 2: Now count backwards');
  for await (const chunk of chat.send('Now count backwards')) {
    if (chunk.type === 'text') process.stdout.write(chunk.text);
  }

  console.log('\n\n> Message history:', chat.messages.length, 'messages');
}

// Tool calling with multi-turn conversation
async function toolDemo() {
  console.log('\n\nMULTI-TURN TOOL DEMO');
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

  const chat = ai({...config, tools});

  console.log('\n> Turn 1: Ask about weather');
  for await (const chunk of chat.send('Weather in Tokyo?')) {
    if (chunk.type === 'text') {
      process.stdout.write(chunk.text);
    }
    if (chunk.type === 'tool_call' && !chunk.streaming) {
      process.stdout.write('\n > call: ' + chunk.function.name + '(' + chunk.function.arguments + ')');
    }
    if (chunk.type === 'tool_result') {
      process.stdout.write('\n > result: ' + JSON.stringify(chunk.result) + '\n');
    }
  }

  console.log('\n\n> Turn 2: Follow-up question');
  for await (const chunk of chat.send('What about Paris?')) {
    if (chunk.type === 'text') {
      process.stdout.write(chunk.text);
    }
    if (chunk.type === 'tool_call' && !chunk.streaming) {
      process.stdout.write('\n > call: ' + chunk.function.name + '(' + chunk.function.arguments + ')');
    }
    if (chunk.type === 'tool_result') {
      process.stdout.write('\n > result: ' + JSON.stringify(chunk.result) + '\n');
    }
  }

  console.log('\n\n> Message history:', chat.messages.length, 'messages');
}

await conversationDemo();
await toolDemo();

console.log('\n\ndone.');
