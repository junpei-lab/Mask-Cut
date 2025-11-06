export interface LLMRequest {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  text: string;
  raw?: unknown;
}

export interface LLMClient {
  complete(req: LLMRequest): Promise<LLMResponse>;
}
