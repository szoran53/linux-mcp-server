import { describe, it, expect } from 'vitest';
import { MockExecutor } from '../services/executor.js';
import {
  handleServiceList,
  handleServiceStatus,
  handleServiceStart,
  handleServiceStop,
  handleServiceRestart,
  handleServiceEnable,
  handleServiceDisable,
} from './services.js';

const ok = (stdout: string) => ({ stdout, stderr: '', exitCode: 0, truncated: false });

describe('service tools', () => {
  it('handleServiceList uses --system scope by default', async () => {
    const exec = new MockExecutor().addResponse('systemctl', ok('nginx.service active running'));
    await handleServiceList(exec, 'system', undefined);
    expect(exec.calls[0]).toContain('--system');
  });

  it('handleServiceList uses --user scope when specified', async () => {
    const exec = new MockExecutor().addResponse('systemctl', ok('mcp-omada.service active running'));
    await handleServiceList(exec, 'user', undefined);
    expect(exec.calls[0]).toContain('--user');
  });

  it('handleServiceStatus returns status output', async () => {
    const exec = new MockExecutor().addResponse('status nginx', ok('● nginx.service - active (running)'));
    const result = await handleServiceStatus(exec, 'nginx', 'system');
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('nginx');
  });

  it('handleServiceStart uses sudo', async () => {
    const exec = new MockExecutor().addResponse('systemctl start', ok(''));
    await handleServiceStart(exec, 'nginx');
    expect(exec.sudoCalls[0]).toContain('start nginx');
  });

  it('handleServiceStop uses sudo', async () => {
    const exec = new MockExecutor().addResponse('systemctl stop', ok(''));
    await handleServiceStop(exec, 'nginx');
    expect(exec.sudoCalls[0]).toContain('stop nginx');
  });

  it('handleServiceEnable uses sudo', async () => {
    const exec = new MockExecutor().addResponse('systemctl enable', ok('Created symlink'));
    await handleServiceEnable(exec, 'nginx');
    expect(exec.sudoCalls[0]).toContain('enable nginx');
  });
});
