import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ExecutionService, ExecResult } from '../services/executor.js';

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function fromResult(result: ExecResult): ToolResult {
  if (result.exitCode !== 0) return { isError: true, content: [{ type: 'text', text: `Error (exit ${result.exitCode}): ${result.stderr}` }] };
  const text = result.truncated ? `${result.stdout}\n\n[Output truncated at 1MB]` : result.stdout;
  return { content: [{ type: 'text', text: text || '(no output)' }] };
}

interface JournalOptions {
  unit?: string;
  since?: string;
  until?: string;
  lines?: number;
  priority?: string;
}

export async function handleGetJournalLogs(executor: ExecutionService, opts: JournalOptions): Promise<ToolResult> {
  const parts = ['journalctl', '--no-pager'];
  if (opts.unit) parts.push(`-u ${opts.unit}`);
  if (opts.since) parts.push(`--since="${opts.since}"`);
  if (opts.until) parts.push(`--until="${opts.until}"`);
  if (opts.lines) parts.push(`-n ${opts.lines}`);
  if (opts.priority) parts.push(`-p ${opts.priority}`);
  return fromResult(await executor.run(parts.join(' ')));
}

export async function handleTailFile(
  executor: ExecutionService,
  path: string,
  lines: number,
  allowedPaths: string[]
): Promise<ToolResult> {
  if (path.includes('..')) {
    return { isError: true, content: [{ type: 'text', text: `Path traversal not allowed: "${path}"` }] };
  }
  const allowed = allowedPaths.some(prefix => path.startsWith(prefix));
  if (!allowed) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Path not allowed: "${path}". Must start with one of: ${allowedPaths.join(', ')}` }],
    };
  }
  return fromResult(await executor.run(`tail -n ${lines} "${path}"`));
}

export async function handleSearchLogs(executor: ExecutionService, pattern: string, unit: string | undefined): Promise<ToolResult> {
  const safeUnit = unit ? unit.replace(/[^a-zA-Z0-9._@-]/g, '') : '';
  const unitArg = safeUnit ? `-u ${safeUnit}` : '';
  const safePattern = pattern.replace(/'/g, "'\\''");
  return fromResult(await executor.run(`journalctl --no-pager ${unitArg} | grep -i '${safePattern}' | tail -n 200`));
}

export function registerLogTools(server: McpServer, executor: ExecutionService, logPaths: string[]): void {
  server.registerTool('get_journal_logs', {
    title: 'Get Journal Logs',
    description: 'Fetch systemd journal logs with optional filters. unit: service name, since/until: time range (e.g. "1 hour ago"), lines: count, priority: 0-7 or emerg/alert/crit/err/warning/notice/info/debug.',
    inputSchema: {
      unit: z.string().optional().describe('Service unit name (e.g. nginx, ssh)'),
      since: z.string().optional().describe('Start time (e.g. "1 hour ago", "2026-03-27 08:00")'),
      until: z.string().optional().describe('End time'),
      lines: z.number().int().min(1).max(5000).default(100).describe('Max lines to return'),
      priority: z.string().optional().describe('Log priority filter (err, warning, info, debug, etc.)'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, (p) => handleGetJournalLogs(executor, p));

  server.registerTool('tail_file', {
    title: 'Tail Log File',
    description: `Tail a log file. Path must start with an allowed prefix (default: /var/log).`,
    inputSchema: {
      path: z.string().describe('Absolute path to log file'),
      lines: z.number().int().min(1).max(5000).default(100).describe('Number of lines to return'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, (p) => handleTailFile(executor, p.path, p.lines, logPaths));

  server.registerTool('search_logs', {
    title: 'Search Logs',
    description: 'Search journal logs for a pattern (grep -i). Optional unit filter. Returns last 200 matching lines.',
    inputSchema: {
      pattern: z.string().describe('Search pattern (case-insensitive)'),
      unit: z.string().optional().describe('Limit to this service unit'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, (p) => handleSearchLogs(executor, p.pattern, p.unit));
}
