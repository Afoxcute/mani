#!/bin/bash
set -euo pipefail

APP_DIR=/home/ubuntu/bottie
CONFIG_DIR=$APP_DIR/config
WEB_ENV=$CONFIG_DIR/.env.web
MCP_ENV=$CONFIG_DIR/.env.mcp
LOG_FILE=$CONFIG_DIR/deploy.log
STATUS_FILE=$CONFIG_DIR/deploy.status

mkdir -p "$CONFIG_DIR"
: > "$LOG_FILE"
rm -f "$STATUS_FILE"

log() {
  echo "$*" | tee -a "$LOG_FILE"
}

fail() {
  log "ERROR: $*"
  echo "failed" > "$STATUS_FILE"
  exit 1
}

trap 'fail "Deployment script crashed at line $LINENO"' ERR

log "Deployment started at $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

[ -f "$WEB_ENV" ] || fail "Missing web env file: $WEB_ENV"
[ -f "$MCP_ENV" ] || fail "Missing MCP env file: $MCP_ENV"

log "Creating Docker network if missing..."
sudo docker network create mani-net >/dev/null 2>&1 || true

log "Stopping old containers..."
stop_port_containers() {
  local port="$1"
  local ids
  ids=$(sudo docker ps --filter "publish=$port" --format '{{.ID}}')
  if [ -n "$ids" ]; then
    log "Stopping containers publishing port $port: $ids"
    sudo docker stop $ids || true
    sudo docker rm $ids || true
  fi
}

stop_named_container() {
  local name="$1"
  if sudo docker ps -a --format '{{.Names}}' | grep -q "^${name}$"; then
    sudo docker stop "$name" || true
    sudo docker rm "$name" || true
  fi
}

stop_port_containers 3000
stop_port_containers 3001
stop_named_container mani-web
stop_named_container mani-mcp

log "Starting MCP server..."
sudo docker run -d \
  --name mani-mcp \
  --restart unless-stopped \
  --network mani-net \
  -p 3001:3001 \
  --env-file "$MCP_ENV" \
  mani-mcp:latest

log "Starting web app..."
sudo docker run -d \
  --name mani-web \
  --restart unless-stopped \
  --network mani-net \
  -p 3000:3000 \
  --env-file "$WEB_ENV" \
  mani-web:latest

log "Verifying deployment..."
sleep 10

if ! sudo docker ps --format '{{.Names}}' | grep -q '^mani-mcp$'; then
  sudo docker logs mani-mcp || true
  fail "mani-mcp container failed to start"
fi

if ! sudo docker ps --format '{{.Names}}' | grep -q '^mani-web$'; then
  sudo docker logs mani-web || true
  fail "mani-web container failed to start"
fi

log "OK: both containers are running"
log "MCP logs:"
sudo docker logs --tail 30 mani-mcp | tee -a "$LOG_FILE"
log "Web logs:"
sudo docker logs --tail 30 mani-web | tee -a "$LOG_FILE"
log "Deployment completed at $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "success" > "$STATUS_FILE"
