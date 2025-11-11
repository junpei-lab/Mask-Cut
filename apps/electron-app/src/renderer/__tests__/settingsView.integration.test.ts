import test from 'node:test';
import assert from 'node:assert/strict';

import type { SettingsSaveResult, SettingsViewModel } from '../types/settings';
import { FakeDocument, FakeElement, FakeWindow, installDomGlobals } from './helpers/fakeDom';

const queueMicrotaskAsync = () => new Promise<void>((resolve) => queueMicrotask(resolve));

function createSettingsDom() {
  const doc = new FakeDocument();
  const refs = {
    status: new FakeElement('status'),
    statusText: new FakeElement('status-text'),
    lastUpdated: new FakeElement('last-updated'),
    form: new FakeElement('settings-form', 'form'),
    endpoint: new FakeElement('endpoint-url', 'input'),
    model: new FakeElement('model-name', 'input'),
    vault: new FakeElement('vault-key-id', 'input'),
    apiKey: new FakeElement('api-key', 'input'),
    timeout: new FakeElement('timeout-ms', 'input'),
    saveButton: new FakeElement('save-button', 'button'),
    closeButton: new FakeElement('close-button', 'button'),
    endpointError: new FakeElement('endpoint-error', 'span'),
    modelError: new FakeElement('model-error', 'span'),
    vaultError: new FakeElement('vault-error', 'span'),
    timeoutError: new FakeElement('timeout-error', 'span'),
  } as const;

  refs.status.dataset.tone = 'info';

  Object.values(refs).forEach((element) => {
    if (element instanceof FakeElement) {
      doc.register(element);
    }
  });

  refs.endpointError.setDataAttribute('data-error-for', 'endpointUrl');
  refs.modelError.setDataAttribute('data-error-for', 'modelName');
  refs.vaultError.setDataAttribute('data-error-for', 'vaultKeyId');
  refs.timeoutError.setDataAttribute('data-error-for', 'timeoutMs');

  return { doc, refs };
}

type SettingsHarness = {
  refs: ReturnType<typeof createSettingsDom>['refs'];
  saveCalls: Array<Record<string, unknown>>;
  setSaveResult: (result: SettingsSaveResult) => void;
  emitUpdate: (settings: SettingsViewModel) => void;
  submit: () => void;
  cleanup: () => void;
  getWindow: () => FakeWindow;
};

async function setupSettingsHarness(options?: { initial?: SettingsViewModel; saveResult?: SettingsSaveResult }): Promise<SettingsHarness> {
  const { doc, refs } = createSettingsDom();
  const win = new FakeWindow(doc);
  const restore = installDomGlobals(doc, win);

  const saveCalls: Array<Record<string, unknown>> = [];
  let currentSaveResult: SettingsSaveResult =
    options?.saveResult ??
    ({
      ok: true,
      settings:
        options?.initial ??
        ({
          endpointUrl: 'https://api.initial',
          modelName: 'starter',
          vaultKeyId: 'vault',
          timeoutMs: 60_000,
          lastUpdatedAt: new Date().toISOString(),
        } satisfies SettingsViewModel),
    } satisfies SettingsSaveResult);

  let updateListener: ((settings: SettingsViewModel) => void) | null = null;

  const settingsAPI = {
    async get() {
      return (
        options?.initial ?? {
          endpointUrl: 'https://api.initial',
          modelName: 'starter',
          vaultKeyId: 'vault',
          timeoutMs: 60_000,
          lastUpdatedAt: new Date().toISOString(),
        }
      );
    },
    async save(payload: Record<string, unknown>) {
      saveCalls.push(payload);
      return currentSaveResult;
    },
    onUpdate(listener: (event: unknown, settings: SettingsViewModel) => void) {
      updateListener = (settings) => listener({}, settings);
      return () => {
        updateListener = null;
      };
    },
  };

  (win as any).settingsAPI = settingsAPI;

  const settingsModulePath = require.resolve('../settings');
  delete require.cache[settingsModulePath];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require(settingsModulePath);

  refs.endpoint.value = 'https://api.initial';
  refs.model.value = 'starter';
  refs.vault.value = 'vault';
  refs.timeout.value = '60000';

  const submit = () => {
    refs.form.dispatchEvent({
      type: 'submit',
      preventDefault() {},
    });
  };

  return {
    refs,
    saveCalls,
    setSaveResult: (result) => {
      currentSaveResult = result;
    },
    emitUpdate: (settings) => updateListener?.(settings),
    submit,
    cleanup: () => {
      restore();
    },
    getWindow: () => win,
  };
}

test('設定読み込みと閉じるボタンの動作', async () => {
  const harness = await setupSettingsHarness();
  assert.equal(harness.refs.endpoint.value, 'https://api.initial');
  harness.refs.closeButton.click();
  assert.equal(harness.getWindow().closeCalled, true);
  harness.cleanup();
});

test('バリデーションエラーと接続エラーを表示する', async () => {
  const harness = await setupSettingsHarness({
    saveResult: {
      ok: false,
      validationErrors: {
        endpointUrl: 'URL を入力',
        modelName: 'モデル名を入力',
      },
    },
  });

  harness.submit();
  await queueMicrotaskAsync();
  assert.match(harness.refs.statusText.textContent, /入力エラー/);
  assert.match(harness.refs.endpointError.textContent, /URL/);

  harness.setSaveResult({ ok: false, connectivityError: '接続できません' });
  harness.submit();
  await queueMicrotaskAsync();
  assert.match(harness.refs.statusText.textContent, /接続できません/);
  harness.cleanup();
});

test('保存成功で API キー入力をクリアし、最終更新を更新する', async () => {
  const harness = await setupSettingsHarness();
  harness.refs.apiKey.value = 'secret';
  const now = new Date().toISOString();
  harness.setSaveResult({
    ok: true,
    settings: {
      endpointUrl: 'https://api.new',
      modelName: 'updated-model',
      vaultKeyId: 'vault',
      timeoutMs: 45_000,
      lastUpdatedAt: now,
    },
  });

  harness.submit();
  await queueMicrotaskAsync();
  assert.equal(harness.saveCalls.length > 0, true);
  assert.equal(harness.refs.apiKey.value, '');
  assert.match(harness.refs.statusText.textContent, /保存しました/);
  assert.match(harness.refs.lastUpdated.textContent, /最終更新/);
  harness.cleanup();
});
