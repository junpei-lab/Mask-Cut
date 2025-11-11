const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildWindowOptions,
  resolveRendererEntry,
} = require('../windows/windowFactory');

test('main window enforces secure preferences', () => {
  const options = buildWindowOptions('main', '/tmp/preload.js');

  assert.equal(options.webPreferences?.contextIsolation, true);
  assert.equal(options.webPreferences?.sandbox, false);
  assert.equal(options.webPreferences?.nodeIntegration, false);
  assert.equal(options.webPreferences?.preload, '/tmp/preload.js');
  assert.equal(options.show, true);
});

test('settings window is hidden by default and smaller footprint', () => {
  const options = buildWindowOptions('settings', '/tmp/preload.js');

  assert.equal(options.show, false);
  assert.equal(options.resizable, false);
  assert.equal(options.webPreferences?.preload, '/tmp/preload.js');
  assert.equal(options.width, 480);
  assert.equal(options.height, 640);
});

test('renderer entries point to expected html assets', () => {
  const mainEntry = resolveRendererEntry('main', '/work/dist/main');
  const settingsEntry = resolveRendererEntry('settings', '/work/dist/main');

  assert.equal(mainEntry.endsWith('renderer/index.html'), true);
  assert.equal(settingsEntry.endsWith('renderer/settings.html'), true);
});
