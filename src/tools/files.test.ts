// src/tools/files.test.ts
import { describe, it, expect } from 'vitest';
import { MockExecutor } from '../services/executor.js';
import {
  handleReadFile,
  handleWriteFile,
  handleListDirectory,
  handleGetFileInfo,
  handleMakeDirectory,
  handleDeleteFile,
} from './files.js';

const ok = (stdout: string) => ({ stdout, stderr: '', exitCode: 0, truncated: false });

describe('file tools', () => {
  it('handleReadFile returns file contents', async () => {
    const exec = new MockExecutor().addResponse('cat', ok('Hello, world'));
    const result = await handleReadFile(exec, '/etc/hostname');
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('Hello');
  });

  it('handleWriteFile writes via tee', async () => {
    const exec = new MockExecutor().addResponse('tee', ok(''));
    await handleWriteFile(exec, '/tmp/test.txt', 'content');
    expect(exec.calls[0]).toContain('tee');
    expect(exec.calls[0]).toContain('/tmp/test.txt');
  });

  it('handleListDirectory runs ls -la', async () => {
    const exec = new MockExecutor().addResponse('ls', ok('total 8\ndrwxr-xr-x 2 root root 4096'));
    const result = await handleListDirectory(exec, '/tmp');
    expect(result.isError).toBeFalsy();
  });

  it('handleGetFileInfo runs stat', async () => {
    const exec = new MockExecutor().addResponse('stat', ok('File: /etc/hostname\nSize: 10'));
    const result = await handleGetFileInfo(exec, '/etc/hostname');
    expect(result.isError).toBeFalsy();
  });

  it('handleMakeDirectory creates directory', async () => {
    const exec = new MockExecutor().addResponse('mkdir', ok(''));
    const result = await handleMakeDirectory(exec, '/tmp/newdir');
    expect(result.isError).toBeFalsy();
  });

  it('handleDeleteFile uses rm', async () => {
    const exec = new MockExecutor().addResponse('rm', ok(''));
    await handleDeleteFile(exec, '/tmp/test.txt', false);
    expect(exec.calls[0]).toContain('rm');
    expect(exec.calls[0]).toContain('/tmp/test.txt');
  });
});
