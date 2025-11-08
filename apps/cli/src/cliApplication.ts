import type {
  CliApplication,
  CliApplicationConfig,
  CliCommandContext,
  CliGlobals,
  CommandDescriptor,
  CommandResult,
  ExecutionTelemetry,
  ProcessIO,
} from './types.js';

import { AuditLogger } from './auditLogger.js';
import { ErrorDomainMapper } from './errorDomainMapper.js';
import { OutputFormatter } from './outputFormatter.js';

interface ParsedArguments {
  command?: string;
  argv: string[];
  globals: CliGlobals;
  helpRequested: boolean;
  error?: string;
}

function parseArguments(rawArgs: string[]): ParsedArguments {
  const globals: CliGlobals = {
    quiet: false,
    dryRun: false,
    logFile: undefined,
  };

  const argv: string[] = [];
  let command: string | undefined;
  let helpRequested = false;

  for (let i = 0; i < rawArgs.length; i += 1) {
    const token = rawArgs[i];

    if (!command) {
      if (token === '--help' || token === '-h') {
        helpRequested = true;
        continue;
      }

      if (token === '--quiet') {
        globals.quiet = true;
        continue;
      }

      if (token === '--dry-run') {
        globals.dryRun = true;
        continue;
      }

      if (token === '--log-file') {
        const value = rawArgs[i + 1];
        if (!value || value.startsWith('-')) {
          return {
            command,
            argv,
            globals,
            helpRequested,
            error: '--log-file option requires a file path',
          };
        }
        globals.logFile = value;
        i += 1;
        continue;
      }

      if (token.startsWith('-')) {
        return {
          command,
          argv,
          globals,
          helpRequested,
          error: `Unknown option: ${token}`,
        };
      }

      command = token;
      continue;
    }

    argv.push(token);
  }

  return {
    command,
    argv,
    globals,
    helpRequested,
  };
}

function formatUsage(
  config: CliApplicationConfig,
  commands: CommandDescriptor[],
): string {
  const lines: string[] = [];
  lines.push(`Usage: ${config.name} <command> [options]`);
  lines.push('');

  if (commands.length === 0) {
    lines.push('No commands have been registered yet.');
    return lines.join('\n');
  }

  lines.push('Commands:');

  for (const command of commands) {
    lines.push(`  ${command.name} - ${command.summary}`);
  }

  lines.push('');
  lines.push('Global options:');
  lines.push('  --help       Show help for CLI or a command');
  lines.push('  --quiet      Suppress informational output');
  lines.push('  --dry-run    Run without performing side effects');
  lines.push('  --log-file   Write execution logs to the provided file');

  return lines.join('\n');
}

export function createCliApplication(config: CliApplicationConfig): CliApplication {
  const { router } = config;
  const auditLogger = new AuditLogger();
  const errorMapper = new ErrorDomainMapper();

  return {
    async run(argv, io) {
      const [, , ...rawArgs] = argv;
      const parsed = parseArguments(rawArgs);
      const formatter = new OutputFormatter(io, parsed.globals);

      if (parsed.error) {
        const message = `Error: ${parsed.error}`;
        io.writeStderr(`${message}\n`);
        io.writeStderr('Use --help to list available commands.\n');
        io.setExitCode(1);
        return 1;
      }

      if (!parsed.command) {
        if (parsed.helpRequested) {
          const usage = formatUsage(config, router.list());
          io.writeStdout(`${usage}\n`);
          io.setExitCode(0);
          return 0;
        }

        io.writeStderr("No command provided. Use '--help' to list available commands.\n");
        io.setExitCode(1);
        return 1;
      }

      const descriptor = router.find(parsed.command);

      if (!descriptor) {
        io.writeStderr(`Unknown command '${parsed.command}'.\n`);
        io.writeStderr('Use --help to list available commands.\n');
        io.setExitCode(1);
        return 1;
      }

      const context: CliCommandContext = {
        globals: parsed.globals,
        argv: parsed.argv,
        io,
      };

      const startedAt = new Date();
      let result: CommandResult;

      try {
        result = await descriptor.handler(context);
      } catch (error) {
        const mapped = errorMapper.map(error);
        result = {
          exitCode: mapped.exitCode,
          output: mapped.output,
          telemetry: { errorCode: mapped.errorCode },
        };
      }

      formatter.emit(result.output);

      const finishedAt = new Date();
      const telemetry = buildTelemetry(
        descriptor.name,
        startedAt,
        finishedAt,
        result.exitCode,
        result.telemetry,
      );
      const logFilePath = result.logFile ?? parsed.globals.logFile;
      await auditLogger.record(telemetry, logFilePath);

      io.setExitCode(result.exitCode);
      return result.exitCode;
    },
  };
}

function buildTelemetry(
  commandName: string,
  startedAt: Date,
  finishedAt: Date,
  exitCode: number,
  partial?: Partial<ExecutionTelemetry>,
): ExecutionTelemetry {
  return {
    command: commandName,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    status: exitCode === 0 ? 'success' : 'failure',
    profile: partial?.profile,
    inputBytes: partial?.inputBytes,
    maskedBytes: partial?.maskedBytes,
    errorCode: partial?.errorCode,
  };
}
