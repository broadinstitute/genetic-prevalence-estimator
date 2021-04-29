#!/bin/bash

set -euo pipefail


SERVICE=${1:-}

if [ -z "$SERVICE" ]; then
  echo "Usage: dev.sh SERVICE CMD" 1>&2
  exit 1
fi

cd "$(dirname "$0")"

docker compose -f docker-compose.dev.yml run --rm "${SERVICE}-dev" "${@:2}"
