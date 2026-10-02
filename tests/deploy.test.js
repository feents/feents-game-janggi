import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../scripts/deploy.sh', import.meta.url));
const realRsync = execFileSync('which', ['rsync'], { encoding: 'utf8' }).trim();
const realSsh = execFileSync('which', ['ssh'], { encoding: 'utf8' }).trim();
const nnue = JSON.parse(readFileSync(new URL('../public/engine/nnue.json', import.meta.url), 'utf8'));

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'feents-deploy-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const folder of ['bin', 'dist/assets', 'dist/engine', 'target/assets', 'runner temp']) mkdirSync(join(root, folder), { recursive: true });
  for (const file of ['index.html', 'engine/stockfish.wasm', 'engine/ffish.wasm', 'og_image.png', 'assets/new.js', 'assets/new.css', '.public-marker']) {
    writeFileSync(join(root, 'dist', file), `new build: ${file}`);
  }
  for (const file of ['nnue.json', nnue.file]) {
    copyFileSync(new URL(`../public/engine/${file}`, import.meta.url), join(root, 'dist/engine', file));
  }
  writeFileSync(join(root, 'target/index.html'), 'previous page');
  writeFileSync(join(root, 'target/logo-mark.svg'), 'previous public logo');
  writeFileSync(join(root, 'target/assets/old.js'), 'previous hashed bundle');
  writeFileSync(join(root, 'outside.txt'), 'outside the deployment directory');
  execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', join(root, 'identity')]);

  // SSH는 실제 서버에 연결하지 않고 사전 확인 명령만 임시 디렉터리에서 실행한다.
  writeFileSync(join(root, 'bin/ssh'), `#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const args = process.argv.slice(2);
assert.equal(args[0], '-F');
assert.equal(args[2], 'janggi-deploy');
const config = fs.readFileSync(args[1], 'utf8');
const key = config.match(/IdentityFile "([^"]+)"/)[1];
assert.equal(fs.statSync(key).mode & 0o777, 0o600);
assert.equal(fs.statSync(args[1]).mode & 0o777, 0o600);
assert.equal(process.env.SSH_PRIVATE_KEY, undefined);
assert.match(config, /StrictHostKeyChecking accept-new/);
const parsed = execFileSync(process.env.TEST_REAL_SSH, ['-G', '-F', args[1], args[2]], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
assert.match(parsed, /^user deploy$/m);
assert.match(parsed, /^port 22$/m);
fs.writeFileSync(process.env.TEST_SSH_RECORD, config);
if (process.env.TEST_SSH_FAIL) process.exit(1);
execFileSync('/bin/sh', ['-c', args[3]], { stdio: 'inherit' });
`, { mode: 0o755 });

  // 같은 rsync 옵션으로 임시 로컬 디렉터리를 실제 동기화한다.
  writeFileSync(join(root, 'bin/rsync'), `#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
fs.writeFileSync(process.env.TEST_RSYNC_RECORD, JSON.stringify({ args, rsh: process.env.RSYNC_RSH }));
assert.equal(process.env.SSH_PRIVATE_KEY, undefined);
assert.match(process.env.RSYNC_RSH, /^ssh -F "/);
if (process.env.TEST_RSYNC_FAIL) process.exit(23);
const remote = args.pop();
assert.ok(remote.startsWith('janggi-deploy:'));
args.push(remote.slice('janggi-deploy:'.length));
const result = spawnSync(process.env.TEST_REAL_RSYNC, args, { stdio: 'inherit', env: { ...process.env, PATH: process.env.TEST_ORIGINAL_PATH } });
process.exit(result.status ?? 1);
`, { mode: 0o755 });

  const env = {
    ...process.env,
    PATH: `${join(root, 'bin')}:${process.env.PATH}`,
    SERVER_HOST: 'deploy.example.test', SERVER_USER: 'deploy', SERVER_PORT: '22',
    // Windows 줄바꿈으로 등록한 Secret도 읽을 수 있는지 확인한다.
    SSH_PRIVATE_KEY: readFileSync(join(root, 'identity'), 'utf8').replaceAll('\n', '\r\n'),
    DEPLOY_PATH: `${join(root, 'target')}/`, RUNNER_TEMP: join(root, 'runner temp'),
    TEST_SSH_RECORD: join(root, 'ssh-record'), TEST_RSYNC_RECORD: join(root, 'rsync-record'),
    TEST_REAL_RSYNC: realRsync, TEST_REAL_SSH: realSsh, TEST_ORIGINAL_PATH: process.env.PATH,
    TEST_SSH_FAIL: '', TEST_RSYNC_FAIL: '',
  };
  const run = (overrides = {}) => spawnSync('bash', [script], { cwd: root, env: { ...env, ...overrides }, encoding: 'utf8' });
  return { root, env, run };
}

function unchanged(root) {
  assert.equal(readFileSync(join(root, 'target/index.html'), 'utf8'), 'previous page');
  assert.ok(existsSync(join(root, 'target/logo-mark.svg')));
  assert.ok(existsSync(join(root, 'target/assets/old.js')));
  assert.equal(readFileSync(join(root, 'outside.txt'), 'utf8'), 'outside the deployment directory');
  assert.deepEqual(readdirSync(join(root, 'runner temp')), []);
}

test('배포는 새 파일·숨김 파일을 반영하고 삭제한 파일·이전 번들을 대상 안에서만 정리한다', t => {
  const { root, run } = fixture(t);
  const result = run({ SERVER_HOST: '2001:db8::1', SERVER_PORT: '022' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(root, 'target/index.html'), 'utf8'), 'new build: index.html');
  for (const file of ['assets/new.js', 'assets/new.css', 'engine/stockfish.wasm', 'engine/ffish.wasm', 'og_image.png', '.public-marker']) {
    assert.equal(readFileSync(join(root, 'target', file), 'utf8'), `new build: ${file}`);
  }
  assert.deepEqual(readFileSync(join(root, 'target/engine', nnue.file)), readFileSync(join(root, 'dist/engine', nnue.file)));
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'target/engine/nnue.json'), 'utf8')), nnue);
  assert.ok(!existsSync(join(root, 'target/logo-mark.svg')));
  assert.ok(!existsSync(join(root, 'target/assets/old.js')));
  assert.equal(readFileSync(join(root, 'outside.txt'), 'utf8'), 'outside the deployment directory');
  const { args } = JSON.parse(readFileSync(join(root, 'rsync-record'), 'utf8'));
  assert.ok(args.includes('--delete') && args.includes('--delete-delay') && args.includes('--delay-updates'));
  assert.equal(args.at(-2), 'dist/');
  assert.deepEqual(readdirSync(join(root, 'runner temp')), []);
});

test('시스템 루트·상위 경로·셸 문자가 있는 배포 경로는 SSH 전에 거부한다', t => {
  const { root, run } = fixture(t);
  for (const path of ['', '/', '/var/', '/etc', '/home', '/srv/site/../other', '/srv/site;echo unsafe', '/srv/site\nother', 'relative']) {
    assert.notEqual(run({ DEPLOY_PATH: path }).status, 0);
    assert.ok(!existsSync(join(root, 'ssh-record')));
    unchanged(root);
  }
});

test('누락되거나 비어 있는 빌드 파일은 원격 파일 삭제 전에 거부한다', t => {
  const { root, run } = fixture(t);
  const index = join(root, 'dist/index.html');
  unlinkSync(index);
  assert.notEqual(run().status, 0);
  writeFileSync(index, '');
  assert.notEqual(run().status, 0);
  writeFileSync(index, 'new page');
  unlinkSync(join(root, 'dist/assets/new.js'));
  assert.notEqual(run().status, 0);
  writeFileSync(join(root, 'dist/assets/new.js'), 'new bundle');
  unlinkSync(join(root, 'dist/engine', nnue.file));
  assert.notEqual(run().status, 0);
  assert.ok(!existsSync(join(root, 'ssh-record')));
  unchanged(root);
});

test('손상된 NNUE 모델은 운영 파일을 정리하거나 SSH에 연결하기 전에 거부한다', t => {
  const { root, run } = fixture(t);
  const model = readFileSync(join(root, 'dist/engine', nnue.file));
  model[model.length - 1] ^= 1;
  writeFileSync(join(root, 'dist/engine', nnue.file), model);
  assert.notEqual(run().status, 0);
  assert.ok(!existsSync(join(root, 'ssh-record')));
  unchanged(root);
});

test('잘못된 SSH 설정과 키는 값 노출 없이 거부하고 임시 키를 정리한다', t => {
  const { root, run } = fixture(t);
  for (const override of [
    { SERVER_HOST: 'host\nProxyCommand unsafe' }, { SERVER_USER: 'user;unsafe' },
    { SERVER_PORT: '0' }, { SERVER_PORT: '65536' }, { SERVER_PORT: '-1' },
    { SERVER_PORT: '22;unsafe' }, { SERVER_HOST: '' }, { SSH_PRIVATE_KEY: 'invalid-private-value' },
  ]) {
    const result = run(override);
    assert.notEqual(result.status, 0);
    for (const value of Object.values(override).filter(Boolean)) assert.ok(!`${result.stdout}${result.stderr}`.includes(value));
    assert.ok(!existsSync(join(root, 'ssh-record')));
    unchanged(root);
  }
});

test('빌드 내 심볼릭 링크가 있으면 전송·삭제를 하지 않는다', t => {
  const { root, run } = fixture(t);
  symlinkSync(join(root, 'outside.txt'), join(root, 'dist/link'));
  assert.notEqual(run().status, 0);
  assert.ok(!existsSync(join(root, 'ssh-record')));
  unchanged(root);
});

test('SSH 또는 서버 사전 확인 실패 시 rsync를 실행하지 않고 임시 키를 정리한다', t => {
  const { root, run } = fixture(t);
  assert.notEqual(run({ TEST_SSH_FAIL: '1' }).status, 0);
  assert.ok(!existsSync(join(root, 'rsync-record')));
  unchanged(root);
});

test('배포 디렉터리가 시스템 루트로 연결되면 rsync를 실행하지 않는다', t => {
  const { root, run } = fixture(t);
  rmSync(join(root, 'target'), { recursive: true });
  symlinkSync('/', join(root, 'target'));
  // 사전 확인에 회귀가 생겨도 테스트에서 루트에 실제 rsync를 실행하지 않는다.
  assert.equal(run({ TEST_RSYNC_FAIL: '1' }).status, 1);
  assert.ok(!existsSync(join(root, 'rsync-record')));
  assert.equal(readFileSync(join(root, 'outside.txt'), 'utf8'), 'outside the deployment directory');
  assert.deepEqual(readdirSync(join(root, 'runner temp')), []);
});

test('rsync 실패는 배포 실패로 전달되고 임시 키는 남지 않는다', t => {
  const { root, run } = fixture(t);
  assert.equal(run({ TEST_RSYNC_FAIL: '1' }).status, 23);
  unchanged(root);
});
