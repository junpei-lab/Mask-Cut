import type { LLMClient } from '../llm/types';
import { MASKING_SYSTEM_PROMPT } from './maskingPrompts';
import type { MaskingOptions, MaskingResult, MaskingStyle } from './masking.types';

function buildMaskToken(style: MaskingStyle = 'block'): string {
  switch (style) {
    case 'asterisk':
      return '***';
    case 'maskTag':
      return '[MASK]';
    case 'block':
    default:
      return '■■■';
  }
}

function toJapaneseBoolean(value: boolean): 'はい' | 'いいえ' {
  return value ? 'はい' : 'いいえ';
}

export async function maskSensitiveInfo(
  llm: LLMClient,
  input: string,
  options: MaskingOptions = {},
): Promise<MaskingResult> {
  const maskToken = buildMaskToken(options.style);
  const keepLength = options.keepLength ?? false;
  const language = options.language ?? 'ja';
  const maskUnknown = options.maskUnknownEntities ?? false;

  const userPrompt = `
以下のテキストの中から、人名・社名・組織名にあたる部分をマスキングしてください。

- マスクに使う記号: ${maskToken}
- 文字数を保つ: ${toJapaneseBoolean(keepLength)}
- 言語: ${language}
- あいまいな固有名詞もマスクする: ${toJapaneseBoolean(maskUnknown)}

出力は「元のテキストと同じ形式」で、マスクしたい部分だけを置き換えてください。
余計な説明文やコメントは一切書かず、「テキストのみ」を返してください。

テキスト:
${input}
`.trim();

  const requestModel = ((options as { model?: string })?.model ?? '').trim();

  const response = await llm.complete({
    model: requestModel || '',
    prompt: userPrompt,
    systemPrompt: MASKING_SYSTEM_PROMPT,
  });

  return {
    maskedText: response.text,
    originalText: input,
  };
}

export { buildMaskToken };
