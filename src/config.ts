import { homedir } from 'os';

export interface Config {
  localMode: boolean;
  ssh: {
    host: string;
    port: number;
    user: string;
    keyPath: string;
    strictHostCheck: boolean;
  };
  sudoPassword?: string;
  commandTimeoutMs: number;
  http: {
    port: number;
    host: string;
  };
  logPaths: string[];
}

export function loadConfig(): Config {
  const localMode = process.env.LOCAL_MODE === 'true';

  if (!localMode) {
    if (!process.env.SSH_HOST) throw new Error('SSH_HOST is required when LOCAL_MODE is not true');
    if (!process.env.SSH_USER) throw new Error('SSH_USER is required when LOCAL_MODE is not true');
  }

  return {
    localMode,
    ssh: {
      host: process.env.SSH_HOST || '',
      port: parseInt(process.env.SSH_PORT || '22', 10),
      user: process.env.SSH_USER || '',
      keyPath: process.env.SSH_KEY_PATH || `${homedir()}/.ssh/id_rsa`,
      strictHostCheck: process.env.SSH_STRICT_HOST_CHECK !== 'false',
    },
    sudoPassword: process.env.SUDO_PASSWORD,
    commandTimeoutMs: parseInt(process.env.COMMAND_TIMEOUT_MS || '30000', 10),
    http: {
      port: parseInt(process.env.MCP_HTTP_PORT || '3300', 10),
      host: process.env.MCP_HTTP_HOST || '127.0.0.1',
    },
    logPaths: (process.env.LOG_PATHS || '/var/log').split(',').map(p => p.trim()),
  };
}
