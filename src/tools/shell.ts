import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ExecutionService, ExecResult } from '../services/executor.js';

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function formatResult(result: ExecResult): ToolResult {
  const parts: string[] = [];
  if (result.stdout) parts.push(result.stdout);
  if (result.stderr) parts.push(`[stderr]: ${result.stderr}`);
  if (result.truncated) parts.push('\n[Output truncated at 1MB]');

  const text = parts.join('\n').trim() || '(no output)';

  if (result.exitCode !== 0) {
    return { isError: true, content: [{ type: 'text', text: `Exit code ${result.exitCode}:\n${text}` }] };
  }
  return { content: [{ type: 'text', text }] };
}

export async function handleRunCommand(executor: ExecutionService, command: string): Promise<ToolResult> {
  return formatResult(await executor.run(command));
}

export async function handleRunCommandSudo(executor: ExecutionService, command: string): Promise<ToolResult> {
  return formatResult(await executor.runSudo(command));
}

export function registerShellTools(server: McpServer, executor: ExecutionService): void {
  server.registerTool('run_command', {
    title: 'Run Command',
    description: 'Execute an arbitrary shell command and return stdout/stderr. Subject to 30s timeout and 1MB output limit. Use for operations not covered by structured tools.',
    inputSchema: { command: z.string().describe('Shell command to execute') },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  }, (p) => handleRunCommand(executor, p.command));

  server.registerTool('run_command_sudo', {
    title: 'Run Command (sudo)',
    description: 'Execute an arbitrary shell command with sudo. Same limits as run_command. Use for privileged operations not covered by structured tools (e.g. apt purge, iptables).',
    inputSchema: { command: z.string().describe('Shell command to execute with sudo') },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  }, (p) => handleRunCommandSudo(executor, p.command));
}
