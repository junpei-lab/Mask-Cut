import type { SettingsSaveResult, SettingsViewModel } from './types/settings';

type SettingsRendererAPI = {
  get(): Promise<SettingsViewModel>;
  save?(payload: Record<string, unknown>): Promise<SettingsSaveResult>;
  onUpdate?(listener: (event: unknown, settings: SettingsViewModel) => void): () => void;
};

type SettingsWindow = Window & typeof globalThis & { settingsAPI?: SettingsRendererAPI };

const settingsWindow = window as SettingsWindow;

if (!settingsWindow.settingsAPI) {
  throw new Error('settingsAPI is not available');
}

const api = settingsWindow.settingsAPI;

const form = document.getElementById('settings-form') as HTMLFormElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const statusText = document.getElementById('status-text') as HTMLSpanElement;
const lastUpdatedEl = document.getElementById('last-updated') as HTMLSpanElement;
const saveButton = document.getElementById('save-button') as HTMLButtonElement;
const closeButton = document.getElementById('close-button') as HTMLButtonElement;

const endpointInput = document.getElementById('endpoint-url') as HTMLInputElement;
const modelInput = document.getElementById('model-name') as HTMLInputElement;
const vaultInput = document.getElementById('vault-key-id') as HTMLInputElement;
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const timeoutInput = document.getElementById('timeout-ms') as HTMLInputElement;

type FieldKey = 'endpointUrl' | 'modelName' | 'vaultKeyId' | 'timeoutMs';

type ValidationErrors = Partial<Record<FieldKey, string>>;

let isSaving = false;

function setStatus(message: string, tone: 'info' | 'success' | 'error'): void {
  statusEl.dataset.tone = tone;
  statusText.textContent = message;
}

function formatTimestamp(value: string | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return `最終更新: ${parsed.toLocaleString('ja-JP')}`;
}

function renderErrors(errors: ValidationErrors = {}): void {
  const fields: FieldKey[] = ['endpointUrl', 'modelName', 'vaultKeyId', 'timeoutMs'];
  fields.forEach((field) => {
    const target = document.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
    if (!target) return;
    target.textContent = errors[field] ?? '';
  });
}

function applySettingsView(settings: SettingsViewModel): void {
  endpointInput.value = settings.endpointUrl;
  modelInput.value = settings.modelName;
  vaultInput.value = settings.vaultKeyId;
  timeoutInput.value = String(settings.timeoutMs ?? 60_000);
  lastUpdatedEl.textContent = formatTimestamp(settings.lastUpdatedAt);
}

function setFormDisabled(disabled: boolean): void {
  endpointInput.disabled = disabled;
  modelInput.disabled = disabled;
  vaultInput.disabled = disabled;
  apiKeyInput.disabled = disabled;
  timeoutInput.disabled = disabled;
  saveButton.disabled = disabled;
}

async function loadSettings(): Promise<void> {
  try {
    const settings = await api.get();
    applySettingsView(settings);
    setStatus('設定を編集できます', 'info');
    renderErrors();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '設定の読み込みに失敗しました';
    setStatus(message, 'error');
    setFormDisabled(true);
  }
}

async function handleSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (isSaving) return;

  isSaving = true;
  setFormDisabled(true);
  setStatus('保存中です…', 'info');
  renderErrors();

  const payload: {
    endpointUrl: string;
    modelName: string;
    vaultKeyId: string;
    timeoutMs?: number;
    apiKey?: string;
  } = {
    endpointUrl: endpointInput.value.trim(),
    modelName: modelInput.value.trim(),
    vaultKeyId: vaultInput.value.trim(),
  };

  const timeoutValue = Number(timeoutInput.value);
  if (Number.isFinite(timeoutValue) && timeoutValue > 0) {
    payload.timeoutMs = timeoutValue;
  }

  if (apiKeyInput.value.trim()) {
    payload.apiKey = apiKeyInput.value.trim();
  }

  try {
    const result = (await api.save?.(payload)) as SettingsSaveResult | undefined;

    if (!result) {
      throw new Error('設定保存 API が利用できません');
    }

    if (result.ok) {
      applySettingsView(result.settings);
      setStatus('設定を保存しました', 'success');
      renderErrors();
      apiKeyInput.value = '';
    } else if (result.validationErrors) {
      renderErrors(result.validationErrors as ValidationErrors);
      setStatus('入力エラーを確認してください', 'error');
    } else if (result.connectivityError) {
      setStatus(result.connectivityError, 'error');
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '設定の保存に失敗しました';
    setStatus(message, 'error');
  } finally {
    isSaving = false;
    setFormDisabled(false);
  }
}

form.addEventListener('submit', (event) => {
  void handleSubmit(event as SubmitEvent);
});

closeButton.addEventListener('click', () => {
  settingsWindow.close();
});

api.onUpdate?.((_event: unknown, settings: SettingsViewModel) => {
  applySettingsView(settings);
  setStatus('別のウィンドウで更新されました', 'info');
});

void loadSettings();
