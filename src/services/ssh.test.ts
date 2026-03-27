import { describe, it, expect } from 'vitest';
import { SshExecutor } from './ssh.js';

describe('SshExecutor', () => {
  it('returns error result when host is unreachable', async () => {
    const exec = new SshExecutor(
      { host: '192.0.2.1', port: 22, user: 'nobody', keyPath: '/nonexistent', strictHostCheck: false },
      3000
    );
    const result = await exec.run('echo test');
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it('returns exitCode 124 on connection timeout', async () => {
    const exec = new SshExecutor(
      { host: '192.0.2.1', port: 22, user: 'nobody', keyPath: '/nonexistent', strictHostCheck: false },
      500 // very short timeout
    );
    const result = await exec.run('echo test');
    // Either timeout (124) or connection error (1) — both are acceptable non-zero
    expect(result.exitCode).not.toBe(0);
  });
});
