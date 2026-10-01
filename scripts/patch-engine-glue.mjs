import { readFile, writeFile } from 'node:fs/promises';
const path = process.argv[2];
if (!path) throw new Error('사용법: node scripts/patch-engine-glue.mjs <stockfish.js>');
let source = await readFile(path, 'utf8');
// upstream 2.x wrapper를 Emscripten 3.1.74의 같은 파일 pthread 런타임에 연결한다.
const replacements = [
  ["  if (typeof __filename != 'undefined') _scriptName = _scriptName || __filename;", "  if (typeof __filename != 'undefined') _scriptName = _scriptName || __filename;\n  if (!_scriptName && typeof self !== 'undefined') _scriptName = new URL('stockfish.js', self.location.href).href;"],
  ['var cmd = msgData.cmd;', 'var cmd = msgData.cmd;\n      if (cmd === "custom") { Module["onCustomMessage"](msgData.userData); return; }'],
  ['Module["terminate"] = () => {', 'if (ENVIRONMENT_IS_PTHREAD) Module["print"].proxy = Module["printErr"].proxy = true;\n\nModule["terminate"] = () => {'],
  ['var out = defaultPrint;', 'var out = Module["print"] || defaultPrint;'],
  ['var err = defaultPrintErr;', 'var err = Module["printErr"] || defaultPrintErr;'],
];
for (const [before, after] of replacements) {
  if (source.includes(after) || source.split(before).length !== 2) throw new Error(`엔진 glue 형식 또는 중복 패치 확인 필요: ${before}`);
  source = source.replace(before, after);
}
await writeFile(path, source);
