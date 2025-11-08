import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { Readable } from 'node:stream';

export type TextSource =
  | { kind: 'inline'; value: string }
  | { kind: 'file'; path: string }
  | { kind: 'stdin' }
  | { kind: 'interactive'; prompt?: string };

export interface InputMetadata {
  source: 'inline' | 'file' | 'stdin' | 'interactive';
  filePath?: string;
  bytes: number;
}

export interface ResolvedInput {
  text: string;
  metadata: InputMetadata;
}

export interface InputResolverDependencies {
  stdinFactory?: () => Readable;
  readFileImpl?: (path: string, encoding: BufferEncoding) => Promise<string>;
}

export class InputResolveError extends Error {}

export class InputResolver {
  private readonly stdinFactory: () => Readable;

  private readonly readFileImpl: (path: string, encoding: BufferEncoding) => Promise<string>;

  constructor(deps: InputResolverDependencies = {}) {
    this.stdinFactory = deps.stdinFactory ?? (() => process.stdin);
    this.readFileImpl = deps.readFileImpl ?? ((path, encoding) => readFile(path, { encoding }));
  }

  async resolve(source: TextSource): Promise<ResolvedInput> {
    switch (source.kind) {
      case 'inline':
        return this.resolveInline(source.value);
      case 'file':
        return this.resolveFile(source.path);
      case 'stdin':
        return this.resolveStdin();
      case 'interactive':
        throw new InputResolveError('interactive mode is not implemented yet');
      default:
        throw new InputResolveError(`Unsupported text source: ${(source as TextSource).kind}`);
    }
  }

  private async resolveInline(value: string): Promise<ResolvedInput> {
    const text = value ?? '';
    return {
      text,
      metadata: {
        source: 'inline',
        bytes: Buffer.byteLength(text, 'utf-8'),
      },
    };
  }

  private async resolveFile(path: string): Promise<ResolvedInput> {
    if (!path) {
      throw new InputResolveError('ファイルパスが指定されていません');
    }

    const text = await this.readFileImpl(path, 'utf-8');

    return {
      text,
      metadata: {
        source: 'file',
        filePath: path,
        bytes: Buffer.byteLength(text, 'utf-8'),
      },
    };
  }

  private async resolveStdin(): Promise<ResolvedInput> {
    const stream = this.stdinFactory();

    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    if (chunks.length === 0) {
      throw new InputResolveError('stdin provided no data');
    }

    const text = Buffer.concat(chunks).toString('utf-8').trim();

    return {
      text,
      metadata: {
        source: 'stdin',
        bytes: Buffer.byteLength(text, 'utf-8'),
      },
    };
  }
}
