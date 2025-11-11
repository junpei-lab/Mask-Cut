import { InMemoryMaskingCacheStore, type MaskingCacheState, type MaskingCacheStore, type MaskingResultSnapshot } from './maskingCacheStore';

type MaskingCacheDeps = {
  store?: MaskingCacheStore;
};

export class MaskingCache {
  private readonly store: MaskingCacheStore;

  private state: MaskingCacheState | null = null;

  constructor(deps: MaskingCacheDeps = {}) {
    this.store = deps.store ?? new InMemoryMaskingCacheStore();
  }

  async rememberInput(text: string): Promise<void> {
    const normalized = text.trim();
    if (!normalized) {
      return;
    }
    const state = await this.ensureState();
    state.lastInput = normalized;
    await this.persist(state);
  }

  async rememberResult(snapshot: MaskingResultSnapshot): Promise<void> {
    const state = await this.ensureState();
    state.lastInput = snapshot.inputText;
    state.lastResult = { ...snapshot };
    await this.persist(state);
  }

  async getLastInput(): Promise<string | null> {
    const state = await this.ensureState();
    return state.lastInput ?? null;
  }

  async getLastResult(): Promise<MaskingResultSnapshot | null> {
    const state = await this.ensureState();
    return state.lastResult ? { ...state.lastResult } : null;
  }

  async clear(): Promise<void> {
    this.state = {};
    await this.store.write(null);
  }

  private async ensureState(): Promise<MaskingCacheState> {
    if (this.state) {
      return this.state;
    }
    const stored = await this.store.read();
    this.state = stored ? { ...stored } : {};
    return this.state;
  }

  private async persist(state: MaskingCacheState): Promise<void> {
    const hasData = Boolean(state.lastInput || state.lastResult);
    if (!hasData) {
      await this.store.write(null);
      return;
    }
    await this.store.write({ ...state });
  }
}

export type { MaskingResultSnapshot } from './maskingCacheStore';
