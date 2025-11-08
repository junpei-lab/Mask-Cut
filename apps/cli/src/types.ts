export interface ProcessIO {
  writeStdout(message: string): void;
  writeStderr(message: string): void;
  setExitCode(code: number): void;
}

export interface CliGlobals {
  quiet: boolean;
  dryRun: boolean;
  logFile?: string;
}

export interface CliCommandContext {
  globals: CliGlobals;
  argv: string[];
  io: ProcessIO;
}

export type OutputScope = 'result' | 'info' | 'error';

export interface TextOutput {
  kind: 'text';
  text: string;
  scope?: OutputScope;
}

export interface JsonOutput {
  kind: 'json';
  data: unknown;
  scope?: OutputScope;
}

export interface DryRunOutput {
  kind: 'dry-run';
  summary: string;
  details?: Record<string, unknown>;
}

export interface ErrorOutput {
  kind: 'error';
  code: string;
  message: string;
  suggestions?: string[];
}

export type CommandOutput = TextOutput | JsonOutput | DryRunOutput | ErrorOutput;

export interface ExecutionTelemetry {
  command: string;
  profile?: string;
  startedAt: string;
  finishedAt: string;
  status: 'success' | 'failure';
  inputBytes?: number;
  maskedBytes?: number;
  errorCode?: string;
}

export interface CommandResult {
  exitCode: number;
  output?: CommandOutput;
  telemetry?: Partial<ExecutionTelemetry>;
  logFile?: string;
}

export type CommandHandler = (context: CliCommandContext) => Promise<CommandResult>;

export interface CommandDescriptor {
  name: string;
  summary: string;
  usage: string;
  handler: CommandHandler;
}

export interface CliApplication {
  run(argv: string[], io: ProcessIO): Promise<number>;
}

export interface CliApplicationConfig {
  name: string;
  description: string;
  router: CommandRegistry;
}

export interface CommandRegistry {
  register(descriptor: CommandDescriptor): void;
  find(name: string): CommandDescriptor | undefined;
  list(): CommandDescriptor[];
}
