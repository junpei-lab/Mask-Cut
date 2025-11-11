import type { MaskingStatusViewEvent } from './state/appState';
import type { SettingsSaveResult, SettingsViewModel } from './types/settings';

declare global {
  interface MaskingAPI {
    run(request: { text: string; options?: Record<string, unknown> }): Promise<unknown>;
    onStatus(
      listener: (event: unknown, payload: MaskingStatusViewEvent) => void,
    ): () => void;
  }

  interface SettingsAPI {
    get(): Promise<SettingsViewModel>;
    save?(payload: Record<string, unknown>): Promise<SettingsSaveResult>;
    onUpdate?(listener: (event: unknown, payload: SettingsViewModel) => void): () => void;
    openWindow?(): Promise<unknown>;
  }

  interface ClipboardAPI {
    copy(text: string): Promise<void>;
  }

  interface Window {
    maskingAPI?: MaskingAPI;
    settingsAPI?: SettingsAPI;
    clipboardAPI?: ClipboardAPI;
  }
}

export {};
