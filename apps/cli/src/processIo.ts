import process from 'node:process';

import type { ProcessIO } from './types.js';

type NodeLikeProcess = Pick<NodeJS.Process, 'stdout' | 'stderr' | 'exitCode'>;

export function createNodeProcessIO(proc: NodeLikeProcess = process): ProcessIO {
  return {
    writeStdout(message: string) {
      proc.stdout.write(message);
    },
    writeStderr(message: string) {
      proc.stderr.write(message);
    },
    setExitCode(code: number) {
      proc.exitCode = code;
    },
  };
}
