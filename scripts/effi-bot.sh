#!/usr/bin/env bash
# Effi bot-gateway + ngrok lifecycle helper.
# Usage: scripts/effi-bot.sh {start|stop|restart|status|logs|webhook}

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVE_LOG="/tmp/effi-eve.log"
NGROK_LOG="/tmp/effi-ngrok.log"
EVE_PORT=2000
TELEGRAM_BOT_TOKEN="$(grep '^TELEGRAM_BOT_TOKEN=' "$REPO_ROOT/apps/bot-gateway/.env.local" | cut -d= -f2-)"
TELEGRAM_WEBHOOK_SECRET="$(grep '^TELEGRAM_WEBHOOK_SECRET_TOKEN=' "$REPO_ROOT/apps/bot-gateway/.env.local" | cut -d= -f2-)"

log() { printf '[effi-bot] %s\n' "$*"; }

eve_pid() { lsof -tnP -iTCP:"$EVE_PORT" -sTCP:LISTEN 2>/dev/null | head -1; }
ngrok_pid() { pgrep -f "ngrok http $EVE_PORT" | head -1; }

ngrok_url() {
  curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null \
    | python3 -c "import sys,json; ts=json.load(sys.stdin)['tunnels']; print(ts[0]['public_url'] if ts else '')" 2>/dev/null
}

register_webhook() {
  local url
  url="$(ngrok_url)"
  [ -n "$url" ] || { log "no ngrok tunnel URL found; is ngrok running?"; return 1; }
  curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
    -F "url=${url}/eve/v1/telegram" \
    -F "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
    -F 'allowed_updates=["message","callback_query"]'
  echo
}

start() {
  local eve_pid ngrok_pid
  eve_pid="$(eve_pid)" || true
  ngrok_pid="$(ngrok_pid)" || true

  if [ -n "$eve_pid" ]; then
    log "eve already running (pid $eve_pid) on :$EVE_PORT"
  else
    log "starting eve dev server (port $EVE_PORT)"
    cd "$REPO_ROOT/apps/bot-gateway"
    nohup env WHATSAPP_CONNECT=0 pnpm exec eve dev --no-ui --host 0.0.0.0 --port "$EVE_PORT" >"$EVE_LOG" 2>&1 &
  fi

  if [ -n "$ngrok_pid" ]; then
    log "ngrok already running (pid $ngrok_pid)"
  else
    log "starting ngrok for port $EVE_PORT"
    nohup ngrok http "$EVE_PORT" --log=stdout >"$NGROK_LOG" 2>&1 &
  fi

  sleep 2
  status
  echo
  log "eve log:   tail -f $EVE_LOG"
  log "ngrok log: tail -f $NGROK_LOG"
}

stop() {
  local eve_pid ngrok_pid
  eve_pid="$(eve_pid)" || true
  ngrok_pid="$(ngrok_pid)" || true
  if [ -z "$eve_pid" ] && [ -z "$ngrok_pid" ]; then
    log "nothing was running"
    return 0
  fi
  [ -n "$eve_pid" ] && { kill "$eve_pid" && log "stopped eve (pid $eve_pid)"; }
  [ -n "$ngrok_pid" ] && { kill "$ngrok_pid" && log "stopped ngrok (pid $ngrok_pid)"; }
  # Wait for the port to actually release so a subsequent --fresh wipe
  # cannot race the dying server's durable writes.
  local i=0
  while [ -n "$(eve_pid)" ] && [ "$i" -lt 20 ]; do
    sleep 0.5
    i=$((i + 1))
  done
  return 0
}

# Eve dev persists session history durably under .eve/.workflow-data, so a
# plain restart resumes the same conversation. `--fresh` wipes that store so
# every channel session starts clean.
fresh_state() {
  local workflow_dir="$REPO_ROOT/apps/bot-gateway/.eve/.workflow-data"
  if [ -d "$workflow_dir" ]; then
    rm -rf "$workflow_dir"
    log "cleared durable session store (.eve/.workflow-data)"
  else
    log "no durable session store to clear"
  fi
}

status() {
  local eve_pid ngrok_pid url
  eve_pid="$(eve_pid)" || true
  ngrok_pid="$(ngrok_pid)" || true
  url="$(ngrok_url)" || true
  echo "eve:   $([ -n "$eve_pid" ] && echo "running (pid $eve_pid) on :$EVE_PORT" || echo "stopped")"
  echo "ngrok: $([ -n "$ngrok_pid" ] && echo "running (pid $ngrok_pid) at $url" || echo "stopped")"
}

case "${1:-}" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  restart)
    stop
    sleep 1
    if [ "${2:-}" = "--fresh" ]; then
      fresh_state
    fi
    start
    ;;
  status)
    status
    ;;
  logs)
    tail -f "$EVE_LOG"
    ;;
  ngrok-logs)
    tail -f "$NGROK_LOG"
    ;;
  webhook)
    register_webhook
    ;;
  *)
    echo "usage: $0 {start|stop|restart|status|logs|ngrok-logs|webhook}" >&2
    exit 1
    ;;
esac
