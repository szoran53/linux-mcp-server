import { exec } from 'child_process';
import { promisify } from 'util';
import type { ExecutionService, ExecResult } from './executor.js';

const execAsync = promisify(exec);
const MAX_BUFFER = 1024 * 1024; // 1 MB

export class LocalExecutor implements ExecutionService {
  constructor(
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

  private async execute(command: string): Promise<ExecResult> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.timeoutMs,
        maxBuffer: 10 * 1024 * 1024, // 10 MB internal limit so we can apply our own 1 MB truncation
      });
      const combined = stdout + stderr;
      const truncated = combined.length > MAX_BUFFER;
      // Preserve stderr in full when truncating; trim stdout to fit within 1 MB combined
      const stderrOut = truncated ? stderr.slice(0, MAX_BUFFER) : stderr;
      const stdoutOut = truncated ? stdout.slice(0, Math.max(0, MAX_BUFFER - stderrOut.length)) : stdout;
      return {
        stdout: stdoutOut,
        stderr: stderrOut,
        exitCode: 0,
        truncated,
      };
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string; killed?: boolean };
      const isTimeout = e.killed === true || (e.code as unknown) === 'ETIMEDOUT';
      return {
        stdout: e.stdout || '',
        stderr: e.stderr || e.message || '',
        exitCode: isTimeout ? 124 : (typeof e.code === 'number' ? e.code : 1),
        truncated: false,
      };
    }
  }
}
