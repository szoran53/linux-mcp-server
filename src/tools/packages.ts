import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ExecutionService, ExecResult } from '../services/executor.js';

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function success(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

function fromResult(result: ExecResult): ToolResult {
  if (result.exitCode !== 0) return { isError: true, content: [{ type: 'text', text: `Error (exit ${result.exitCode}): ${result.stderr}` }] };
  const text = result.truncated
    ? `${result.stdout}\n\n[Output truncated at 1MB]`
    : result.stdout;
  return success(text);
}

export async function handleAptListInstalled(executor: ExecutionService, filter: string | undefined): Promise<ToolResult> {
  const cmd = filter
    ? `dpkg-query -l '*${filter}*' 2>/dev/null | grep '^ii'`
    : `dpkg-query -l 2>/dev/null | grep '^ii'`;
  return fromResult(await executor.run(cmd));
}

export async function handleAptSearch(executor: ExecutionService, query: string): Promise<ToolResult> {
  const safeQuery = query.replace(/[^a-zA-Z0-9._+\-* ]/g, '');
  return fromResult(await executor.run(`apt-cache search ${safeQuery}`));
}

export async function handleAptShow(executor: ExecutionService, pkg: string): Promise<ToolResult> {
  const safePkg = pkg.replace(/[^a-zA-Z0-9._+-]/g, '');
  return fromResult(await executor.run(`apt-cache show ${safePkg}`));
}

export async function handleAptInstall(executor: ExecutionService, packages: string[]): Promise<ToolResult> {
  const pkgList = packages.map(p => p.replace(/[^a-zA-Z0-9._+-]/g, '')).join(' ');
  return fromResult(await executor.runSudo(`DEBIAN_FRONTEND=noninteractive apt-get install -y ${pkgList}`));
}

export async function handleAptRemove(executor: ExecutionService, packages: string[]): Promise<ToolResult> {
  const pkgList = packages.map(p => p.replace(/[^a-zA-Z0-9._+-]/g, '')).join(' ');
  return fromResult(await executor.runSudo(`DEBIAN_FRONTEND=noninteractive apt-get remove -y ${pkgList}`));
}

export async function handleAptUpdate(executor: ExecutionService): Promise<ToolResult> {
  return fromResult(await executor.runSudo('apt-get update'));
}

export async function handleAptUpgrade(executor: ExecutionService, dryRun: boolean): Promise<ToolResult> {
  const flag = dryRun ? ' --dry-run' : '';
  return fromResult(await executor.runSudo(`DEBIAN_FRONTEND=noninteractive apt-get upgrade -y${flag}`));
}

export function registerPackageTools(server: McpServer, executor: ExecutionService): void {
  server.registerTool('apt_list_installed', {
    title: 'List Installed Packages',
    description: 'List installed apt packages. Optional filter by name substring.',
    inputSchema: { filter: z.string().optional().describe('Filter packages by name (substring match)') },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, (p) => handleAptListInstalled(executor, p.filter));

  server.registerTool('apt_search', {
    title: 'Search Packages',
    description: 'Search available apt packages by name or description.',
    inputSchema: { query: z.string().describe('Search term') },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, (p) => handleAptSearch(executor, p.query));

  server.registerTool('apt_show', {
    title: 'Show Package Details',
    description: 'Show detailed information about a package (apt-cache show).',
    inputSchema: { package: z.string().describe('Package name') },
    annotations: { readOnlyHint: true, destructiveHint: false },
  }, (p) => handleAptShow(executor, p.package));

  server.registerTool('apt_install', {
    title: 'Install Packages',
    description: 'Install one or more apt packages (runs apt-get install -y via sudo).',
    inputSchema: { packages: z.array(z.string()).describe('Package names to install') },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, (p) => handleAptInstall(executor, p.packages));

  server.registerTool('apt_remove', {
    title: 'Remove Packages',
    description: 'Remove one or more apt packages, leaving config files (apt-get remove). Use run_command_sudo for purge.',
    inputSchema: { packages: z.array(z.string()).describe('Package names to remove') },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, (p) => handleAptRemove(executor, p.packages));

  server.registerTool('apt_update', {
    title: 'Update Package Lists',
    description: 'Run apt-get update to refresh package index (sudo).',
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, () => handleAptUpdate(executor));

  server.registerTool('apt_upgrade', {
    title: 'Upgrade Packages',
    description: 'Upgrade installed packages (apt-get upgrade). Set dry_run=true to preview without applying.',
    inputSchema: { dry_run: z.boolean().default(false).describe('Preview changes without applying') },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, (p) => handleAptUpgrade(executor, p.dry_run));
}
