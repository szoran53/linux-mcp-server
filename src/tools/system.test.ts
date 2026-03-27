import { describe, it, expect } from 'vitest';
import { MockExecutor } from '../services/executor.js';
import {
  handleGetSystemInfo,
  handleGetCpuUsage,
  handleGetMemoryUsage,
  handleGetDiskUsage,
  handleGetNetworkInterfaces,
} from './system.js';

const ok = (stdout: string) => ({ stdout, stderr: '', exitCode: 0, truncated: false });
const fail = (stderr: string) => ({ stdout: '', stderr, exitCode: 1, truncated: false });

describe('system tools', () => {
  it('handleGetSystemInfo returns stdout on success', async () => {
    const exec = new MockExecutor().addResponse('uname', ok('Linux myhostname 6.17.0 x86_64'));
    const result = await handleGetSystemInfo(exec);
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('Linux');
  });

  it('handleGetSystemInfo returns error on exec failure', async () => {
    const exec = new MockExecutor().addResponse('uname', fail('permission denied'));
    const result = await handleGetSystemInfo(exec);
    expect(result.isError).toBe(true);
  });

  it('handleGetCpuUsage returns output on success', async () => {
    const exec = new MockExecutor().addResponse('top', ok('load average: 0.10, 0.20, 0.15'));
    const result = await handleGetCpuUsage(exec);
    expect(result.isError).toBeFalsy();
  });

  it('handleGetMemoryUsage returns output on success', async () => {
    const exec = new MockExecutor().addResponse('free', ok('Mem: 16000 8000 8000'));
    const result = await handleGetMemoryUsage(exec);
    expect(result.isError).toBeFalsy();
  });

  it('handleGetDiskUsage returns output on success', async () => {
    const exec = new MockExecutor().addResponse('df', ok('Filesystem /dev/sda1 100G 50G 50G 50% /'));
    const result = await handleGetDiskUsage(exec);
    expect(result.isError).toBeFalsy();
  });

  it('handleGetNetworkInterfaces returns output on success', async () => {
    const exec = new MockExecutor().addResponse('ip addr', ok('1: lo: <LOOPBACK>'));
    const result = await handleGetNetworkInterfaces(exec);
    expect(result.isError).toBeFalsy();
  });
});
