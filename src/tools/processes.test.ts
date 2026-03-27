import { describe, it, expect } from 'vitest';
import { MockExecutor } from '../services/executor.js';
import { handleListProcesses, handleGetProcess, handleGetTopProcesses, handleKillProcess } from './processes.js';

const ok = (stdout: string) => ({ stdout, stderr: '', exitCode: 0, truncated: false });

describe('process tools', () => {
  it('handleListProcesses sorts by cpu by default', async () => {
    const exec = new MockExecutor().addResponse('ps', ok('PID CPU MEM COMMAND\n123 99 1 python3'));
    await handleListProcesses(exec, 'cpu');
    expect(exec.calls[0]).toContain('ps');
  });

  it('handleGetProcess finds by name', async () => {
    const exec = new MockExecutor().addResponse('ps', ok('123 nginx'));
    const result = await handleGetProcess(exec, undefined, 'nginx');
    expect(result.isError).toBeFalsy();
  });

  it('handleGetTopProcesses returns top N', async () => {
    const exec = new MockExecutor().addResponse('ps', ok('PID CPU MEM CMD'));
    await handleGetTopProcesses(exec, 10, 'cpu');
    expect(exec.calls[0]).toContain('ps');
  });

  it('handleKillProcess sends SIGTERM by default', async () => {
    const exec = new MockExecutor().addResponse('kill', ok(''));
    await handleKillProcess(exec, 1234, 'SIGTERM');
    expect(exec.sudoCalls[0]).toContain('kill');
    expect(exec.sudoCalls[0]).toContain('SIGTERM');
    expect(exec.sudoCalls[0]).toContain('1234');
  });
});
