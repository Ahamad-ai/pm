#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="pm-mvp-app"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but was not found."
  exit 1
fi

if docker container inspect "${CONTAINER_NAME}" >/dev/null 2>&1; then
  echo "Stopping and removing container: ${CONTAINER_NAME}"
  docker rm -f "${CONTAINER_NAME}" >/dev/null
  echo "Stopped."
else
  echo "Container not found: ${CONTAINER_NAME}"
fi
