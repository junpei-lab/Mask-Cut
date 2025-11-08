import type { CliGlobals, CommandOutput, ProcessIO } from './types.js';

function ensureTrailingNewline(text: string): string {
  return text.endsWith('\n') ? text : `${text}\n`;
}

export class OutputFormatter {
  private readonly io: ProcessIO;

  private readonly globals: CliGlobals;

  constructor(io: ProcessIO, globals: CliGlobals) {
    this.io = io;
    this.globals = globals;
  }

  emit(output?: CommandOutput): void {
    if (!output) {
      return;
    }

    if (this.globals.quiet && output.kind !== 'error') {
      if ('scope' in output && output.scope === 'info') {
        return;
      }
    }

    switch (output.kind) {
      case 'text':
        this.io.writeStdout(ensureTrailingNewline(output.text));
        break;
      case 'json':
        this.io.writeStdout(`${JSON.stringify(output.data, null, 2)}\n`);
        break;
      case 'dry-run':
        this.writeDryRun(output.summary, output.details);
        break;
      case 'error':
        this.writeError(output.code, output.message, output.suggestions);
        break;
      default:
        // @ts-expect-error: exhaustive check for future kinds
        throw new Error(`Unsupported output type: ${output.kind}`);
    }
  }

  private writeDryRun(summary: string, details?: Record<string, unknown>): void {
    const lines = [`[dry-run] ${summary}`];
    if (details) {
      lines.push(JSON.stringify(details, null, 2));
    }
    this.io.writeStdout(`${lines.join('\n')}\n`);
  }

  private writeError(code: string, message: string, suggestions?: string[]): void {
    this.io.writeStderr(`Error [${code}]: ${message}\n`);
    if (suggestions?.length) {
      for (const tip of suggestions) {
        this.io.writeStderr(`  - ${tip}\n`);
      }
    }
  }
}
