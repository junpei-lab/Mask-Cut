import type { IpcRenderer, IpcRendererEvent } from 'electron';

export type MaskingRequest = {
  text: string;
  options?: Record<string, unknown>;
};

export type MaskingStatusListener = (
  event: IpcRendererEvent,
  payload: unknown,
) => void;

function ensureText(text: string | undefined): string {
  const normalized = (text ?? '').trim();
  if (!normalized) {
    throw new Error('text is required');
  }
  return normalized;
}

export function buildMaskingAPI(ipc: Pick<IpcRenderer, 'invoke' | 'on' | 'removeListener'>) {
  return {
    async run(request: MaskingRequest): Promise<unknown> {
      const text = ensureText(request.text);
      const payload = {
        text,
        ...(request.options ? { options: request.options } : {}),
      };
      return ipc.invoke('masking:run', payload);
    },
    onStatus(listener: MaskingStatusListener): () => void {
      const handler = (event: IpcRendererEvent, ...args: unknown[]) => {
        listener(event, args[0]);
      };
      ipc.on('masking:status', handler);
      return () => {
        ipc.removeListener('masking:status', handler);
      };
    },
  };
}
