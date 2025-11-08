const fs = require(''node:fs'');
const path = 'apps/cli/src/index.ts';
const text = fs.readFileSync(path, 'utf8');
const oldSnippet = 'void main();\n';
const newSnippet = `main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  process.stderr.write(`Fatal error: ${message}\n`);
  if (stack) {
    process.stderr.write(`${stack}\n`);
  }

  if (typeof process.exitCode !== 'number' || process.exitCode === 0) {
    process.exitCode = 1;
  }
});
`;
if (!text.includes(oldSnippet)) {
  throw new Error('pattern not found');
}
fs.writeFileSync(path, text.replace(oldSnippet, newSnippet), 'utf8');
