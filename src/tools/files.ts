import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ExecutionService, ExecResult } from '../services/executor.js';

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function fromResult(result: ExecResult): ToolResult {
  if (result.exitCode !== 0) return { isError: true, content: [{ type: 'text', text: `Error (exit ${result.exitCode}): ${result.stderr}` }] };
  const text = result.truncated ? `${result.stdout}\n\n[Output truncated at 1MB]` : result.stdout;
  return { content: [{ type: 'text', text: text }] };
}

function safePath(path: string): string {
  // Prevent shell injection via path — wrap in quotes, escape existing quotes
  return `"${path.replace(/"/g, '\\"')}"`;
}

export async function handleReadFile(executor: ExecutionService, path: string): Promise<ToolResult> {
  return fromResult(await executor.run(`cat ${safePath(path)}`));
}

export async function handleWriteFile(executor: ExecutionService, path: string, content: string): Promise<ToolResult> {
  // Use printf to avoid echo interpretation of escape sequences; pipe through tee
  const escaped = content.replace(/'/g, "'\\''");
  return fromResult(await executor.run(`printf '%s' '${escaped}' | tee ${safePath(path)} > /dev/null && echo "Written to ${path}"`));
}

export async function handleListDirectory(executor: ExecutionService, path: string): Promise<ToolResult> {
  return fromResult(await executor.run(`ls -la ${safePath(path)}`));
}

export async function handleGetFileInfo(executor: ExecutionService, path: string): Promise<ToolResult> {
  return fromResult(await executor.run(`stat ${safePath(path)}`));
}

export async function handleMakeDirectory(executor: ExecutionService, path: string): Promise<ToolResult> {
  return fromResult(await executor.run(`mkdir -p ${safePath(path)} && echo "Created: ${path}"`));
}

export async function handleDeleteFile(executor: ExecutionService, path: string, recursive: boolean): Promise<ToolResult> {
  const flag = recursive ? '-rf ' : '';
  return fromResult(await executor.run(`rm ${flag}${safePath(path)} && echo "Deleted: ${path}"`));
}

export function registerFileTools(server: McpServer, executor: ExecutionService): void {
  server.registerTool('read_file', {
    title: 'Read File',
    description: 'Read the contents of a file. Subject to 1MB output limit.',
    inputSchema: { path: z.string().describe('Absolute path to file') },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, (p) => handleReadFile(executor, p.path));

  server.registerTool('write_file', {
    title: 'Write File',
    description: 'Write text content to a file (creates or overwrites). Text only — binary files are not supported. Requires appropriate filesystem permissions.',
    inputSchema: {
      path: z.string().describe('Absolute path to file'),
      content: z.string().describe('File content to write'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, (p) => handleWriteFile(executor, p.path, p.content));

  server.registerTool('list_directory', {
    title: 'List Directory',
    description: 'List directory contents with details (ls -la).',
    inputSchema: { path: z.string().describe('Absolute path to directory') },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, (p) => handleListDirectory(executor, p.path));

  server.registerTool('get_file_info', {
    title: 'Get File Info',
    description: 'Get file metadata: permissions, owner, size, timestamps (stat).',
    inputSchema: { path: z.string().describe('Absolute path to file or directory') },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, (p) => handleGetFileInfo(executor, p.path));

  server.registerTool('make_directory', {
    title: 'Make Directory',
    description: 'Create a directory (mkdir -p, creates parent dirs as needed).',
    inputSchema: { path: z.string().describe('Absolute path to create') },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, (p) => handleMakeDirectory(executor, p.path));

  server.registerTool('delete_file', {
    title: 'Delete File',
    description: 'Delete a file or directory. Set recursive=true to delete non-empty directories.',
    inputSchema: {
      path: z.string().describe('Absolute path to delete'),
      recursive: z.boolean().default(false).describe('Delete recursively (for directories)'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, (p) => handleDeleteFile(executor, p.path, p.recursive));
}
