// Bundles src/ (and three.js) into one self-contained index.html that runs
// from a double-click — no server, no assets, no network.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const result = await build({
  entryPoints: [join(root, 'src/main.js')],
  bundle: true,
  format: 'iife',
  minify: !process.argv.includes('--dev'),
  target: 'es2020',
  write: false,
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = readFileSync(join(root, 'src/index.template.html'), 'utf8');
const html = tpl.replace('/*__BUNDLE__*/', () => js);
writeFileSync(join(root, 'index.html'), html);
console.log(`index.html written — ${(html.length / 1024).toFixed(0)} KB`);
