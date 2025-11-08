import { InputResolveError } from './inputResolver.js';
import {
  CliNetworkError,
  CliTimeoutError,
  CliUsageError,
  MaskingOperationError,
} from './errors.js';
import type { CommandOutput } from './types.js';

interface MappedError {
  exitCode: number;
  output: CommandOutput;
  errorCode: string;
}

export class ErrorDomainMapper {
  map(error: unknown): MappedError {
    if (error instanceof CliUsageError || error instanceof InputResolveError) {
      return this.build(
        'E_USAGE',
        error.message,
        2,
        ["'mask-cut --help' で利用可能なオプションを確認してください"],
      );
    }

    if (isConfigError(error)) {
      return this.build('CONFIG_ERROR', error.message, 1, [
        "'mask-cut config list' で設定を確認してください",
      ]);
    }

    if (error instanceof CliNetworkError) {
      return this.build('E_NETWORK', error.message, 1, ['ネットワーク接続を確認してください']);
    }

    if (error instanceof CliTimeoutError) {
      return this.build('E_TIMEOUT', error.message, 1, ['後でもう一度お試しください']);
    }

    if (error instanceof MaskingOperationError) {
      return this.build('E_MASK_FAILED', error.message, 1);
    }

    if (error instanceof Error) {
      return this.build('E_UNEXPECTED', error.message, 1);
    }

    return this.build('E_UNEXPECTED', String(error), 1);
  }

  private build(
    code: string,
    message: string,
    exitCode: number,
    suggestions: string[] = [],
  ): MappedError {
    return {
      exitCode,
      errorCode: code,
      output: {
        kind: 'error',
        code,
        message,
        suggestions,
      },
    };
  }
}

function isConfigError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'ConfigError';
}
