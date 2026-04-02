import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ExecutionService, ExecResult } from '../services/executor.js';

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function fromResult(result: ExecResult): ToolResult {
  if (result.exitCode !== 0) return { isError: true, content: [{ type: 'text', text: `Error (exit ${result.exitCode}): ${result.stderr}` }] };
  const text = result.truncated ? `${result.stdout}\n\n[Output truncated at 1MB]` : result.stdout;
  return { content: [{ type: 'text', text: text || '(no output)' }] };
}

export async function handleZfsListPools(executor: ExecutionService): Promise<ToolResult> {
  return fromResult(await executor.run('zpool list -o name,size,alloc,free,frag,cap,dedup,health,autotrim'));
}

export async function handleZfsPoolStatus(executor: ExecutionService, pool: string | undefined): Promise<ToolResult> {
  const target = pool ? pool : '';
  return fromResult(await executor.run(`zpool status -v ${target}`.trim()));
}

export async function handleZfsListDatasets(executor: ExecutionService, pool: string | undefined): Promise<ToolResult> {
  const target = pool ? pool : '';
  return fromResult(await executor.run(
    `zfs list -o name,used,avail,refer,mountpoint,compression,compressratio,dedup,recordsize,quota,reservation,atime,relatime ${target}`.trim()
  ));
}

export async function handleZfsPoolIostat(executor: ExecutionService, pool: string | undefined): Promise<ToolResult> {
  const target = pool ? pool : '';
  return fromResult(await executor.run(`zpool iostat -v ${target} 1 3`.trim()));
}

export async function handleZfsListSnapshots(executor: ExecutionService, dataset: string | undefined): Promise<ToolResult> {
  const target = dataset ? dataset : '';
  return fromResult(await executor.run(`zfs list -t snapshot -o name,used,refer,creation -s creation ${target}`.trim()));
}

export async function handleZfsRunScrub(executor: ExecutionService, pool: string): Promise<ToolResult> {
  return fromResult(await executor.runSudo(`zpool scrub ${pool}`));
}

export async function handleZfsStopScrub(executor: ExecutionService, pool: string): Promise<ToolResult> {
  return fromResult(await executor.runSudo(`zpool scrub -s ${pool}`));
}

export async function handleZfsGetProperty(executor: ExecutionService, name: string, property: string): Promise<ToolResult> {
  return fromResult(await executor.run(`zfs get ${property} ${name}`));
}

export async function handleZfsSetProperty(executor: ExecutionService, name: string, property: string, value: string): Promise<ToolResult> {
  return fromResult(await executor.runSudo(`zfs set ${property}=${value} ${name}`));
}

export async function handleZfsCreateSnapshot(executor: ExecutionService, snapshot: string): Promise<ToolResult> {
  return fromResult(await executor.runSudo(`zfs snapshot ${snapshot}`));
}

export async function handleZfsDestroySnapshot(executor: ExecutionService, snapshot: string): Promise<ToolResult> {
  return fromResult(await executor.runSudo(`zfs destroy ${snapshot}`));
}

export async function handleZfsPoolGet(executor: ExecutionService, pool: string, property: string): Promise<ToolResult> {
  return fromResult(await executor.run(`zpool get ${property} ${pool}`));
}

export async function handleZfsPoolSet(executor: ExecutionService, pool: string, property: string, value: string): Promise<ToolResult> {
  return fromResult(await executor.runSudo(`zpool set ${property}=${value} ${pool}`));
}

export function registerZfsTools(server: McpServer, executor: ExecutionService): void {
  server.registerTool('zfs_list_pools', {
    title: 'List ZFS Pools',
    description: 'List all ZFS pools with size, allocation, fragmentation, health, and autotrim status.',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, () => handleZfsListPools(executor));

  server.registerTool('zfs_pool_status', {
    title: 'ZFS Pool Status',
    description: 'Show detailed ZFS pool status including vdev tree, scrub results, and errors. Optionally filter to a specific pool.',
    inputSchema: {
      pool: z.string().optional().describe('Pool name (omit for all pools)'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, (p) => handleZfsPoolStatus(executor, p.pool));

  server.registerTool('zfs_list_datasets', {
    title: 'List ZFS Datasets',
    description: 'List ZFS datasets with used, available, compression, recordsize, and mount info. Optionally filter by pool.',
    inputSchema: {
      pool: z.string().optional().describe('Pool or dataset name to filter (omit for all)'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, (p) => handleZfsListDatasets(executor, p.pool));

  server.registerTool('zfs_pool_iostat', {
    title: 'ZFS Pool I/O Stats',
    description: 'Show ZFS pool I/O statistics (ops, bandwidth, latency) sampled over 3 seconds.',
    inputSchema: {
      pool: z.string().optional().describe('Pool name (omit for all pools)'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false },
  }, (p) => handleZfsPoolIostat(executor, p.pool));

  server.registerTool('zfs_list_snapshots', {
    title: 'List ZFS Snapshots',
    description: 'List ZFS snapshots with size and creation time, sorted by creation date.',
    inputSchema: {
      dataset: z.string().optional().describe('Dataset or pool to filter snapshots (omit for all)'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, (p) => handleZfsListSnapshots(executor, p.dataset));

  server.registerTool('zfs_run_scrub', {
    title: 'Run ZFS Scrub',
    description: 'Start a scrub on a ZFS pool to verify data integrity (sudo).',
    inputSchema: {
      pool: z.string().describe('Pool name to scrub'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, (p) => handleZfsRunScrub(executor, p.pool));

  server.registerTool('zfs_stop_scrub', {
    title: 'Stop ZFS Scrub',
    description: 'Stop an in-progress scrub on a ZFS pool (sudo).',
    inputSchema: {
      pool: z.string().describe('Pool name'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, (p) => handleZfsStopScrub(executor, p.pool));

  server.registerTool('zfs_get_property', {
    title: 'Get ZFS Property',
    description: 'Get one or more properties from a ZFS dataset or pool. Use "all" for all properties.',
    inputSchema: {
      name: z.string().describe('Dataset or pool name'),
      property: z.string().describe('Property name (e.g. compression, recordsize, atime) or "all"'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, (p) => handleZfsGetProperty(executor, p.name, p.property));

  server.registerTool('zfs_set_property', {
    title: 'Set ZFS Property',
    description: 'Set a property on a ZFS dataset (sudo).',
    inputSchema: {
      name: z.string().describe('Dataset name'),
      property: z.string().describe('Property name (e.g. compression, recordsize, atime)'),
      value: z.string().describe('Property value (e.g. lz4, 1M, off)'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, (p) => handleZfsSetProperty(executor, p.name, p.property, p.value));

  server.registerTool('zfs_create_snapshot', {
    title: 'Create ZFS Snapshot',
    description: 'Create a ZFS snapshot (sudo). Use format dataset@snapname.',
    inputSchema: {
      snapshot: z.string().describe('Snapshot name in dataset@snapname format'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, (p) => handleZfsCreateSnapshot(executor, p.snapshot));

  server.registerTool('zfs_destroy_snapshot', {
    title: 'Destroy ZFS Snapshot',
    description: 'Permanently delete a ZFS snapshot (sudo, destructive).',
    inputSchema: {
      snapshot: z.string().describe('Snapshot name in dataset@snapname format'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  }, (p) => handleZfsDestroySnapshot(executor, p.snapshot));

  server.registerTool('zfs_pool_get_property', {
    title: 'Get ZFS Pool Property',
    description: 'Get a property from a ZFS pool (e.g. autotrim, ashift, health).',
    inputSchema: {
      pool: z.string().describe('Pool name'),
      property: z.string().describe('Property name or "all"'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, (p) => handleZfsPoolGet(executor, p.pool, p.property));

  server.registerTool('zfs_pool_set_property', {
    title: 'Set ZFS Pool Property',
    description: 'Set a property on a ZFS pool (sudo), e.g. autotrim=on.',
    inputSchema: {
      pool: z.string().describe('Pool name'),
      property: z.string().describe('Property name (e.g. autotrim, comment)'),
      value: z.string().describe('Property value'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, (p) => handleZfsPoolSet(executor, p.pool, p.property, p.value));
}
