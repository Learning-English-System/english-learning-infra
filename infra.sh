#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
COMPOSE_FILE="$DIR/compose.dev.yml"

case "$1" in
  start)
    echo "Starting local infrastructure..."
    docker compose -f "$COMPOSE_FILE" up -d
    ;;
  stop)
    echo "Stopping local infrastructure..."
    docker compose -f "$COMPOSE_FILE" stop
    ;;
  down)
    echo "Tearing down local infrastructure..."
    docker compose -f "$COMPOSE_FILE" down
    ;;
  reset)
    echo "Resetting local infrastructure (removing all volumes)..."
    docker compose -f "$COMPOSE_FILE" down -v --remove-orphans
    echo "Starting fresh local infrastructure..."
    docker compose -f "$COMPOSE_FILE" up -d
    ;;
  status)
    docker compose -f "$COMPOSE_FILE" ps
    ;;
  logs)
    docker compose -f "$COMPOSE_FILE" logs -f
    ;;
  *)
    echo "Usage: $0 {start|stop|down|reset|status|logs}"
    exit 1
    ;;
esac
