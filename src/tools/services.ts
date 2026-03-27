import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ExecutionService, ExecResult } from '../services/executor.js';

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };
type Scope = 'system' | 'user';

function fromResult(result: ExecResult): ToolResult {
  if (result.exitCode !== 0) return { isError: true, content: [{ type: 'text', text: `Error (exit ${result.exitCode}): ${result.stderr}` }] };
  const text = result.truncated ? `${result.stdout}\n\n[Output truncated at 1MB]` : result.stdout;
  return { content: [{ type: 'text', text: text || '(no output)' }] };
}

function scopeFlag(scope: Scope): string {
  return scope === 'user' ? '--user' : '--system';
}

export async function handleServiceList(executor: ExecutionService, scope: Scope, stateFilter: string | undefined): Promise<ToolResult> {
  const stateArg = stateFilter ? `--state=${stateFilter}` : '';
  return fromResult(await executor.run(`systemctl ${scopeFlag(scope)} list-units --type=service ${stateArg} --no-pager`));
}

export async function handleServiceStatus(executor: ExecutionService, name: string, scope: Scope): Promise<ToolResult> {
  return fromResult(await executor.run(`systemctl ${scopeFlag(scope)} status ${name} --no-pager`));
}

export async function handleServiceStart(executor: ExecutionService, name: string): Promise<ToolResult> {
  return fromResult(await executor.runSudo(`systemctl --system start ${name}`));
}

export async function handleServiceStop(executor: ExecutionService, name: string): Promise<ToolResult> {
  return fromResult(await executor.runSudo(`systemctl --system stop ${name}`));
}

export async function handleServiceRestart(executor: ExecutionService, name: string): Promise<ToolResult> {
  return fromResult(await executor.runSudo(`systemctl --system restart ${name}`));
}

export async function handleServiceEnable(executor: ExecutionService, name: string): Promise<ToolResult> {
  return fromResult(await executor.runSudo(`systemctl --system enable ${name}`));
}

export async function handleServiceDisable(executor: ExecutionService, name: string): Promise<ToolResult> {
  return fromResult(await executor.runSudo(`systemctl --system disable ${name}`));
}

const scopeSchema = z.enum(['system', 'user']).default('system');

export function registerServiceTools(server: McpServer, executor: ExecutionService): void {
  server.registerTool('service_list', {
    title: 'List Services',
    description: 'List systemd services. scope: "system" (default) or "user". Optional state filter (e.g. "running", "failed").',
    inputSchema: {
      scope: scopeSchema.describe('Service scope'),
      state: z.string().optional().describe('Filter by state (running, failed, inactive, etc.)'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, (p) => handleServiceList(executor, p.scope, p.state));

  server.registerTool('service_status', {
    title: 'Get Service Status',
    description: 'Get systemctl status for a named service.',
    inputSchema: {
      name: z.string().describe('Service name (e.g. nginx, ssh)'),
      scope: scopeSchema.describe('Service scope'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, (p) => handleServiceStatus(executor, p.name, p.scope));

  server.registerTool('service_start', {
    title: 'Start Service',
    description: 'Start a system service (sudo). System scope only.',
    inputSchema: { name: z.string().describe('Service name') },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, (p) => handleServiceStart(executor, p.name));

  server.registerTool('service_stop', {
    title: 'Stop Service',
    description: 'Stop a system service (sudo). System scope only.',
    inputSchema: { name: z.string().describe('Service name') },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, (p) => handleServiceStop(executor, p.name));

  server.registerTool('service_restart', {
    title: 'Restart Service',
    description: 'Restart a system service (sudo). System scope only.',
    inputSchema: { name: z.string().describe('Service name') },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, (p) => handleServiceRestart(executor, p.name));

  server.registerTool('service_enable', {
    title: 'Enable Service',
    description: 'Enable a system service to start at boot (sudo). System scope only.',
    inputSchema: { name: z.string().describe('Service name') },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, (p) => handleServiceEnable(executor, p.name));

  server.registerTool('service_disable', {
    title: 'Disable Service',
    description: 'Disable a system service from starting at boot (sudo). System scope only.',
    inputSchema: { name: z.string().describe('Service name') },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, (p) => handleServiceDisable(executor, p.name));
}
