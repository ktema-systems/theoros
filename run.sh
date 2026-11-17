#!/usr/bin/env sh
#
# One command for the whole app.
#
# The frame is a submodule, the projects are generated from capture/, and the dev server's cache outlives the packages it
# was made from. A run does all three and then takes the port over: an old run answering there is stopped, because the app
# on the port is the one this tree builds and not the one before it.

set -eu

cd "$(dirname "$0")"

PORT=${THEOROS_PORT:-5274}
PREVIEW_PORT=${THEOROS_PREVIEW_PORT:-5277}
MODE=dev
CAPTURE=0
HOST=0

usage() {
  cat <<'TEXT'
Usage: ./run.sh [--dev | --check | --build | --preview | --capture | --stop] [--port N] [--host]

  --dev       the app at http://localhost:5274/ (default)
  --check     typecheck, the tests and a production build
  --build     a production build
  --preview   a production build, served at http://localhost:5277/
  --capture   read the systems and their units from ESI before the mode runs
  --stop      stop whatever holds the port
  --port N    the port the app is served on, or THEOROS_PORT
  --host      reachable from the network rather than from this machine
TEXT
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dev) MODE=dev; shift ;;
    --check) MODE=check; shift ;;
    --build) MODE=build; shift ;;
    --preview) MODE=preview; shift ;;
    --capture) CAPTURE=1; shift ;;
    --stop) MODE=stop; shift ;;
    --host) HOST=1; shift ;;
    --port)
      [ $# -ge 2 ] || { printf 'run.sh: --port needs a number\n' >&2; exit 2; }
      PORT=$2
      shift 2
      ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'run.sh: unknown option %s\n' "$1" >&2; exit 2 ;;
  esac
done

holders() { lsof -nP -ti :"$1" 2>/dev/null || true; }

stop() {
  pids=$(holders "$1")
  [ -n "$pids" ] || return 0
  printf 'theoros: stopping %s\n' "$(printf '%s' "$pids" | tr '\n' ' ')" >&2
  kill $pids 2>/dev/null || true
  waited=0
  while [ -n "$(holders "$1")" ] && [ "$waited" -lt 20 ]; do
    sleep 0.5
    waited=$((waited + 1))
  done
  [ -z "$(holders "$1")" ] || { printf 'run.sh: port %s is still held\n' "$1" >&2; exit 1; }
}

submodule() {
  if git submodule status --recursive 2>/dev/null | grep -qE '^[-+]'; then
    printf 'theoros: taking the frame submodule\n' >&2
    git submodule update --init --recursive
  fi
}

packages() {
  if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
    printf 'theoros: installing packages\n' >&2
    npm ci
  fi
}

capture() {
  printf 'theoros: reading the systems and their units from ESI\n' >&2
  npm run capture
}

submodule
packages

if [ "$CAPTURE" = 1 ]; then capture; fi

case "$MODE" in
  stop)
    stop "$PORT"
    ;;
  dev)
    stop "$PORT"
    rm -rf node_modules/.vite node_modules/.vite-temp
    if [ "$HOST" = 1 ]; then
      printf 'theoros: http://localhost:%s/\n' "$PORT" >&2
      exec npm run dev -- --port "$PORT" --strictPort --host
    fi
    printf 'theoros: http://localhost:%s/\n' "$PORT" >&2
    exec npm run dev -- --port "$PORT" --strictPort
    ;;
  check)
    npm run typecheck
    npm test
    npm run build
    ;;
  build)
    npm run build
    ;;
  preview)
    npm run build
    stop "$PREVIEW_PORT"
    printf 'theoros: http://localhost:%s/\n' "$PREVIEW_PORT" >&2
    exec npm run preview -- --port "$PREVIEW_PORT" --strictPort
    ;;
esac
