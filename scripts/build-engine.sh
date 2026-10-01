#!/usr/bin/env bash
set -euo pipefail
# 실행 전에 Emscripten 3.1.74의 emsdk_env.sh를 로드한다.
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
engine_commit=4d4b39395955df4695f28887800f0836f9c4d37d
if ! emcc --version | head -n 1 | grep -q '3.1.74'; then
  echo 'Emscripten 3.1.74 환경을 먼저 활성화해주세요.' >&2
  exit 1
fi
build_dir="$(mktemp -d "${TMPDIR:-/tmp}/feents-engine-build.XXXXXX")"
trap 'rm -rf "$build_dir"' EXIT
curl -fL --retry 2 "https://codeload.github.com/fairy-stockfish/fairy-stockfish.wasm/tar.gz/$engine_commit" -o "$build_dir/source.tar.gz"
mkdir "$build_dir/source"
tar -xzf "$build_dir/source.tar.gz" --strip-components=1 -C "$build_dir/source"
cd "$build_dir/source"
patch -p1 < "$repo_root/engine/feents-rules.patch"
make -j"${JANGGI_BUILD_JOBS:-4}" -C src build ARCH=wasm KERNEL=Linux clangmajorversion=19 \
  largeboards=yes all=no nnue=no embedded_nnue=no minify_js=no \
  EM_CXXFLAGS='-pthread -DNNUE_EMBEDDING_OFF -DUSE_WASM_SIMD -msimd128' \
  EM_COMMIT=feents1 EM_UPSTREAM=4d4b393 EM_EMSCRIPTEN=3.1.74
make -C src -f Makefile_js build es6=yes all=no EXE="$build_dir/ffish.js"
cp src/stockfish.js src/stockfish.wasm "$build_dir/"
node "$repo_root/scripts/patch-engine-glue.mjs" "$build_dir/stockfish.js"
# 두 빌드와 glue 패치가 모두 성공했을 때만 배포 자산을 교체한다.
cp "$build_dir/stockfish.js" "$build_dir/stockfish.wasm" "$build_dir/ffish.js" "$build_dir/ffish.wasm" "$repo_root/public/engine/"
cd "$repo_root"
node scripts/engine-manifest.mjs
