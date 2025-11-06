import {
  OpenAICompatibleClient,
  maskSensitiveInfo,
} from '@mask-cut/text-llm-core';

const llmClient = new OpenAICompatibleClient(
  'http://localhost:11434/v1',
  undefined,
  'llama3',
);

const inputEl = document.getElementById('input') as HTMLTextAreaElement;
const outputEl = document.getElementById('output') as HTMLTextAreaElement;
const button = document.getElementById('run') as HTMLButtonElement;
const statusEl = document.getElementById('status-message') as HTMLSpanElement;

async function runMasking(): Promise<void> {
  button.disabled = true;
  statusEl.textContent = 'マスキング中...';

  try {
    const result = await maskSensitiveInfo(llmClient, inputEl.value, {
      style: 'block',
      keepLength: false,
      language: 'ja',
      maskUnknownEntities: true,
    });

    outputEl.value = result.maskedText;
    statusEl.textContent = '完了';
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    outputEl.value = `エラー: ${message}`;
    statusEl.textContent = 'エラーが発生しました';
  } finally {
    button.disabled = false;
  }
}

button.addEventListener('click', () => {
  void runMasking();
});
