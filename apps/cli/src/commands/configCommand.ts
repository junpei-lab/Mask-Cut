import type { ConfigService } from '../config/configService.js';
import type { ProfileSummary } from '../config/types.js';
import { CliUsageError } from '../errors.js';
import type { CommandDescriptor, CommandResult } from '../types.js';

export interface ConfigCommandDependencies {
  configService: ConfigService;
}

function buildListOutput(profiles: ProfileSummary[]): string {
  if (profiles.length === 0) {
    return 'No profiles configured yet. Use `mask-cut config set` to add one.';
  }

  const nameWidth = Math.max(...profiles.map((profile) => profile.name.length)) + 2;
  const lines: string[] = [];
  lines.push('Configured profiles:');

  for (const profile of profiles) {
    const indicator = profile.isDefault ? '*' : ' ';
    const endpoint = profile.endpoint || '(endpoint not set)';
    const nameColumn = profile.name.padEnd(nameWidth, ' ');
    lines.push(
      `${indicator} ${nameColumn} ${endpoint}  model=${profile.model}  updated=${profile.updatedAt}`,
    );
  }

  lines.push('');
  lines.push("'*' indicates the default profile.");
  return lines.join('\n');
}

async function handleList(
  deps: ConfigCommandDependencies,
): Promise<CommandResult> {
  const profiles = await deps.configService.listProfiles();
  return {
    exitCode: 0,
    output: { kind: 'text', text: `${buildListOutput(profiles)}\n` },
  };
}

async function handleUse(
  deps: ConfigCommandDependencies,
  argv: string[],
): Promise<CommandResult> {
  const target = argv[1];

  if (!target) {
    throw new CliUsageError('Profile name is required for `mask-cut config use <name>`');
  }

  try {
    await deps.configService.setDefaultProfile(target);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      exitCode: 1,
      output: {
        kind: 'error',
        code: 'CONFIG_ERROR',
        message,
      },
    };
  }

  return {
    exitCode: 0,
    output: { kind: 'text', text: `Default profile set to '${target}'.\n`, scope: 'info' },
  };
}

async function handleInit(
  deps: ConfigCommandDependencies,
): Promise<CommandResult> {
  const { created, path } = await deps.configService.ensureConfigFile();
  const text = created
    ? `Config file initialized at ${path}.\n`
    : `Config file already exists at ${path}.\n`;
  return {
    exitCode: 0,
    output: { kind: 'text', text, scope: 'info' },
  };
}

function buildUsage(): string {
  return `Mask-Cut CLI - Config command

Usage:
  mask-cut config list             # Show configured profiles
  mask-cut config use <name>       # Switch default profile
  mask-cut config init             # Create default config.json if missing

Sub-commands:
  list    Show configured profiles with metadata
  use     Set the default profile to the provided name
  init    Generate a seed config.json when it does not exist
`;
}

export function createConfigCommandDescriptor(
  deps: ConfigCommandDependencies,
): CommandDescriptor {
  return {
    name: 'config',
    summary: '接続設定を管理する',
    usage: 'config <sub-command>',
    handler: async (context) => {
      const [subcommand] = context.argv;

      if (!subcommand || subcommand === '--help' || subcommand === '-h') {
        return {
          exitCode: 0,
          output: { kind: 'text', text: `${buildUsage()}\n`, scope: 'info' },
        };
      }

      switch (subcommand) {
        case 'list':
          return handleList(deps);
        case 'use':
          return handleUse(deps, context.argv);
        case 'init':
          return handleInit(deps);
        default:
          throw new CliUsageError(
            `Unknown config sub-command '${subcommand}'. Available: list, use, init`,
          );
      }
    },
  };
}
