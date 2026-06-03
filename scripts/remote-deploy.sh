#!/bin/bash
set -euo pipefail

APP_DIR=/home/ubuntu/bottie
REPO_DIR=$APP_DIR/repo
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
[ -d "$REPO_DIR" ] || fail "Missing synced repo directory: $REPO_DIR"

log "Creating Docker network if missing..."
sudo docker network create mani-net >/dev/null 2>&1 || true

log "Current Docker disk usage before cleanup:"
sudo docker system df || true

log "Pruning unused Docker resources to free space..."
sudo docker container prune -f || true
sudo docker image prune -af || true
sudo docker builder prune -af || true
sudo docker volume prune -f || true

log "Docker disk usage after cleanup:"
sudo docker system df || true

log "Loading web env for build-time public variables..."
set -a
. "$WEB_ENV"
set +a

log "Building web image on the server..."
sudo docker build \
  -f "$REPO_DIR/Dockerfile.web" \
  --build-arg NEXT_PUBLIC_REOWN_PROJECT_ID="$NEXT_PUBLIC_REOWN_PROJECT_ID" \
  --build-arg NEXT_PUBLIC_X402_FACILITATOR_URL="$NEXT_PUBLIC_X402_FACILITATOR_URL" \
  --build-arg NEXT_PUBLIC_APP_URL="$NEXT_PUBLIC_APP_URL" \
  --build-arg NEXT_PUBLIC_MCP_URL="$NEXT_PUBLIC_MCP_URL" \
  --build-arg NEXT_PUBLIC_MANTLE_SEPOLIA_CHAIN_ID=5003 \
  --build-arg NEXT_PUBLIC_MANTLE_SEPOLIA_AGENT_DELEGATOR_ADDRESS="$NEXT_PUBLIC_MANTLE_SEPOLIA_AGENT_DELEGATOR_ADDRESS" \
  --build-arg NEXT_PUBLIC_MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS="$NEXT_PUBLIC_MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS" \
  -t mani-web:latest \
  "$REPO_DIR"

log "Building MCP image on the server..."
sudo docker build \
  -f "$REPO_DIR/Dockerfile.mcp" \
  -t mani-mcp:latest \
  "$REPO_DIR"

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
