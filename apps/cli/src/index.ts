#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import process from 'node:process';

import {
  OpenAICompatibleClient,
  maskSensitiveInfo,
} from '@mask-cut/text-llm-core';

interface ParsedArgs {
  baseUrl: string;
  apiKey?: string;
  model: string;
  style?: 'block' | 'asterisk' | 'maskTag';
  keepLength: boolean;
  language: 'ja' | 'en' | 'auto';
  maskUnknown: boolean;
  text?: string;
  file?: string;
  help?: boolean;
}

const DEFAULTS = {
  baseUrl: 'http://localhost:11434/v1',
  model: 'llama3',
  style: 'block' as const,
  keepLength: false,
  language: 'ja' as const,
  maskUnknown: true,
};

function printHelp(): void {
  const message = `Mask-Cut CLI\n\nUsage:\n  mask-cut [options] --text "テキスト"\n  mask-cut [options] --file ./input.txt\n  echo "テキスト" | mask-cut [options]\n\nOptions:\n  --base-url <url>        OpenAI互換エンドポイントのベースURL (default: ${DEFAULTS.baseUrl})\n  --api-key <key>         APIキー (必要な場合のみ)\n  --model <name>          モデル名 (default: ${DEFAULTS.model})\n  --style <style>         マスク方法: block | asterisk | maskTag (default: ${DEFAULTS.style})\n  --keep-length           文字数を維持\n  --language <code>       言語: ja | en | auto (default: ${DEFAULTS.language})\n  --mask-unknown          あいまいな固有名詞もマスク (default: ${DEFAULTS.maskUnknown ? 'on' : 'off'})\n  --text <text>           マスク対象のテキストを直接指定\n  --file <path>           テキストファイルから読み込む\n  --help                  このヘルプを表示\n`;
  process.stdout.write(message);
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    baseUrl: DEFAULTS.baseUrl,
    model: DEFAULTS.model,
    style: DEFAULTS.style,
    keepLength: DEFAULTS.keepLength,
    language: DEFAULTS.language,
    maskUnknown: DEFAULTS.maskUnknown,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    switch (arg) {
      case '--base-url':
        args.baseUrl = argv[++i] ?? args.baseUrl;
        break;
      case '--api-key':
        args.apiKey = argv[++i];
        break;
      case '--model':
        args.model = argv[++i] ?? args.model;
        break;
      case '--style': {
        const style = argv[++i];
        if (style === 'block' || style === 'asterisk' || style === 'maskTag') {
          args.style = style;
        }
        break;
      }
      case '--keep-length':
        args.keepLength = true;
        break;
      case '--language': {
        const lang = argv[++i];
        if (lang === 'ja' || lang === 'en' || lang === 'auto') {
          args.language = lang;
        }
        break;
      }
      case '--mask-unknown':
        args.maskUnknown = true;
        break;
      case '--no-mask-unknown':
        args.maskUnknown = false;
        break;
      case '--text':
        args.text = argv[++i];
        break;
      case '--file':
        args.file = argv[++i];
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`未知のオプションです: ${arg}`);
        } else if (!args.text) {
          args.text = arg;
        } else {
          args.text = `${args.text} ${arg}`;
        }
        break;
    }
  }

  return args;
}

async function resolveInputText(parsed: ParsedArgs): Promise<string | undefined> {
  if (parsed.text) {
    return parsed.text;
  }

  if (parsed.file) {
    const data = await readFile(parsed.file, 'utf-8');
    return data;
  }

  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8').trim();
  }

  return undefined;
}

async function run(): Promise<void> {
  try {
    const parsed = parseArgs(process.argv.slice(2));

    if (parsed.help) {
      printHelp();
      return;
    }

    const text = await resolveInputText(parsed);

    if (!text) {
      printHelp();
      throw new Error('マスク対象のテキストが指定されていません。--text もしくは --file を利用するか、標準入力で渡してください。');
    }

    const client = new OpenAICompatibleClient(
      parsed.baseUrl,
      parsed.apiKey,
      parsed.model,
    );

    const result = await maskSensitiveInfo(client, text, {
      style: parsed.style,
      keepLength: parsed.keepLength,
      language: parsed.language,
      maskUnknownEntities: parsed.maskUnknown,
    });

    process.stdout.write(`${result.maskedText}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}

void run();
