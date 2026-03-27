// src/tools/shell.test.ts
import { describe, it, expect } from 'vitest';
import { MockExecutor } from '../services/executor.js';
import { handleRunCommand, handleRunCommandSudo } from './shell.js';

const ok = (stdout: string) => ({ stdout, stderr: '', exitCode: 0, truncated: false });
const fail = () => ({ stdout: '', stderr: 'command not found', exitCode: 127, truncated: false });

describe('shell tools', () => {
  it('handleRunCommand returns stdout on success', async () => {
    const exec = new MockExecutor().addResponse('echo', ok('hello'));
    const result = await handleRunCommand(exec, 'echo hello');
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('hello');
  });

  it('handleRunCommand includes exitCode in output on failure', async () => {
    const exec = new MockExecutor().addResponse('badcmd', fail());
    const result = await handleRunCommand(exec, 'badcmd');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('127');
  });

  it('handleRunCommandSudo calls runSudo', async () => {
    const exec = new MockExecutor().addResponse('whoami', ok('root'));
    const result = await handleRunCommandSudo(exec, 'whoami');
    expect(result.isError).toBeFalsy();
    expect(exec.sudoCalls).toContain('whoami');
  });

  it('truncated output includes warning', async () => {
    const exec = new MockExecutor().addResponse('cat', { stdout: 'x'.repeat(100), stderr: '', exitCode: 0, truncated: true });
    const result = await handleRunCommand(exec, 'cat bigfile');
    expect(result.content[0].text).toContain('truncated');
  });
});
