#!/usr/bin/env node

import * as readline from 'node:readline';
import {exec} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import ai, {type Tool, type StreamChunk} from './ai.ts';

const execAsync = promisify(exec);

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: {
    command?: string;
    model?: string;
    prompt?: string;
    help?: boolean;
    verbose?: boolean;
  } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--model' && args[i + 1]) {
      parsed.model = args[++i];
    } else if (arg === '--prompt' && args[i + 1]) {
      parsed.prompt = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      parsed.verbose = true;
    } else if (!arg.startsWith('-')) {
      parsed.command = arg;
    }
  }

  return parsed;
}

const args = parseArgs();

// Configuration
const API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
const BASE_URL = process.env.OPENROUTER_BASE_URL || process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';
const MODEL = args.model || process.env.MODEL || 'anthropic/claude-3.5-sonnet';

// Built-in tools
const tools: Tool[] = [
  {
    type: 'function',
    name: 'web_search',
    description: 'Search the web for information. Returns search results with titles, URLs, and snippets.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
      },
      required: ['query'],
    },
    async call(args: Record<string, unknown>) {
      const query = args.query as string;
      // Using DuckDuckGo's instant answer API (simple and no API key needed)
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
      const response = await fetch(url);
      const data = await response.json() as any;

      return {
        query,
        abstract: data.Abstract || 'No results found',
        abstract_url: data.AbstractURL || '',
        related_topics: data.RelatedTopics?.slice(0, 5).map((t: any) => ({
          text: t.Text,
          url: t.FirstURL,
        })) || [],
      };
    },
  },
  {
    type: 'function',
    name: 'fetch',
    description: 'Fetch content from a URL. Returns the response body as text.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch',
        },
        method: {
          type: 'string',
          description: 'HTTP method (GET, POST, etc.)',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        },
        headers: {
          type: 'object',
          description: 'Optional HTTP headers',
        },
        body: {
          type: 'string',
          description: 'Optional request body',
        },
      },
      required: ['url'],
    },
    async call(args: Record<string, unknown>) {
      const {url, method = 'GET', headers, body} = args as {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      };

      const response = await fetch(url, {
        method,
        headers: headers as HeadersInit,
        body,
      });

      const text = await response.text();
      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: text.slice(0, 10000), // Limit to 10KB
      };
    },
  },
  {
    type: 'function',
    name: 'shell',
    description: 'Execute a shell (Bash) command. Useful for invoking ls/ps/du/find/grep/awk/ps/npm/pnpm/etc. Returns stdout, stderr, and exit code.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command/script to execute',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000)',
          default: 30000,
        },
      },
      required: ['command'],
    },
    async call(args: Record<string, unknown>) {
      const {command, timeout = 30000} = args as {
        command: string;
        timeout?: number;
      };

      try {
        const {stdout, stderr} = await execAsync(command, {
          timeout: timeout as number,
          maxBuffer: 1024 * 1024, // 1MB
        });

        return {
          stdout: stdout.slice(0, 5000), // Limit output
          stderr: stderr.slice(0, 5000),
          exitCode: 0,
        };
      } catch (error: any) {
        return {
          stdout: error.stdout?.slice(0, 5000) || '',
          stderr: error.stderr?.slice(0, 5000) || error.message,
          exitCode: error.code || 1,
        };
      }
    },
  },
  {
    type: 'function',
    name: 'read_file',
    description: 'Read the contents of a file from the filesystem. Returns the file content as text.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The file path to read (relative or absolute)',
        },
        encoding: {
          type: 'string',
          description: 'File encoding (default: utf8)',
          enum: ['utf8', 'ascii', 'base64', 'hex'],
        },
      },
      required: ['path'],
    },
    async call(args: Record<string, unknown>) {
      const {path, encoding = 'utf8'} = args as {
        path: string;
        encoding?: BufferEncoding;
      };

      try {
        const content = await readFile(path, encoding);
        return {
          path,
          encoding,
          content: content.toString().slice(0, 50000), // Limit to 50KB
          size: content.length,
        };
      } catch (error: any) {
        return {
          path,
          error: error.message,
          code: error.code,
        };
      }
    },
  },
];

// ANSI colors for better UX
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

function showHelp() {
  console.log(`
${colors.bright}${colors.cyan}AI Chat CLI${colors.reset}

${colors.bright}Usage:${colors.reset}
  cli.ts [command] [options]

${colors.bright}Commands:${colors.reset}
  ${colors.green}(none)${colors.reset}    Start interactive chat (default)
  ${colors.green}models${colors.reset}    List available models from the API

${colors.bright}Options:${colors.reset}
  ${colors.green}--model${colors.reset} <name>    Specify model to use
  ${colors.green}--prompt${colors.reset} <text>   Send an initial prompt immediately
  ${colors.green}--verbose, -v${colors.reset}     Show reasoning and detailed tool information
  ${colors.green}--help, -h${colors.reset}        Show this help message

${colors.bright}Environment Variables:${colors.reset}
  ${colors.green}OPENROUTER_API_KEY${colors.reset} or ${colors.green}OPENAI_API_KEY${colors.reset}  (required)
  ${colors.green}OPENROUTER_BASE_URL${colors.reset} or ${colors.green}OPENAI_BASE_URL${colors.reset}
  ${colors.green}MODEL${colors.reset}              Default model name

${colors.bright}Examples:${colors.reset}
  cli.ts
  cli.ts --model anthropic/claude-3.5-sonnet
  cli.ts --prompt "What's the weather like today?"
  cli.ts models
`);
}

async function listModels() {
  // if (!API_KEY) {
  //   console.error(`${colors.red}Error: OPENROUTER_API_KEY or OPENAI_API_KEY environment variable is required${colors.reset}`);
  //   process.exit(1);
  // }

  console.log(`${colors.bright}${colors.cyan}📋 Available Models${colors.reset}`);
  console.log(`${colors.dim}Fetching from ${BASE_URL}/models...${colors.reset}\n`);

  try {
    const response = await fetch(`${BASE_URL}/models`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as {data: Array<{id: string; name?: string; description?: string; context_length?: number}>};

    if (!data.data || data.data.length === 0) {
      console.log(`${colors.yellow}No models found${colors.reset}`);
      return;
    }

    // Sort by id
    const models = data.data.sort((a, b) => a.id.localeCompare(b.id));

    for (const model of models) {
      console.log(`${colors.bright}${colors.green}${model.id}${colors.reset}`);
      if (model.name && model.name !== model.id) {
        console.log(`  ${colors.dim}Name: ${model.name}${colors.reset}`);
      }
      if (model.context_length) {
        console.log(`  ${colors.dim}Context: ${model.context_length.toLocaleString()} tokens${colors.reset}`);
      }
      if (model.description) {
        console.log(`  ${colors.dim}${model.description}${colors.reset}`);
      }
      console.log();
    }

    console.log(`${colors.dim}Total: ${models.length} models${colors.reset}`);
  } catch (error: any) {
    console.error(`${colors.red}Error fetching models: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

async function chat() {
  // if (!API_KEY) {
  //   console.error('Error: OPENROUTER_API_KEY or OPENAI_API_KEY environment variable is required');
  //   process.exit(1);
  // }

  const verbose = args.verbose || false;

  console.log(`${colors.bright}${colors.cyan}🤖 AI Chat CLI${colors.reset}`);
  console.log(`${colors.dim}Model: ${MODEL}${colors.reset}`);
  if (verbose) {
    console.log(`${colors.dim}Verbose mode: enabled${colors.reset}`);
  }
  console.log(`${colors.dim}Type 'exit' or 'quit' to end the conversation${colors.reset}\n`);

  // Create chat session with persistent conversation history
  const session = ai({
    apiKey: API_KEY,
    baseURL: BASE_URL,
    model: MODEL,
    instructions: 'You are a helpful AI assistant with access to web search, HTTP fetch, shell (bash) commands, and file reading tools. Always think about how you can use these tools to fulfill the user\'s request before attempting to remember something on your own. Use tools as much as and often as you can to produce the best possible answers. Be concise and helpful.',
    tools,
    // reasoning: {effort: 'medium'},
    reasoning: {enabled: true},
    stream: true,
  });

  // Handle a message from the user
  const handleMessage = async (input: string) => {
    // Start assistant response
    process.stdout.write(`${colors.blue}Assistant: ${colors.reset}`);

    try {
      let currentToolCall: string | null = null;

      for await (const chunk of session.send(input)) {
        switch (chunk.type) {
          case 'text':
            process.stdout.write(chunk.text);
            break;

          case 'reasoning':
            process.stdout.write(`${colors.dim}${colors.magenta}${chunk.text}${colors.reset}`);
            // if (verbose) {
            //   process.stdout.write(`${colors.dim}${colors.magenta}[reasoning: ${chunk.text}]${colors.reset}`);
            // }
            break;

          case 'tool_call':
            if (!chunk.streaming) {
              // Tool call complete, show what we're calling
              const args = JSON.parse(chunk.function.arguments || '{}');
              console.log(`\n${colors.yellow}🔧 ${chunk.function.name}(${JSON.stringify(args, null, 2)})${colors.reset}`);
              // if (verbose) {
              // } else {
              //   console.log(`\n${colors.yellow}🔧 ${chunk.function.name}()${colors.reset}`);
              // }
              currentToolCall = chunk.function.name;
            }
            break;

          case 'tool_result':
            // Show tool result
            if (currentToolCall) {
              if (verbose) {
                console.log(`${colors.dim}✓ ${currentToolCall} → ${JSON.stringify(chunk.result, null, 2)}${colors.reset}`);
              } else {
                console.log(`${colors.dim}✓ ${currentToolCall} completed${colors.reset}`);
              }
              currentToolCall = null;
            }
            break;

          case 'done':
            console.log('\n');
            break;
        }
      }
    } catch (error: any) {
      console.error(`\n${colors.red}Error: ${error.message}${colors.reset}\n`);
    }
  };

  // Send initial prompt if provided
  if (args.prompt) {
    console.log(`${colors.green}You: ${colors.reset}${args.prompt}\n`);
    await handleMessage(args.prompt);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.green}You: ${colors.reset}`,
  });

  rl.prompt();

  for await (const line of rl) {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      continue;
    }

    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      console.log(`${colors.dim}Goodbye!${colors.reset}`);
      process.exit(0);
    }

    await handleMessage(input);
    rl.prompt();
  }
}

// Handle clean exit
process.on('SIGINT', () => {
  console.log(`\n${colors.dim}Goodbye!${colors.reset}`);
  process.exit(0);
});

// Main execution
if (args.help) {
  showHelp();
  process.exit(0);
}

switch (args.command) {
  case 'models':
    listModels();
    break;
  default:
    chat();
    break;
}
