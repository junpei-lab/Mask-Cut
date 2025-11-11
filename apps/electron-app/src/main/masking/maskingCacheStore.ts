export type MaskingResultSnapshot = {
  inputText: string;
  maskedText: string;
  model: string;
  endpoint: string;
  finishedAt: number;
};

export type MaskingCacheState = {
  lastInput?: string;
  lastResult?: MaskingResultSnapshot;
};

export interface MaskingCacheStore {
  read(): Promise<MaskingCacheState | null>;
  write(state: MaskingCacheState | null): Promise<void>;
}

export class InMemoryMaskingCacheStore implements MaskingCacheStore {
  constructor(private state: MaskingCacheState | null = null) {}

  async read(): Promise<MaskingCacheState | null> {
    return this.state ? { ...this.state } : null;
  }

  async write(next: MaskingCacheState | null): Promise<void> {
    this.state = next ? { ...next } : null;
  }
}
