import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns local mode config when LOCAL_MODE=true', () => {
    process.env.LOCAL_MODE = 'true';
    const config = loadConfig();
    expect(config.localMode).toBe(true);
    expect(config.http.port).toBe(3300);
    expect(config.http.host).toBe('127.0.0.1');
    expect(config.commandTimeoutMs).toBe(30000);
    expect(config.logPaths).toEqual(['/var/log']);
  });

  it('throws when SSH_HOST missing in remote mode', () => {
    process.env.LOCAL_MODE = 'false';
    delete process.env.SSH_HOST;
    expect(() => loadConfig()).toThrow('SSH_HOST is required');
  });

  it('throws when SSH_USER missing in remote mode', () => {
    process.env.LOCAL_MODE = 'false';
    process.env.SSH_HOST = '192.168.1.10';
    delete process.env.SSH_USER;
    expect(() => loadConfig()).toThrow('SSH_USER is required');
  });

  it('parses SSH config from env vars', () => {
    process.env.LOCAL_MODE = 'false';
    process.env.SSH_HOST = '192.168.1.10';
    process.env.SSH_USER = 'steve';
    process.env.SSH_PORT = '2222';
    process.env.SSH_STRICT_HOST_CHECK = 'false';
    process.env.MCP_HTTP_PORT = '3301';
    const config = loadConfig();
    expect(config.ssh.host).toBe('192.168.1.10');
    expect(config.ssh.port).toBe(2222);
    expect(config.ssh.user).toBe('steve');
    expect(config.ssh.strictHostCheck).toBe(false);
    expect(config.http.port).toBe(3301);
  });

  it('parses comma-separated LOG_PATHS', () => {
    process.env.LOCAL_MODE = 'true';
    process.env.LOG_PATHS = '/var/log,/home/steve/logs';
    const config = loadConfig();
    expect(config.logPaths).toEqual(['/var/log', '/home/steve/logs']);
  });
});
