import type { IpcRenderer } from 'electron';

export function buildClipboardAPI(ipc: Pick<IpcRenderer, 'invoke'>) {
  return {
    async copy(text: string): Promise<void> {
      const normalized = (text ?? '').trim();
      if (!normalized) {
        throw new Error('text is required');
      }
      await ipc.invoke('clipboard:copy', { text: normalized });
    },
  };
}
