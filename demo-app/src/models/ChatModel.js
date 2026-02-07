import { createModel, signal } from '@preact/signals';
import ai from 'koai';
import { Bash } from 'just-bash';

export const ChatModel = createModel(function ChatModel(appModel) {
  this.appModel = appModel;
  this.messages = signal([]);
  this.input = signal('');
  this.isStreaming = signal(false);
  this.bash = signal(null);
  this.fileHandle = signal(null);

  // Initialize bash environment
  this.initBash = () => {
    if (!this.bash.value) {
      this.bash.value = new Bash({
        cwd: '/home/user',
        files: {
          '/home/user/README.md': '# Welcome to the AI Chat Assistant\n\nYou can use the bash tool to execute commands.'
        }
      });
    }
  };

  // File System Access API - Request directory access
  this.requestDirectoryAccess = async () => {
    try {
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite'
      });
      this.fileHandle.value = handle;
      this.addMessage({
        role: 'system',
        content: `Directory access granted: ${handle.name}`
      });
      return handle;
    } catch (err) {
      if (err.name !== 'AbortError') {
        this.addMessage({
          role: 'system',
          content: `Error accessing directory: ${err.message}`
        });
      }
      return null;
    }
  };

  // Read file using File System Access API
  this.readFile = async (path) => {
    try {
      if (!this.fileHandle.value) {
        throw new Error('No directory access granted');
      }

      const parts = path.split('/').filter(p => p);
      let handle = this.fileHandle.value;

      for (let i = 0; i < parts.length - 1; i++) {
        handle = await handle.getDirectoryHandle(parts[i]);
      }

      const fileHandle = await handle.getFileHandle(parts[parts.length - 1]);
      const file = await fileHandle.getFile();
      const content = await file.text();

      return { success: true, content };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Write file using File System Access API
  this.writeFile = async (path, content) => {
    try {
      if (!this.fileHandle.value) {
        throw new Error('No directory access granted');
      }

      const parts = path.split('/').filter(p => p);
      let handle = this.fileHandle.value;

      for (let i = 0; i < parts.length - 1; i++) {
        handle = await handle.getDirectoryHandle(parts[i], { create: true });
      }

      const fileHandle = await handle.getFileHandle(parts[parts.length - 1], { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // List files in directory
  this.listFiles = async (path = '') => {
    try {
      if (!this.fileHandle.value) {
        throw new Error('No directory access granted');
      }

      let handle = this.fileHandle.value;

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
  this.getTools = () => {
    this.initBash();

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
            const result = await this.bash.value.exec(command);
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
          const handle = await this.requestDirectoryAccess();
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
          return await this.readFile(path);
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
          return await this.writeFile(path, content);
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
          return await this.listFiles(path || '');
        }
      }
    ];
  };

  // Add message to history
  this.addMessage = (message) => {
    this.messages.value = [...this.messages.value, message];
  };

  // Send message to AI
  this.sendMessage = async () => {
    const userMessage = this.input.value.trim();
    if (!userMessage || this.isStreaming.value) return;

    // Add user message
    this.addMessage({
      role: 'user',
      content: userMessage
    });

    // Clear input
    this.input.value = '';
    this.isStreaming.value = true;

    // Create AI session
    const chat = ai({
      apiKey: this.appModel.apiKey.value,
      baseURL: this.appModel.baseURL.value,
      model: this.appModel.model.value,
      instructions: this.appModel.instructions.value,
      tools: this.getTools(),
      mode: 'completions'
    });

    // Prepare assistant message
    let assistantMessage = {
      role: 'assistant',
      content: '',
      toolCalls: []
    };
    this.addMessage(assistantMessage);

    try {
      for await (const chunk of chat.send(userMessage)) {
        if (chunk.type === 'text') {
          assistantMessage.content += chunk.text;
          // Update the last message
          this.messages.value = [...this.messages.value];
        } else if (chunk.type === 'tool_call' && !chunk.streaming) {
          assistantMessage.toolCalls.push(chunk);
          this.messages.value = [...this.messages.value];
        } else if (chunk.type === 'tool_result') {
          // Find and update the tool call with result
          const toolCall = assistantMessage.toolCalls.find(tc => tc.id === chunk.id);
          if (toolCall) {
            toolCall.result = chunk.result;
            this.messages.value = [...this.messages.value];
          }
        }
      }
    } catch (err) {
      this.addMessage({
        role: 'system',
        content: `Error: ${err.message}`
      });
    } finally {
      this.isStreaming.value = false;
    }
  };

  // Clear chat
  this.clearChat = () => {
    this.messages.value = [];
  };
});
