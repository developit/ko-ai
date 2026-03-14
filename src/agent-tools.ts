import { exec } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import type { Tool } from './index.ts';

export const shellTool: Tool = {
  type: 'function',
  name: 'shell',
  description: 'Execute a shell command. Returns stdout, stderr, and exit code.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to execute' },
      description: {
        type: 'string',
        description:
          'Short description of the command\'s purpose/goal (~100 chars). When provided, this is typically shown to the user instead of the raw command.',
      },
      timeout: { type: 'number', description: 'Timeout in ms (default: 30000)' },
    },
    required: ['command'],
  },
  async call(args: Record<string, unknown>) {
    const { command, timeout = 30000 } = args as { command: string; timeout?: number };
    return new Promise(resolve => {
      exec(command, { timeout, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
        resolve({
          stdout: stdout?.slice(0, 50000) || '',
          stderr: (err && !stderr ? err.message : stderr?.slice(0, 50000)) || '',
          exitCode: err ? (err as any).code ?? 1 : 0,
        });
      });
    });
  },
};

export const readFileTool: Tool = {
  type: 'function',
  name: 'read_file',
  description: 'Read a file and return its contents.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to read' },
    },
    required: ['path'],
  },
  async call(args: Record<string, unknown>) {
    const { path } = args as { path: string };
    try {
      const content = await readFile(path, 'utf8');
      return { path, content: content.slice(0, 100000) };
    } catch (e: any) {
      return { error: e.message };
    }
  },
};

export const writeFileTool: Tool = {
  type: 'function',
  name: 'write_file',
  description: 'Write content to a file, creating it if it does not exist.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to write' },
      content: { type: 'string', description: 'Content to write' },
    },
    required: ['path', 'content'],
  },
  async call(args: Record<string, unknown>) {
    const { path, content } = args as { path: string; content: string };
    try {
      await writeFile(path, content, 'utf8');
      return { path, bytes: content.length };
    } catch (e: any) {
      return { error: e.message };
    }
  },
};

export const editFileTool: Tool = {
  type: 'function',
  name: 'edit_file',
  description: 'Replace an exact string in a file with a new string. The old_string must appear exactly once.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path' },
      old_string: { type: 'string', description: 'Exact string to find (must be unique)' },
      new_string: { type: 'string', description: 'Replacement string' },
    },
    required: ['path', 'old_string', 'new_string'],
  },
  async call(args: Record<string, unknown>) {
    const { path, old_string, new_string } = args as { path: string; old_string: string; new_string: string };
    try {
      const content = await readFile(path, 'utf8');
      const idx = content.indexOf(old_string);
      if (idx === -1) return { error: 'old_string not found in file' };
      if (content.indexOf(old_string, idx + 1) !== -1) return { error: 'old_string appears more than once' };
      await writeFile(path, content.replace(old_string, new_string), 'utf8');
      return { path, replaced: true };
    } catch (e: any) {
      return { error: e.message };
    }
  },
};

/** All agent tools as a convenient array. */
export const allTools: Tool[] = [shellTool, readFileTool, writeFileTool, editFileTool];
