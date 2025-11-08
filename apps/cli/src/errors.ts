export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

export class CliNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliNetworkError';
  }
}

export class CliTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliTimeoutError';
  }
}

export class MaskingOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaskingOperationError';
  }
}
