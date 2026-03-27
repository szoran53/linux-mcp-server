export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  truncated: boolean;
}

export interface ExecutionService {
  run(command: string): Promise<ExecResult>;
  runSudo(command: string): Promise<ExecResult>;
}

/** Test helper: mock executor that returns scripted responses */
export class MockExecutor implements ExecutionService {
  private responses: Array<{ pattern: string; result: ExecResult }> = [];
  public calls: string[] = [];
  public sudoCalls: string[] = [];

  addResponse(pattern: string, result: ExecResult): this {
    this.responses.push({ pattern, result });
    return this;
  }

  async run(command: string): Promise<ExecResult> {
    this.calls.push(command);
    for (const { pattern, result } of this.responses) {
      if (command.includes(pattern)) return result;
    }
    return { stdout: '', stderr: `MockExecutor: no match for "${command}"`, exitCode: 1, truncated: false };
  }

  async runSudo(command: string): Promise<ExecResult> {
    this.sudoCalls.push(command);
    return this.run(command);
  }
}
