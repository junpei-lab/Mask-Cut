import {
  AppStateStore,
  INPUT_TEXT_MAX_LENGTH,
  applyStatusEvent,
  applySubmission,
  createInitialState,
  markCopyFeedback,
  updateDraftValue,
  type AppState,
  type MaskingStatusViewEvent,
} from './state/appState';
import type { SettingsSaveResult, SettingsViewModel } from './types/settings';

type MaskingAPIContract = {
  run(request: { text: string; options?: Record<string, unknown> }): Promise<unknown>;
  onStatus(
    listener: (event: unknown, payload: MaskingStatusViewEvent) => void,
  ): () => void;
};

type ClipboardAPIContract = {
  copy(text: string): Promise<void>;
};

type SettingsAPIContract = {
  get(): Promise<SettingsViewModel>;
  save?(payload: Record<string, unknown>): Promise<SettingsSaveResult>;
  onUpdate?(listener: (event: unknown, payload: SettingsViewModel) => void): () => void;
  openWindow?(): Promise<unknown>;
};

type RendererWindow = Window &
  typeof globalThis & {
    maskingAPI?: MaskingAPIContract;
    clipboardAPI?: ClipboardAPIContract;
    settingsAPI?: SettingsAPIContract;
  };

const rendererWindow = window as RendererWindow;

if (!rendererWindow.maskingAPI) {
  throw new Error('maskingAPI is not available in renderer context.');
}

const maskingAPI = rendererWindow.maskingAPI;

const clipboardAPI = rendererWindow.clipboardAPI;
const settingsAPI = rendererWindow.settingsAPI;

const store = new AppStateStore(createInitialState());

const titleIconEl = document.getElementById('app-title-icon') as HTMLImageElement | null;
const inputEl = document.getElementById('text-input') as HTMLTextAreaElement;
inputEl.maxLength = INPUT_TEXT_MAX_LENGTH;
const inputErrorEl = document.getElementById('input-error') as HTMLParagraphElement;
const inputCounterEl = document.getElementById('input-counter') as HTMLSpanElement | null;
const runButton = document.getElementById('run-button') as HTMLButtonElement;
const statusBanner = document.getElementById('status-banner') as HTMLDivElement;
const statusText = document.getElementById('status-text') as HTMLSpanElement;
const openSettingsButton = document.getElementById('open-settings') as HTMLButtonElement;
const resultPanel = document.getElementById('result-panel') as HTMLElement;
const resultText = document.getElementById('result-text') as HTMLTextAreaElement;
const resultMeta = document.getElementById('result-meta') as HTMLDivElement;
const copyButton = document.getElementById('copy-button') as HTMLButtonElement;
const copyFeedback = document.getElementById('copy-feedback') as HTMLSpanElement;
const connectionInfoEl = document.getElementById('connection-info') as HTMLParagraphElement | null;

function resolveAppIconPath(): string | undefined {
  if (!titleIconEl) {
    return undefined;
  }
  const normalizedPath = window.location.pathname.replace(/\\/g, '/');
  if (normalizedPath.includes('/dist/renderer/')) {
    return '../assets/icon.png';
  }
  return '../../../../assets/icon.png';
}

const resolvedAppIconPath = resolveAppIconPath();
if (titleIconEl && resolvedAppIconPath) {
  titleIconEl.src = resolvedAppIconPath;
}

let clearCopyTimeout: ReturnType<typeof setTimeout> | undefined;

function toErrorState(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  store.update((state) => ({
    ...state,
    locked: false,
    banner: {
      tone: 'error',
      message,
      showSettingsLink: true,
    },
  }));
}

function handleSubmit(): void {
  const current = store.getState();
  const limitedValue = inputEl.value.slice(0, INPUT_TEXT_MAX_LENGTH);
  if (limitedValue !== inputEl.value) {
    inputEl.value = limitedValue;
  }
  const { accepted, payload, nextState } = applySubmission(current, limitedValue);
  store.setState(nextState);
  if (!accepted || !payload) {
    return;
  }

  maskingAPI
    .run({ text: payload.text })
    .catch((error: unknown) => {
      console.error('failed to enqueue masking request', error);
      toErrorState(error);
    });
}

async function handleCopy(): Promise<void> {
  const text = store.getState().result?.text;
  if (!text || !clipboardAPI) {
    return;
  }

  try {
    await clipboardAPI.copy(text);
    store.update((state) => markCopyFeedback(state, 'success'));
  } catch (error) {
    console.error('copy failed', error);
    store.update((state) => markCopyFeedback(state, 'error'));
  } finally {
    if (clearCopyTimeout) {
      clearTimeout(clearCopyTimeout);
    }
    clearCopyTimeout = setTimeout(() => {
      store.update((state) => markCopyFeedback(state, undefined));
    }, 2000);
  }
}

function render(state: AppState): void {
  if (document.activeElement !== inputEl) {
    inputEl.value = state.draftText;
  }
  inputEl.disabled = state.locked;
  runButton.disabled = state.locked;
  if (inputCounterEl) {
    inputCounterEl.textContent = `${state.draftText.length} / ${INPUT_TEXT_MAX_LENGTH}`;
    inputCounterEl.dataset.status =
      state.draftText.length >= INPUT_TEXT_MAX_LENGTH ? 'limit' : '';
  }

  if (state.inputError) {
    inputErrorEl.textContent = state.inputError;
  } else {
    inputErrorEl.textContent = '';
  }

  statusBanner.dataset.tone = state.banner.tone;
  const statusMessage = state.banner.errorCode
    ? `${state.banner.message} (${state.banner.errorCode})`
    : state.banner.message;
  statusText.textContent = statusMessage;
  if (state.banner.tone === 'error' && state.banner.showSettingsLink) {
    openSettingsButton.dataset.state = 'highlight';
  } else {
    openSettingsButton.dataset.state = '';
  }

  if (state.result) {
    resultPanel.hidden = false;
    resultText.value = state.result.text;
    const metaParts = [state.result.model, state.result.endpoint].filter((value) => Boolean(value));
    resultMeta.textContent = metaParts.join(' / ');
    copyButton.disabled = state.locked;
  } else {
    resultPanel.hidden = true;
    resultText.value = '';
    resultMeta.textContent = '';
    copyButton.disabled = true;
  }

  if (!state.copyFeedback) {
    copyFeedback.dataset.status = '';
    copyFeedback.textContent = '';
  } else {
    copyFeedback.dataset.status = state.copyFeedback;
    copyFeedback.textContent = state.copyFeedback === 'success' ? 'コピーしました' : 'コピーに失敗しました';
  }
}

function describeConnection(settings: SettingsViewModel): string {
  try {
    const url = new URL(settings.endpointUrl);
    return `${url.hostname} / ${settings.modelName}`;
  } catch {
    return `${settings.endpointUrl} / ${settings.modelName}`;
  }
}

function updateConnectionInfo(view?: SettingsViewModel): void {
  if (!connectionInfoEl) {
    return;
  }
  if (!view) {
    connectionInfoEl.textContent = '接続情報を取得できませんでした';
    return;
  }
  connectionInfoEl.textContent = `接続先: ${describeConnection(view)}`;
}

inputEl.addEventListener('input', (event) => {
  const currentValue = (event.target as HTMLTextAreaElement).value;
  const limitedValue = currentValue.slice(0, INPUT_TEXT_MAX_LENGTH);
  if (limitedValue !== currentValue) {
    inputEl.value = limitedValue;
  }
  store.update((state) => updateDraftValue(state, limitedValue));
});

runButton.addEventListener('click', () => {
  handleSubmit();
});

copyButton.addEventListener('click', () => {
  void handleCopy();
});

openSettingsButton?.addEventListener('click', () => {
  if (settingsAPI?.openWindow) {
    settingsAPI
      .openWindow()
      .catch((error: unknown) => console.error('failed to open settings window', error));
  }
});

const unsubscribe = maskingAPI.onStatus((_event: unknown, payload: MaskingStatusViewEvent) => {
  store.update((state) => applyStatusEvent(state, payload));
});

window.addEventListener('beforeunload', () => {
  unsubscribe?.();
});

store.subscribe(render);

async function loadConnectionInfo(): Promise<void> {
  if (!settingsAPI?.get) {
    updateConnectionInfo();
    return;
  }
  try {
    const settings = (await settingsAPI.get()) as SettingsViewModel;
    updateConnectionInfo(settings);
  } catch (error) {
    console.error('failed to load settings info', error);
    updateConnectionInfo();
  }
}

settingsAPI?.onUpdate?.((_event: unknown, settings: SettingsViewModel) => {
  updateConnectionInfo(settings);
});

void loadConnectionInfo();
