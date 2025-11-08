import { InputResolver, type TextSource } from '../inputResolver.js';
import { CliUsageError, MaskingOperationError } from '../errors.js';
import type {
  CliCommandContext,
  CommandDescriptor,
  CommandHandler,
  CommandResult,
} from '../types.js';
import type { ConfigService } from '../config/configService.js';

type MaskingStyle = 'block' | 'asterisk' | 'maskTag';

export interface MaskCommandOptions {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  style?: MaskingStyle;
  keepLength: boolean;
  language: 'ja' | 'en' | 'auto';
  maskUnknown: boolean;
  text?: string;
  file?: string;
  help?: boolean;
  format: 'text' | 'json';
  profile?: string;
}

const DEFAULT_BASE_URL = 'http://localhost:11434/v1';
const DEFAULT_MODEL = 'llama3';

const DEFAULTS: MaskCommandOptions = {
  style: 'block',
  keepLength: false,
  language: 'ja',
  maskUnknown: true,
  format: 'text',
};

function buildHelpMessage(): string {
  return `Mask-Cut CLI - マスキングコマンド

Usage:
  mask-cut [global-options] mask [options] --text "テキスト"
  mask-cut [global-options] mask [options] --file ./input.txt
  echo "テキスト" | mask-cut mask [options]

Options:
  --base-url <url>        OpenAI互換エンドポイントのベースURL (default: プロファイル設定 or ${DEFAULT_BASE_URL})
  --api-key <key>         APIキー (必要な場合のみ)
  --model <name>          モデル名 (default: プロファイル設定 or ${DEFAULT_MODEL})
  --style <style>         マスク方法: block | asterisk | maskTag (default: ${DEFAULTS.style})
  --keep-length           文字数を維持
  --language <code>       言語: ja | en | auto (default: ${DEFAULTS.language})
  --mask-unknown          あいまいな固有名詞もマスク (default: ${DEFAULTS.maskUnknown ? 'on' : 'off'})
  --no-mask-unknown       あいまいな固有名詞のマスクを無効化
  --format <text|json>    出力形式 (default: ${DEFAULTS.format})
  --text <text>           マスク対象のテキストを直接指定
  --file <path>           テキストファイルから読み込む
  --profile <name>        利用する接続プロファイル (default: config.json の defaultProfile)
  --help                  このヘルプを表示`;
}

function parseMaskCommandArgs(args: string[]): MaskCommandOptions {
  const parsed: MaskCommandOptions = {
    ...DEFAULTS,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    switch (arg) {
      case '--base-url':
        parsed.baseUrl = args[++i] ?? parsed.baseUrl;
        break;
      case '--api-key':
        parsed.apiKey = args[++i];
        break;
      case '--model':
        parsed.model = args[++i] ?? parsed.model;
        break;
      case '--style': {
        const style = args[++i];
        if (style === 'block' || style === 'asterisk' || style === 'maskTag') {
          parsed.style = style;
        }
        break;
      }
      case '--keep-length':
        parsed.keepLength = true;
        break;
      case '--language': {
        const lang = args[++i];
        if (lang === 'ja' || lang === 'en' || lang === 'auto') {
          parsed.language = lang;
        }
        break;
      }
      case '--mask-unknown':
        parsed.maskUnknown = true;
        break;
      case '--no-mask-unknown':
        parsed.maskUnknown = false;
        break;
      case '--format': {
        const format = (args[++i] ?? '').toLowerCase();
        if (format === 'json' || format === 'text') {
          parsed.format = format;
        }
        break;
      }
      case '--text':
        parsed.text = args[++i];
        break;
      case '--file':
        parsed.file = args[++i];
        break;
      case '--help':
      case '-h':
        parsed.help = true;
        break;
      case '--profile':
        parsed.profile = args[++i] ?? parsed.profile;
        break;
      default:
        if (!parsed.text) {
          parsed.text = arg;
        } else {
          parsed.text = `${parsed.text} ${arg}`;
        }
        break;
    }
  }

  return parsed;
}

function normalize(value?: string | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function inferTextSource(parsed: MaskCommandOptions): TextSource {
  if (parsed.text) {
    return { kind: 'inline', value: parsed.text };
  }

  if (parsed.file) {
    return { kind: 'file', path: parsed.file };
  }

  return { kind: 'stdin' };
}

async function executeMaskCommand(
  context: CliCommandContext,
  parsed: MaskCommandOptions,
  deps: MaskCommandDependencies,
): Promise<CommandResult> {
  if (parsed.help) {
    return {
      exitCode: 0,
      output: { kind: 'text', text: `${buildHelpMessage()}\n`, scope: 'info' },
    };
  }

  const source = inferTextSource(parsed);
  const resolved = await deps.inputResolver.resolve(source);

  if (!resolved.text) {
    throw new CliUsageError('マスク対象のテキストが空です');
  }

  const resolvedProfile = await deps.configService.getProfile(parsed.profile);
  const effectiveBaseUrl = normalize(parsed.baseUrl) ?? normalize(resolvedProfile.endpoint) ?? DEFAULT_BASE_URL;
  const effectiveModel = normalize(parsed.model) ?? normalize(resolvedProfile.model) ?? DEFAULT_MODEL;
  const effectiveApiKey = normalize(parsed.apiKey) ?? normalize(resolvedProfile.apiKey);

  const telemetryBase = {
    inputBytes: resolved.metadata.bytes,
    profile: resolvedProfile.name,
  };

  if (context.globals.dryRun) {
    return {
      exitCode: 0,
      output: {
        kind: 'dry-run',
        summary: 'マスク処理をドライランとして検証しました',
        details: {
          profile: resolvedProfile.name,
          model: effectiveModel,
          baseUrl: effectiveBaseUrl,
          style: parsed.style,
          inputBytes: resolved.metadata.bytes,
        },
      },
      telemetry: telemetryBase,
    };
  }

  const client = deps.llmFactory({
    baseUrl: effectiveBaseUrl,
    apiKey: effectiveApiKey,
    model: effectiveModel,
  });
  const startedAt = Date.now();

  const maskResult = await deps.maskingExecutor(client, resolved.text, {
    style: parsed.style,
    keepLength: parsed.keepLength,
    language: parsed.language,
    maskUnknownEntities: parsed.maskUnknown,
  });

  if (!maskResult.maskedText) {
    throw new MaskingOperationError('LLM からマスク済みテキストを取得できませんでした');
  }

  const durationMs = Date.now() - startedAt;
  const maskedBytes = Buffer.byteLength(maskResult.maskedText, 'utf-8');

  const output =
    parsed.format === 'json'
      ? {
          kind: 'json' as const,
          data: {
            maskedText: maskResult.maskedText,
            profile: resolvedProfile.name,
            options: {
              style: parsed.style,
              keepLength: parsed.keepLength,
              language: parsed.language,
              maskUnknown: parsed.maskUnknown,
            },
            metrics: {
              durationMs,
              inputBytes: resolved.metadata.bytes,
              maskedBytes,
            },
          },
        }
      : {
          kind: 'text' as const,
          text: `${maskResult.maskedText}\n`,
        };

  return {
    exitCode: 0,
    output,
    logFile: resolvedProfile.logFile,
    telemetry: {
      ...telemetryBase,
      maskedBytes,
    },
  };
}

interface LlmClientOptions {
  baseUrl: string;
  apiKey?: string;
  model: string;
}

export interface MaskCommandDependencies {
  inputResolver: InputResolver;
  configService: ConfigService;
  llmFactory: (options: LlmClientOptions) => any;
  maskingExecutor: (
    client: any,
    text: string,
    options: {
      style?: MaskingStyle;
      keepLength?: boolean;
      language?: 'ja' | 'en' | 'auto';
      maskUnknownEntities?: boolean;
    },
  ) => Promise<{ maskedText: string; originalText?: string }>;
}

export function createMaskCommandHandler(deps: MaskCommandDependencies): CommandHandler {
  return async (context) => {
    const parsed = parseMaskCommandArgs(context.argv);
    return executeMaskCommand(context, parsed, deps);
  };
}

export function createMaskCommandDescriptor(
  deps: MaskCommandDependencies,
): CommandDescriptor {
  return {
    name: 'mask',
    summary: 'テキストをLLMに渡す前に固有名詞をマスクする',
    usage: 'mask [options]',
    handler: createMaskCommandHandler(deps),
  };
}
