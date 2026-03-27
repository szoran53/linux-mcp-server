import { Client as SshClient } from 'ssh2';
import { readFileSync } from 'fs';
import type { ExecutionService, ExecResult } from './executor.js';

const MAX_BUFFER = 1024 * 1024; // 1 MB

export interface SshConfig {
  host: string;
  port: number;
  user: string;
  keyPath: string;
  strictHostCheck: boolean;
}

export class SshExecutor implements ExecutionService {
  constructor(
    private sshConfig: SshConfig,
    private timeoutMs: number,
    private sudoPassword?: string
  ) {}

  async run(command: string): Promise<ExecResult> {
    return this.execute(command);
  }

  async runSudo(command: string): Promise<ExecResult> {
    const sudoCmd = this.sudoPassword
      ? `echo '${this.sudoPassword}' | sudo -S ${command}`
      : `sudo ${command}`;
    return this.execute(sudoCmd);
  }

  private execute(command: string): Promise<ExecResult> {
    return new Promise((resolve) => {
      const conn = new SshClient();
      let stdout = '';
      let stderr = '';
      let settled = false;

      const settle = (result: ExecResult) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          conn.end();
          resolve(result);
        }
      };

      const timer = setTimeout(() => {
        settle({
          stdout: stdout.slice(0, MAX_BUFFER),
          stderr: `Command timed out after ${this.timeoutMs}ms`,
          exitCode: 124,
          truncated: false,
        });
      }, this.timeoutMs);

      conn.on('error', (err: Error) => {
        settle({ stdout: '', stderr: err.message, exitCode: 1, truncated: false });
      });

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            settle({ stdout: '', stderr: err.message, exitCode: 1, truncated: false });
            return;
          }

          stream.on('data', (data: Buffer) => {
            stdout += data.toString();
          });
          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });
          stream.on('close', (code: number | null) => {
            const combined = stdout + stderr;
            const truncated = combined.length > MAX_BUFFER;
            const stderrOut = truncated ? stderr.slice(0, MAX_BUFFER) : stderr;
            const stdoutOut = truncated ? stdout.slice(0, Math.max(0, MAX_BUFFER - stderrOut.length)) : stdout;
            settle({
              stdout: stdoutOut,
              stderr: stderrOut,
              exitCode: code ?? 0,
              truncated,
            });
          });
        });
      });

      let privateKey: Buffer;
      try {
        privateKey = readFileSync(this.sshConfig.keyPath);
      } catch {
        settle({ stdout: '', stderr: `Cannot read SSH key: ${this.sshConfig.keyPath}`, exitCode: 1, truncated: false });
        return;
      }

      conn.connect({
        host: this.sshConfig.host,
        port: this.sshConfig.port,
        username: this.sshConfig.user,
        privateKey,
        readyTimeout: 10000,
        hostVerifier: this.sshConfig.strictHostCheck ? undefined : () => true,
      });
    });
  }
}
