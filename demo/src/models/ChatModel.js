import { createModel, signal } from '@preact/signals';
import ai from 'koai';
import { Bash } from 'just-bash';

export const ChatModel = createModel(function ChatModel(appModel) {
  const messages = signal([]);
  const input = signal('');
  const isStreaming = signal(false);
  const bash = signal(null);
  const fileHandle = signal(null);

  // Initialize bash environment
  const initBash = () => {
    if (!bash.value) {
      bash.value = new Bash({
        cwd: '/home/user',
        files: {
          '/home/user/README.md': '# Welcome to the AI Chat Assistant\n\nYou can use the bash tool to execute commands.'
        }
      });
    }
  };

  // File System Access API - Request directory access
  const requestDirectoryAccess = async () => {
    try {
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite'
      });
      fileHandle.value = handle;
      addMessage({
        role: 'system',
        content: `Directory access granted: ${handle.name}`
      });
      return handle;
    } catch (err) {
      if (err.name !== 'AbortError') {
        addMessage({
          role: 'system',
          content: `Error accessing directory: ${err.message}`
        });
      }
      return null;
    }
  };

  // Read file using File System Access API
  const readFile = async (path) => {
    try {
      if (!fileHandle.value) {
        throw new Error('No directory access granted');
      }

      const parts = path.split('/').filter(p => p);
      let handle = fileHandle.value;

      for (let i = 0; i < parts.length - 1; i++) {
        handle = await handle.getDirectoryHandle(parts[i]);
      }

      const fHandle = await handle.getFileHandle(parts[parts.length - 1]);
      const file = await fHandle.getFile();
      const content = await file.text();

      return { success: true, content };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Write file using File System Access API
  const writeFile = async (path, content) => {
    try {
      if (!fileHandle.value) {
        throw new Error('No directory access granted');
      }

      const parts = path.split('/').filter(p => p);
      let handle = fileHandle.value;

      for (let i = 0; i < parts.length - 1; i++) {
        handle = await handle.getDirectoryHandle(parts[i], { create: true });
      }

      const fHandle = await handle.getFileHandle(parts[parts.length - 1], { create: true });
      const writable = await fHandle.createWritable();
      await writable.write(content);
      await writable.close();

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // List files in directory
  const listFiles = async (path = '') => {
    try {
      if (!fileHandle.value) {
        throw new Error('No directory access granted');
      }

      let handle = fileHandle.value;

      if (path) {
        const parts = path.split('/').filter(p => p);
        for (const part of parts) {
          handle = await handle.getDirectoryHandle(part);
        }
      }

      const files = [];
      for await (const entry of handle.values()) {
        files.push({
          name: entry.name,
          kind: entry.kind
        });
      }

      return { success: true, files };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Define tools for AI
  const getTools = () => {
    initBash();

    return [
      {
        type: 'function',
        name: 'bash',
        description: 'Execute bash commands in a sandboxed environment with virtual filesystem',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The bash command to execute'
            }
          },
          required: ['command']
        },
        call: async ({ command }) => {
          try {
            const result = await bash.value.exec(command);
            return {
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.exitCode
            };
          } catch (err) {
            return {
              stdout: '',
              stderr: err.message,
              exitCode: 1
            };
          }
        }
      },
      {
        type: 'function',
        name: 'request_directory_access',
        description: 'Request access to a directory on the user\'s file system',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        },
        call: async () => {
          const handle = await requestDirectoryAccess();
          return handle ? { success: true, message: 'Directory access granted' } : { success: false };
        }
      },
      {
        type: 'function',
        name: 'read_file',
        description: 'Read a file from the user\'s filesystem (requires directory access)',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file relative to the accessed directory'
            }
          },
          required: ['path']
        },
        call: async ({ path }) => {
          return await readFile(path);
        }
      },
      {
        type: 'function',
        name: 'write_file',
        description: 'Write content to a file in the user\'s filesystem (requires directory access)',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file relative to the accessed directory'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            }
          },
          required: ['path', 'content']
        },
        call: async ({ path, content }) => {
          return await writeFile(path, content);
        }
      },
      {
        type: 'function',
        name: 'list_files',
        description: 'List files and directories in the user\'s filesystem (requires directory access)',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the directory relative to the accessed directory (empty for root)'
            }
          },
          required: []
        },
        call: async ({ path }) => {
          return await listFiles(path || '');
        }
      }
    ];
  };

  // Add message to history
  const addMessage = (message) => {
    messages.value = [...messages.value, message];
  };

  // Send message to AI
  const sendMessage = async () => {
    const userMessage = input.value.trim();
    if (!userMessage || isStreaming.value) return;

    // Add user message
    addMessage({
      role: 'user',
      content: userMessage
    });

    // Clear input
    input.value = '';
    isStreaming.value = true;

    // Create AI session
    const chat = ai({
      apiKey: appModel.apiKey.value,
      baseURL: appModel.baseURL.value,
      model: appModel.model.value,
      instructions: appModel.instructions.value,
      tools: getTools(),
      mode: 'completions'
    });

    // Prepare assistant message
    let assistantMessage = {
      role: 'assistant',
      content: '',
      toolCalls: []
    };
    addMessage(assistantMessage);

    try {
      for await (const chunk of chat.send(userMessage)) {
        if (chunk.type === 'text') {
          assistantMessage.content += chunk.text;
          // Update the last message
          messages.value = [...messages.value];
        } else if (chunk.type === 'tool_call' && !chunk.streaming) {
          assistantMessage.toolCalls.push(chunk);
          messages.value = [...messages.value];
        } else if (chunk.type === 'tool_result') {
          // Find and update the tool call with result
          const toolCall = assistantMessage.toolCalls.find(tc => tc.id === chunk.id);
          if (toolCall) {
            toolCall.result = chunk.result;
            messages.value = [...messages.value];
          }
        }
      }
    } catch (err) {
      addMessage({
        role: 'system',
        content: `Error: ${err.message}`
      });
    } finally {
      isStreaming.value = false;
    }
  };

  // Clear chat
  const clearChat = () => {
    messages.value = [];
  };

  return {
    messages,
    input,
    isStreaming,
    bash,
    fileHandle,
    initBash,
    requestDirectoryAccess,
    readFile,
    writeFile,
    listFiles,
    getTools,
    addMessage,
    sendMessage,
    clearChat
  };
});
