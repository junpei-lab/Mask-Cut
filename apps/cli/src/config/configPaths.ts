import { homedir } from 'node:os';
import { join } from 'node:path';

export function resolveConfigFilePath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.MASK_CUT_CONFIG_PATH) {
    return env.MASK_CUT_CONFIG_PATH;
  }

  if (process.platform === 'win32') {
    const base = env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
    return join(base, 'MaskCut', 'config.json');
  }

  const base = env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
  return join(base, 'mask-cut', 'config.json');
}
