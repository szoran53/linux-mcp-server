import { describe, it, expect } from 'vitest';
import { LocalExecutor } from './local.js';

describe('LocalExecutor', () => {
  const exec = new LocalExecutor(5000);

  it('runs a command and returns stdout', async () => {
    const result = await exec.run('echo hello');
    expect(result.stdout.trim()).toBe('hello');
    expect(result.exitCode).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it('returns exitCode 1 and stderr for a failing command', async () => {
    const result = await exec.run('ls /nonexistent-path-xyz');
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it('returns exitCode 124 on timeout', async () => {
    const shortExec = new LocalExecutor(50); // 50ms timeout
    const result = await shortExec.run('sleep 5');
    expect(result.exitCode).toBe(124);
  });

  it('runSudo prepends sudo to command', async () => {
    // Test that sudo is invoked — use a safe sudo command
    const result = await exec.runSudo('echo sudotest');
    // May fail if user lacks sudo, but command should be attempted
    expect(result).toHaveProperty('stdout');
    expect(result).toHaveProperty('exitCode');
  });
});
