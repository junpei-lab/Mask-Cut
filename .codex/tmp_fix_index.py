from pathlib import Path
import sys

path = Path(r"apps/cli/src/index.ts")
text = path.read_text(encoding='utf-8')
old = 'void main();\n'
new = """main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  process.stderr.write(`Fatal error: ${message}\\n`);
  if (stack) {
    process.stderr.write(`${stack}\\n`);
  }

  if (typeof process.exitCode !== 'number' || process.exitCode === 0) {
    process.exitCode = 1;
  }
});
"""
if old not in text:
    sys.exit('pattern not found')
path.write_text(text.replace(old, new), encoding='utf-8')
