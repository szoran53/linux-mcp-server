import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ExecutionService, ExecResult } from '../services/executor.js';

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };
type SortBy = 'cpu' | 'memory' | 'pid';

function fromResult(result: ExecResult): ToolResult {
  if (result.exitCode !== 0) return { isError: true, content: [{ type: 'text', text: `Error (exit ${result.exitCode}): ${result.stderr}` }] };
  const text = result.truncated ? `${result.stdout}\n\n[Output truncated at 1MB]` : result.stdout;
  return { content: [{ type: 'text', text: text || '(no output)' }] };
}

const sortFlags: Record<SortBy, string> = {
  cpu: '--sort=-%cpu',
  memory: '--sort=-%mem',
  pid: '--sort=pid',
};

export async function handleListProcesses(executor: ExecutionService, sortBy: SortBy): Promise<ToolResult> {
  return fromResult(await executor.run(`ps aux ${sortFlags[sortBy]} | head -60`));
}

export async function handleGetProcess(executor: ExecutionService, pid: number | undefined, name: string | undefined): Promise<ToolResult> {
  if (pid !== undefined) {
    return fromResult(await executor.run(`ps -p ${pid} -o pid,ppid,user,%cpu,%mem,stat,start,cmd --no-headers && cat /proc/${pid}/status 2>/dev/null | head -30`));
  }
  if (name !== undefined) {
    return fromResult(await executor.run(`ps aux | grep -i "${name.replace(/"/g, '\\"')}" | grep -v grep`));
  }
  return { isError: true, content: [{ type: 'text', text: 'Either pid or name is required' }] };
}

export async function handleGetTopProcesses(executor: ExecutionService, n: number, sortBy: SortBy): Promise<ToolResult> {
  return fromResult(await executor.run(`ps aux ${sortFlags[sortBy]} | head -${n + 1}`));
}

export async function handleKillProcess(executor: ExecutionService, pid: number, signal: string): Promise<ToolResult> {
  const safeSignal = signal.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'SIGTERM';
  return fromResult(await executor.runSudo(`kill -${safeSignal} ${pid}`));
}

export function registerProcessTools(server: McpServer, executor: ExecutionService): void {
  const sortSchema = z.enum(['cpu', 'memory', 'pid']).default('cpu');

  server.registerTool('list_processes', {
    title: 'List Processes',
    description: 'List running processes (ps aux), sorted by cpu, memory, or pid. Returns top 60.',
    inputSchema: { sort_by: sortSchema.describe('Sort order') },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, (p) => handleListProcesses(executor, p.sort_by));

  server.registerTool('get_process', {
    title: 'Get Process Details',
    description: 'Get details about a specific process by PID or name.',
    inputSchema: {
      pid: z.number().int().positive().optional().describe('Process ID'),
      name: z.string().optional().describe('Process name (substring match)'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, (p) => handleGetProcess(executor, p.pid, p.name));

  server.registerTool('get_top_processes', {
    title: 'Get Top Processes',
    description: 'Get top N processes sorted by CPU or memory usage.',
    inputSchema: {
      count: z.number().int().min(1).max(50).default(10).describe('Number of processes to return'),
      sort_by: sortSchema.describe('Sort order'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, (p) => handleGetTopProcesses(executor, p.count, p.sort_by));

  server.registerTool('kill_process', {
    title: 'Kill Process',
    description: 'Send a signal to a process by PID. Default signal is SIGTERM (graceful). Use SIGKILL to force. Runs via sudo.',
    inputSchema: {
      pid: z.number().int().positive().describe('Process ID to signal'),
      signal: z.string().default('SIGTERM').describe('Signal name (SIGTERM, SIGKILL, SIGHUP, etc.)'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, (p) => handleKillProcess(executor, p.pid, p.signal));
}
