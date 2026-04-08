#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="pm-mvp"
CONTAINER_NAME="pm-mvp-app"
PORT="8000"
ENV_FILE=".env"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but was not found."
  exit 1
fi

echo "Building Docker image: ${IMAGE_NAME}"
docker build -t "${IMAGE_NAME}" .

echo "Removing existing container if present: ${CONTAINER_NAME}"
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

echo "Starting container on http://localhost:${PORT}"
if [[ -f "${ENV_FILE}" ]]; then
  docker run -d --name "${CONTAINER_NAME}" --env-file "${ENV_FILE}" -p "${PORT}:8000" "${IMAGE_NAME}"
else
  docker run -d --name "${CONTAINER_NAME}" -p "${PORT}:8000" "${IMAGE_NAME}"
fi

echo "Done. Open http://localhost:${PORT}"
