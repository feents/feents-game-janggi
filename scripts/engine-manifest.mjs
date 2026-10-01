import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const files = {};
for (const name of ['stockfish.js', 'stockfish.wasm', 'ffish.js', 'ffish.wasm']) {
  const data = await readFile(new URL(`public/engine/${name}`, root));
  files[name] = { bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
}
const manifest = {
  source: 'https://github.com/fairy-stockfish/fairy-stockfish.wasm',
  commit: '4d4b39395955df4695f28887800f0836f9c4d37d',
  emscripten: '3.1.74', evaluation: 'classical (Use NNUE=false)',
  patch: 'engine/feents-rules.patch', glue: 'scripts/patch-engine-glue.mjs',
  ai: { threads: 1, hashMiB: 16, simd: true, sharedMemory: true }, files,
};
await writeFile(new URL('engine/manifest.json', root), `${JSON.stringify(manifest,null,2)}\n`);
