import test from 'node:test';
import assert from 'node:assert/strict';

import type { MaskingStatusViewEvent } from '../state/appState';
import type { SettingsViewModel } from '../types/settings';
import {
  FakeDocument,
  FakeElement,
  FakeWindow,
  installDomGlobals,
} from './helpers/fakeDom';

function createElement(doc: FakeDocument, id: string, tag: string = 'div', text = ''): FakeElement {
  const el = new FakeElement(id, tag);
  el.textContent = text;
  doc.register(el);
  return el;
}

function createMainViewDom() {
  const doc = new FakeDocument();
  const refs = {
    input: createElement(doc, 'text-input', 'textarea'),
    inputError: createElement(doc, 'input-error'),
    runButton: createElement(doc, 'run-button', 'button'),
    statusBanner: createElement(doc, 'status-banner'),
    statusText: createElement(doc, 'status-text'),
    openSettingsButton: createElement(doc, 'open-settings', 'button'),
    resultPanel: createElement(doc, 'result-panel'),
    resultText: createElement(doc, 'result-text', 'textarea'),
    resultMeta: createElement(doc, 'result-meta'),
    copyButton: createElement(doc, 'copy-button', 'button'),
    copyFeedback: createElement(doc, 'copy-feedback'),
    connectionInfo: createElement(doc, 'connection-info'),
  } as const;

  refs.resultPanel.hidden = true;
  refs.copyButton.disabled = true;
  refs.statusBanner.dataset.tone = 'info';

  return { doc, refs };
}

type MaskingListener = (payload: MaskingStatusViewEvent) => void;

type MainHarness = {
  runCalls: string[];
  clipboardCopies: string[];
  emitStatus: (payload: MaskingStatusViewEvent) => void;
  emitSettingsUpdate: (settings: SettingsViewModel) => void;
  refs: ReturnType<typeof createMainViewDom>['refs'];
  cleanup: () => void;
  getSettingsOpenCount: () => number;
  flush: () => Promise<void>;
  flushTimers: () => void;
};

async function setupMainHarness(initialSettings?: SettingsViewModel): Promise<MainHarness> {
  const { doc, refs } = createMainViewDom();
  const win = new FakeWindow(doc);
  const restoreGlobals = installDomGlobals(doc, win);
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const pendingTimers: Array<() => void> = [];

  (global as any).setTimeout = ((callback: (...args: any[]) => void) => {
    const id = pendingTimers.length;
    pendingTimers.push(() => {
      callback();
    });
    return id as unknown as NodeJS.Timeout;
  }) as typeof setTimeout;
  (global as any).clearTimeout = ((id: NodeJS.Timeout) => {
    const index = Number(id);
    if (!Number.isNaN(index) && pendingTimers[index]) {
      pendingTimers[index] = () => {};
    }
  }) as typeof clearTimeout;

  const statusListeners: MaskingListener[] = [];
  const runCalls: string[] = [];
  const clipboardCopies: string[] = [];
  let settingsUpdateListener: ((settings: SettingsViewModel) => void) | null = null;
  let settingsOpenCount = 0;

  const maskingAPI = {
    async run(payload: { text: string }) {
      runCalls.push(payload.text);
    },
    onStatus(listener: (event: unknown, payload: MaskingStatusViewEvent) => void) {
      statusListeners.push((payload) => listener({}, payload));
      return () => {
        const idx = statusListeners.indexOf(listener as never);
        if (idx >= 0) {
          statusListeners.splice(idx, 1);
        }
      };
    },
  };

  const clipboardAPI = {
    async copy(text: string) {
      clipboardCopies.push(text);
    },
  };

  const settingsAPI = {
    async get() {
      return (
        initialSettings ?? {
          endpointUrl: 'https://api.initial',
          modelName: 'default-model',
          vaultKeyId: 'default',
          timeoutMs: 60_000,
          lastUpdatedAt: new Date().toISOString(),
        }
      );
    },
    async openWindow() {
      settingsOpenCount += 1;
    },
    onUpdate(listener: (event: unknown, payload: SettingsViewModel) => void) {
      settingsUpdateListener = (payload) => listener({}, payload);
      return () => {
        settingsUpdateListener = null;
      };
    },
  };

  (win as any).maskingAPI = maskingAPI;
  (win as any).clipboardAPI = clipboardAPI;
  (win as any).settingsAPI = settingsAPI;

  const rendererModulePath = require.resolve('../renderer');
  delete require.cache[rendererModulePath];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require(rendererModulePath);

  const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));
  await flush();

  return {
    runCalls,
    clipboardCopies,
    emitStatus: (payload) => statusListeners.forEach((listener) => listener(payload)),
    emitSettingsUpdate: (settings) => settingsUpdateListener?.(settings),
    refs,
    getSettingsOpenCount: () => settingsOpenCount,
    cleanup: () => {
      (global as any).setTimeout = originalSetTimeout;
      (global as any).clearTimeout = originalClearTimeout;
      restoreGlobals();
    },
    flush,
    flushTimers: () => {
      while (pendingTimers.length > 0) {
        const timer = pendingTimers.shift();
        timer?.();
      }
    },
  };
}

test('空入力はエラーとして扱われ、リクエストは送信されない', async () => {
  const harness = await setupMainHarness();
  harness.refs.runButton.click();

  assert.equal(harness.runCalls.length, 0);
  assert.match(harness.refs.inputError.textContent, /入力/);
  harness.cleanup();
});

test('正常入力→結果表示→コピー操作のフロー', async () => {
  const harness = await setupMainHarness();
  harness.refs.input.value = '  東京 太郎  ';
  harness.refs.runButton.click();

  assert.deepEqual(harness.runCalls, ['東京 太郎']);

  harness.emitStatus({ jobId: '1', state: 'running', locked: true });
  harness.emitStatus({
    jobId: '1',
    state: 'succeeded',
    locked: false,
    maskedText: '■■■ 太郎',
    model: 'gpt-4',
    endpoint: 'primary',
  });

  assert.equal(harness.refs.resultPanel.hidden, false);
  assert.equal(harness.refs.resultText.value, '■■■ 太郎');
  assert.equal(harness.refs.copyButton.disabled, false);

  harness.refs.copyButton.click();
  await harness.flush();

  assert.deepEqual(harness.clipboardCopies, ['■■■ 太郎']);
  assert.match(harness.refs.copyFeedback.textContent, /コピーしました/);
  harness.flushTimers();
  harness.cleanup();
});

test('エラー時に設定導線をハイライトし、settings:update で接続表示を更新する', async () => {
  const harness = await setupMainHarness();
  assert.equal(harness.refs.openSettingsButton.hidden, false);
  assert.equal(harness.refs.openSettingsButton.dataset.state ?? '', '');
  harness.emitStatus({
    jobId: '1',
    state: 'failed',
    message: 'ネットワークに失敗しました',
    errorCode: 'E_NETWORK',
    locked: false,
  });
  assert.equal(harness.refs.openSettingsButton.dataset.state, 'highlight');

  harness.emitSettingsUpdate({
    endpointUrl: 'https://api.next',
    modelName: 'next-model',
    vaultKeyId: 'next',
    timeoutMs: 30_000,
    lastUpdatedAt: new Date().toISOString(),
  });

  await harness.flush();
  assert.match(harness.refs.connectionInfo.textContent, /api\.next/);
  harness.refs.openSettingsButton.click();
  await harness.flush();
  assert.equal(harness.getSettingsOpenCount(), 1);
  harness.cleanup();
});
