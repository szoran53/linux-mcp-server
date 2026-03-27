import { describe, it, expect } from 'vitest';
import { MockExecutor } from '../services/executor.js';
import { handleGetJournalLogs, handleTailFile, handleSearchLogs } from './logs.js';

const ok = (stdout: string) => ({ stdout, stderr: '', exitCode: 0, truncated: false });

describe('log tools', () => {
  it('handleGetJournalLogs builds journalctl command with filters', async () => {
    const exec = new MockExecutor().addResponse('journalctl', ok('Mar 27 10:00:00 nginx[123]: started'));
    await handleGetJournalLogs(exec, { unit: 'nginx', lines: 50 });
    expect(exec.calls[0]).toContain('journalctl');
    expect(exec.calls[0]).toContain('-u nginx');
    expect(exec.calls[0]).toContain('-n 50');
  });

  it('handleTailFile returns file contents for allowed path', async () => {
    const exec = new MockExecutor().addResponse('tail', ok('error: something failed'));
    const result = await handleTailFile(exec, '/var/log/syslog', 100, ['/var/log']);
    expect(result.isError).toBeFalsy();
  });

  it('handleTailFile rejects path outside allowlist', async () => {
    const exec = new MockExecutor();
    const result = await handleTailFile(exec, '/etc/passwd', 100, ['/var/log']);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not allowed');
  });

  it('handleSearchLogs searches journal with grep pattern', async () => {
    const exec = new MockExecutor().addResponse('journalctl', ok('ERROR: disk full'));
    const result = await handleSearchLogs(exec, 'ERROR', undefined);
    expect(result.isError).toBeFalsy();
  });
});
