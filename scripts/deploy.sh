#!/usr/bin/env bash
set -euo pipefail

fail() { echo "::error::$1" >&2; exit 1; }

for name in SERVER_HOST SERVER_USER SSH_PRIVATE_KEY DEPLOY_PATH; do
  [[ -n "${!name:-}" ]] || fail "Required secret is missing: ${name}"
done

[[ "$DEPLOY_PATH" =~ ^(/[A-Za-z0-9_-][A-Za-z0-9_.-]*)+/?$ && "$DEPLOY_PATH" != *'..'* ]] \
  || fail 'DEPLOY_PATH must be an absolute path to the dedicated web root.'
deploy_target="${DEPLOY_PATH%/}"
case "$deploy_target" in
  /bin|/boot|/dev|/etc|/home|/lib|/lib64|/media|/mnt|/opt|/proc|/root|/run|/sbin|/srv|/sys|/tmp|/usr|/var)
    fail 'DEPLOY_PATH must not be a system directory.' ;;
esac
[[ "$SERVER_HOST" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*$ || "$SERVER_HOST" =~ ^[0-9A-Fa-f:]+$ ]] \
  || fail 'SERVER_HOST must be a hostname or IP address.'
[[ "$SERVER_USER" =~ ^[A-Za-z_][A-Za-z0-9_.-]*$ ]] \
  || fail 'SERVER_USER must be a valid SSH username.'
deploy_port="${SERVER_PORT:-22}"
[[ "$deploy_port" =~ ^[0-9]{1,5}$ ]] || fail 'SERVER_PORT must be an integer from 1 to 65535.'
(( 10#$deploy_port >= 1 && 10#$deploy_port <= 65535 )) \
  || fail 'SERVER_PORT must be an integer from 1 to 65535.'

# 빈 빌드나 불완전한 빌드로 원격 웹 루트를 정리하지 않는다.
for file in index.html engine/stockfish.wasm engine/ffish.wasm og_image.png; do
  [[ -s "dist/$file" ]] || fail 'The deployment build is missing a required file.'
done
compgen -G 'dist/assets/*.js' >/dev/null && compgen -G 'dist/assets/*.css' >/dev/null \
  || fail 'The deployment build is missing its JavaScript or CSS bundles.'
build_symlinks="$(find dist -type l -print -quit)"
[[ -z "$build_symlinks" ]] || fail 'The deployment build must not contain symbolic links.'

umask 077
ssh_dir="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/janggi-deploy.XXXXXX")"
trap 'rm -rf -- "$ssh_dir"' EXIT
printf '%s\n' "$SSH_PRIVATE_KEY" | tr -d '\r' > "$ssh_dir/key"
unset SSH_PRIVATE_KEY
ssh-keygen -y -P '' -f "$ssh_dir/key" >/dev/null 2>&1 \
  || fail 'SSH_PRIVATE_KEY must be a valid key that does not require a passphrase.'

# fingerprint Secret 없이 첫 연결의 키를 받아, 같은 배포 실행 내에서 재사용한다.
cat > "$ssh_dir/config" <<EOF
Host janggi-deploy
  HostName $SERVER_HOST
  User $SERVER_USER
  Port $deploy_port
  IdentityFile "$ssh_dir/key"
  IdentitiesOnly yes
  BatchMode yes
  PasswordAuthentication no
  StrictHostKeyChecking accept-new
  UserKnownHostsFile "$ssh_dir/known_hosts"
  ConnectTimeout 30
  ServerAliveInterval 15
  ServerAliveCountMax 3
  LogLevel ERROR
EOF

# 기존 배포 디렉터리와 서버의 rsync를 확인한 뒤에만 전송·삭제한다.
if ! ssh -F "$ssh_dir/config" janggi-deploy "sh -s -- '$deploy_target'" <<'REMOTE'
set -eu
command -v rsync >/dev/null
test -d "$1" && test -w "$1"
resolved="$(cd "$1" && pwd -P)"
case "$resolved" in
  /|/bin|/boot|/dev|/etc|/home|/lib|/lib64|/media|/mnt|/opt|/proc|/root|/run|/sbin|/srv|/sys|/tmp|/usr|/var) exit 1 ;;
esac
REMOTE
then
  fail 'The server needs rsync and an existing writable dedicated deployment directory.'
fi

export RSYNC_RSH="ssh -F \"$ssh_dir/config\""
rsync --archive --compress --no-owner --no-group --omit-dir-times \
  --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r --delete --delete-delay --delay-updates --timeout=120 \
  dist/ "janggi-deploy:$deploy_target/"
echo 'Deployment sync completed.'
