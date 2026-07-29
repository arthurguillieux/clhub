#!/usr/bin/env bash
# Run on the NAS, from /volume1/docker/clhub/ — see docs/04-exploitation.md §6.
# Pulls the latest published image and restarts the stack. Never builds
# anything here: a `next build` needs more RAM than this NAS can spare.
set -euo pipefail
cd "$(dirname "$0")"
docker compose pull
docker compose up -d --remove-orphans
docker image prune -f
