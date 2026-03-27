import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config } from './config.js';
import type { ExecutionService } from './services/executor.js';
import { LocalExecutor } from './services/local.js';
import { SshExecutor } from './services/ssh.js';
import { registerSystemTools } from './tools/system.js';
import { registerPackageTools } from './tools/packages.js';
import { registerServiceTools } from './tools/services.js';
import { registerLogTools } from './tools/logs.js';
import { registerProcessTools } from './tools/processes.js';
import { registerFileTools } from './tools/files.js';
import { registerShellTools } from './tools/shell.js';

export function createExecutor(config: Config): ExecutionService {
  if (config.localMode) {
    return new LocalExecutor(config.commandTimeoutMs, config.sudoPassword);
  }
  return new SshExecutor(config.ssh, config.commandTimeoutMs, config.sudoPassword);
}

export function createServer(config: Config): McpServer {
  const server = new McpServer({
    name: 'linux-mcp-server',
    version: '0.1.0',
  });

  const executor = createExecutor(config);

  registerSystemTools(server, executor);
  registerPackageTools(server, executor);
  registerServiceTools(server, executor);
  registerLogTools(server, executor, config.logPaths);
  registerProcessTools(server, executor);
  registerFileTools(server, executor);
  registerShellTools(server, executor);

  return server;
}
