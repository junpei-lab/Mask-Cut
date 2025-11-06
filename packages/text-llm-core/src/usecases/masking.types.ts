export type MaskingStyle = 'block' | 'asterisk' | 'maskTag';

export interface MaskingOptions {
  style?: MaskingStyle;
  keepLength?: boolean;
  language?: 'ja' | 'en' | 'auto';
  maskUnknownEntities?: boolean;
}

export interface MaskingResult {
  maskedText: string;
  originalText?: string;
}
