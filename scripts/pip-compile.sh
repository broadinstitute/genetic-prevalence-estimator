#!/bin/bash

set -euo pipefail

print_usage() {
  echo "Usage: pip-compile.sh {website,worker}" 1>&2
}

component="$1"

if [ "$component" != "website" ] && [ "$component" != "worker" ]; then
  print_usage
  exit 1
fi

cd "$(dirname "${BASH_SOURCE[0]}")/.."

docker run --rm -ti -v "$(pwd):/mnt" \
  python:3.9-slim \
  /bin/bash -c "cd /mnt; pip install pip-tools; pip-compile $component/$component-requirements.in"
