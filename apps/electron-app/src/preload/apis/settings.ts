import type { IpcRenderer, IpcRendererEvent } from 'electron';

export type SettingsInput = {
  endpointUrl: string;
  modelName: string;
  vaultKeyId: string;
  timeoutMs?: number;
  apiKey?: string;
};

export type SettingsListener = (
  event: IpcRendererEvent,
  payload: unknown,
) => void;

function ensureField(value: string, field: string): string {
  const normalized = (value ?? '').trim();
  if (!normalized) {
    throw new Error(`${field} is required`);
  }
  return normalized;
}

function sanitizeInput(input: SettingsInput): SettingsInput {
  return {
    endpointUrl: ensureField(input.endpointUrl, 'endpointUrl'),
    modelName: ensureField(input.modelName, 'modelName'),
    vaultKeyId: ensureField(input.vaultKeyId, 'vaultKeyId'),
    ...(typeof input.timeoutMs === 'number' ? { timeoutMs: input.timeoutMs } : {}),
  };
}

export function buildSettingsAPI(
  ipc: Pick<IpcRenderer, 'invoke' | 'on' | 'removeListener'>,
) {
  return {
    get(): Promise<unknown> {
      return ipc.invoke('settings:get');
    },
    async save(input: SettingsInput): Promise<unknown> {
      const payload = sanitizeInput(input);
      try {
        new URL(payload.endpointUrl);
      } catch {
        throw new Error('endpointUrl must be a valid URL');
      }
      const body = input.apiKey ? { ...payload, apiKey: input.apiKey } : payload;
      return ipc.invoke('settings:save', body);
    },
    onUpdate(listener: SettingsListener): () => void {
      const handler = (event: IpcRendererEvent, ...args: unknown[]) => {
        listener(event, args[0]);
      };
      ipc.on('settings:update', handler);
      return () => ipc.removeListener('settings:update', handler);
    },
    openWindow(): Promise<unknown> {
      return ipc.invoke('settings:open');
    },
  };
}
