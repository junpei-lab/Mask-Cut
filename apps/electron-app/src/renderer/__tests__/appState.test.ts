import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INPUT_TEXT_MAX_LENGTH,
  createInitialState,
  applySubmission,
  applyStatusEvent,
  updateDraftValue,
  type MaskingStatusViewEvent,
} from '../state/appState';

test('applySubmission rejects blank input and keeps controls unlocked', () => {
  const initial = createInitialState();
  const { accepted, nextState } = applySubmission(initial, '   ');

  assert.equal(accepted, false);
  assert.equal(nextState.inputError, '入力が必要です');
  assert.equal(nextState.locked, false);
});

test('applySubmission trims text, clears errors, and locks the UI until status update arrives', () => {
  const initial = { ...createInitialState(), inputError: '入力が必要です' };
  const { accepted, payload, nextState } = applySubmission(initial, '  東京 太郎  ');

  assert.equal(accepted, true);
  assert.equal(payload?.text, '東京 太郎');
  assert.equal(nextState.locked, true);
  assert.equal(nextState.inputError, undefined);
  assert.equal(nextState.banner.message.includes('開始'), true);
});

test('applyStatusEvent success unlocks the UI and records the latest result snapshot', () => {
  const initial = { ...createInitialState(), locked: true };
  const event: MaskingStatusViewEvent = {
    jobId: 'job-1',
    state: 'succeeded',
    maskedText: '■■■ さん',
    model: 'gpt-4',
    endpoint: 'primary',
    locked: false,
  };

  const next = applyStatusEvent(initial, event);

  assert.equal(next.locked, false);
  assert.equal(next.result?.text, '■■■ さん');
  assert.equal(next.result?.model, 'gpt-4');
  assert.equal(next.result?.endpoint, 'primary');
  assert.equal(next.banner.tone, 'success');
  assert.equal(next.banner.message.includes('完了'), true);
});

test('applyStatusEvent failure surfaces error info and enables settings guidance', () => {
  const initial = { ...createInitialState(), locked: true };
  const event: MaskingStatusViewEvent = {
    jobId: 'job-2',
    state: 'failed',
    message: 'ネットワークに接続できません',
    errorCode: 'E_NETWORK',
    locked: false,
  };

  const next = applyStatusEvent(initial, event);

  assert.equal(next.locked, false);
  assert.equal(next.banner.tone, 'error');
  assert.equal(next.banner.message.includes('ネットワーク'), true);
  assert.equal(next.banner.errorCode, 'E_NETWORK');
  assert.equal(next.banner.showSettingsLink, true);
});

test('updateDraftValue clamps draft text to the configured max length', () => {
  const initial = createInitialState();
  const overLimitText = 'a'.repeat(INPUT_TEXT_MAX_LENGTH + 10);
  const next = updateDraftValue(initial, overLimitText);

  assert.equal(next.draftText.length, INPUT_TEXT_MAX_LENGTH);
});

test('applySubmission never returns payloads longer than the configured max length', () => {
  const initial = createInitialState();
  const input = `${'b'.repeat(INPUT_TEXT_MAX_LENGTH + 50)} suffix`;

  const { accepted, payload, nextState } = applySubmission(initial, input);

  assert.equal(accepted, true);
  assert.equal(payload?.text.length, INPUT_TEXT_MAX_LENGTH);
  assert.equal(nextState.draftText.length, INPUT_TEXT_MAX_LENGTH);
});
