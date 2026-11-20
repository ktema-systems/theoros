#!/usr/bin/env sh
#
# Publishing the site by hand.
#
# A push to main publishes through ci, so this is for the times a run cannot be waited on. It makes the same upload from
# this machine and refuses the two states that publish something other than a commit: a tree with uncommitted changes,
# whose build is stamped with a hash it does not contain, and a dist made from another commit, which is the one way an
# upload goes wrong that nobody sees until the board reads a version no deployment has.

set -eu

cd "$(dirname "$0")"

PROJECT=${THEOROS_PAGES_PROJECT:-theoros}
BRANCH=main
DRY=0

usage() {
  cat <<'TEXT'
Usage: ./deploy.sh [--project NAME] [--branch NAME] [--dry-run]

  --project NAME  the Pages project to publish, or THEOROS_PAGES_PROJECT (default theoros)
  --branch NAME   the deployment branch (default main, which is Production; another name lands as a preview)
  --dry-run       build and read the stamp back, without uploading
TEXT
}

while [ $# -gt 0 ]; do
  case "$1" in
    --project)
      [ $# -ge 2 ] || { printf 'deploy.sh: --project needs a name\n' >&2; exit 2; }
      PROJECT=$2
      shift 2
      ;;
    --branch)
      [ $# -ge 2 ] || { printf 'deploy.sh: --branch needs a name\n' >&2; exit 2; }
      BRANCH=$2
      shift 2
      ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'deploy.sh: unknown option %s\n' "$1" >&2; exit 2 ;;
  esac
done

# The board shows the commit it was built from, so the tree has to be the commit the stamp will name.
clean() {
  changed=$(git status --porcelain)
  [ -z "$changed" ] && return 0
  printf 'deploy.sh: the tree has changes, so anything built here describes no commit\n' >&2
  printf '%s\n' "$changed" >&2
  printf 'deploy.sh: commit or stash them, then publish that commit\n' >&2
  exit 1
}

frame() {
  printf 'theoros: taking the frame\n' >&2
  npm run --silent frame >&2 || {
    printf 'the frame could not be fetched: skene is read from the network on every publish\n' >&2
    exit 1
  }
}

packages() {
  if [ ! -d node_modules ] ||
    [ package-lock.json -nt node_modules/.package-lock.json ] ||
    [ .skene-frame -nt node_modules/.package-lock.json ]; then
    printf 'theoros: installing packages\n' >&2
    npm ci
  fi
}

build() {
  printf 'theoros: building\n' >&2
  npm run --silent build >&2
}

# The build is made here rather than trusted from the tree, and then asked what commit it is: a dist left over from
# another commit is the whole of what this script is for.
stamped() {
  want="v$(git log -1 --format=%cd --date=format:%y%m%d)+$(git log -1 --format=%h)"
  found=$(grep -lF "$want" dist/assets/*.js 2>/dev/null | head -n 1)
  [ -n "$found" ] || {
    printf 'deploy.sh: the build does not say %s, so it was not made from this commit\n' "$want" >&2
    exit 1
  }
  printf 'theoros: %s in %s\n' "$want" "$found" >&2
}

publish() {
  if [ "$DRY" = 1 ]; then
    printf 'theoros: would publish dist to %s on %s\n' "$PROJECT" "$BRANCH" >&2
    return 0
  fi
  printf 'theoros: publishing to %s on %s\n' "$PROJECT" "$BRANCH" >&2
  npx --yes wrangler@4 pages deploy dist --project-name "$PROJECT" --branch "$BRANCH"
}

clean
frame
packages
build
stamped
publish
