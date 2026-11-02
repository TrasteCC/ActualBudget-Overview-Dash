#!/usr/bin/env bash
# Works out what a push releases and prints the step outputs for docker.yml.
#   - Tag vX.Y.Z or vX.Y.Z-rN (pushed by hand): that release.
#   - Push to main whose @actual-app/api has no vX.Y.Z tag yet (a merged Actual API update): release
#     vX.Y.Z, and create=true so the workflow tags the commit once the image is published.
#   - Anything else: no release; main only gets the :main image tag.
# X.Y moves only if this is the newest version of that line, latest only if it is the newest of all.
set -euo pipefail

api=$(node -p "require('./package.json').dependencies['@actual-app/api']")

case "$GITHUB_REF" in
  refs/tags/*)
    tag=${GITHUB_REF#refs/tags/}
    create=false
    ;;
  refs/heads/main)
    tag="v$api"
    if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then exit 0; fi
    create=true
    ;;
  *) exit 0 ;;
esac

if [[ ! $tag =~ ^v(([0-9]+)\.([0-9]+)\.[0-9]+)(-r[0-9]+)?$ ]]; then
  echo "::error::$tag is not vX.Y.Z (an Actual release) or vX.Y.Z-rN (a dashboard fix on it)"
  exit 1
fi
base=${BASH_REMATCH[1]}
line="${BASH_REMATCH[2]}.${BASH_REMATCH[3]}"
if [ "$base" != "$api" ]; then
  echo "::error::$tag doesn't match the bundled @actual-app/api $api"
  exit 1
fi

# Actual versions already released, plus this one.
versions=$({ git tag -l 'v*'; echo "$tag"; } | sed -nE 's/^v([0-9]+\.[0-9]+\.[0-9]+)(-r[0-9]+)?$/\1/p' | sort -uV)
newest=$(tail -n1 <<<"$versions")
newest_in_line=$(grep -E "^${line//./\\.}\.[0-9]+$" <<<"$versions" | tail -n1)

echo "tag=$tag"
echo "version=${tag#v}"
echo "create=$create"
[ "$base" = "$newest_in_line" ] && echo "line=$line"
[ "$base" = "$newest" ] && echo "latest=true"
exit 0
