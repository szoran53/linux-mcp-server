import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
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

export async function handleGetSystemInfo(executor: ExecutionService): Promise<ToolResult> {
  const result = await executor.run(
    'echo "=== Hostname ===" && hostname && echo "=== OS ===" && cat /etc/os-release && echo "=== Kernel ===" && uname -r && echo "=== Uptime ===" && uptime && echo "=== Architecture ===" && uname -m'
  );
  return fromResult(result);
}

export async function handleGetCpuUsage(executor: ExecutionService): Promise<ToolResult> {
  const result = await executor.run(
    'echo "=== Load Averages ===" && cat /proc/loadavg && echo "=== CPU Info ===" && nproc && echo "=== Top CPU Snapshot ===" && top -bn1 | head -20'
  );
  return fromResult(result);
}

export async function handleGetMemoryUsage(executor: ExecutionService): Promise<ToolResult> {
  const result = await executor.run('free -h && echo "" && cat /proc/meminfo | grep -E "^(MemTotal|MemFree|MemAvailable|SwapTotal|SwapFree)"');
  return fromResult(result);
}

export async function handleGetDiskUsage(executor: ExecutionService): Promise<ToolResult> {
  const result = await executor.run('df -h && echo "" && lsblk');
  return fromResult(result);
}

export async function handleGetNetworkInterfaces(executor: ExecutionService): Promise<ToolResult> {
  const result = await executor.run('ip addr && echo "" && ip link');
  return fromResult(result);
}

export function registerSystemTools(server: McpServer, executor: ExecutionService): void {
  server.registerTool('get_system_info', {
    title: 'Get System Info',
    description: 'Returns hostname, OS version, kernel, uptime, and architecture.',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, () => handleGetSystemInfo(executor));

  server.registerTool('get_cpu_usage', {
    title: 'Get CPU Usage',
    description: 'Returns CPU load averages, core count, and a top snapshot.',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false },
  }, () => handleGetCpuUsage(executor));

  server.registerTool('get_memory_usage', {
    title: 'Get Memory Usage',
    description: 'Returns RAM and swap usage (free -h and /proc/meminfo).',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false },
  }, () => handleGetMemoryUsage(executor));

  server.registerTool('get_disk_usage', {
    title: 'Get Disk Usage',
    description: 'Returns disk usage per mount point (df -h) and block device layout (lsblk).',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false },
  }, () => handleGetDiskUsage(executor));

  server.registerTool('get_network_interfaces', {
    title: 'Get Network Interfaces',
    description: 'Returns all network interfaces with IPs and link status (ip addr, ip link).',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, () => handleGetNetworkInterfaces(executor));
}
