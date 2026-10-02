import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = new URL('../', import.meta.url);
const verifyOnly = process.argv[2] === '--verify-nnue';
const directory = verifyOnly && process.argv[3]
  ? pathToFileURL(`${resolve(process.argv[3])}/`) : new URL('public/engine/', root);
const nnue = JSON.parse(await readFile(new URL('nnue.json', directory), 'utf8'));
if (!/^janggi-[a-f0-9]{12}\.nnue$/.test(nnue.file)
    || !Number.isSafeInteger(nnue.bytes) || nnue.bytes <= 0 || !/^[a-f0-9]{64}$/.test(nnue.sha256)) {
  throw new Error('장기 NNUE 모델 정보가 올바르지 않아요.');
}
const model = await readFile(new URL(nnue.file, directory));
if (model.length !== nnue.bytes || createHash('sha256').update(model).digest('hex') !== nnue.sha256) {
  throw new Error('장기 NNUE 모델 크기 또는 SHA-256이 일치하지 않아요.');
}
if (!verifyOnly) {
  const files = {};
  for (const name of ['stockfish.js', 'stockfish.wasm', 'ffish.js', 'ffish.wasm', 'nnue.json', nnue.file]) {
    const data = await readFile(new URL(name, directory));
    files[name] = { bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
  }
  const manifest = {
    source: 'https://github.com/fairy-stockfish/fairy-stockfish.wasm',
    commit: '4d4b39395955df4695f28887800f0836f9c4d37d',
    emscripten: '3.1.74', evaluation: 'NNUE (Use NNUE=true, all difficulty levels)', nnue,
    patch: 'engine/feents-rules.patch', glue: 'scripts/patch-engine-glue.mjs',
    ai: { threads: 1, hashMiB: 16, simd: true, sharedMemory: true }, files,
  };
  await writeFile(new URL('engine/manifest.json', root), `${JSON.stringify(manifest,null,2)}\n`);
}
