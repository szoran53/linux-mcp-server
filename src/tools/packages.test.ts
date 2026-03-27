import { describe, it, expect } from 'vitest';
import { MockExecutor } from '../services/executor.js';
import {
  handleAptListInstalled,
  handleAptSearch,
  handleAptShow,
  handleAptInstall,
  handleAptRemove,
  handleAptUpdate,
  handleAptUpgrade,
} from './packages.js';

const ok = (stdout: string) => ({ stdout, stderr: '', exitCode: 0, truncated: false });

describe('package tools', () => {
  it('handleAptListInstalled returns package list', async () => {
    const exec = new MockExecutor().addResponse('dpkg-query', ok('nginx/focal,now 1.18.0 amd64 [installed]'));
    const result = await handleAptListInstalled(exec, undefined);
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('nginx');
  });

  it('handleAptListInstalled filters by name', async () => {
    const exec = new MockExecutor().addResponse('dpkg-query', ok('nginx/focal 1.18.0 [installed]'));
    const result = await handleAptListInstalled(exec, 'nginx');
    expect(result.content[0].text).toContain('nginx');
  });

  it('handleAptSearch returns results', async () => {
    const exec = new MockExecutor().addResponse('apt-cache search', ok('nginx - small, powerful web server'));
    const result = await handleAptSearch(exec, 'nginx');
    expect(result.isError).toBeFalsy();
  });

  it('handleAptInstall uses sudo', async () => {
    const exec = new MockExecutor().addResponse('apt-get install', ok('Setting up nginx'));
    const result = await handleAptInstall(exec, ['nginx']);
    expect(result.isError).toBeFalsy();
    expect(exec.calls.some(c => c.includes('apt-get install'))).toBe(true);
  });

  it('handleAptUpgrade with dry_run passes --dry-run flag', async () => {
    const exec = new MockExecutor().addResponse('apt-get upgrade', ok('5 upgraded'));
    await handleAptUpgrade(exec, true);
    expect(exec.calls.some(c => c.includes('--dry-run'))).toBe(true);
  });

  it('handleAptUpdate returns success', async () => {
    const exec = new MockExecutor().addResponse('apt-get update', ok('Reading package lists...'));
    const result = await handleAptUpdate(exec);
    expect(result.isError).toBeFalsy();
  });
});
