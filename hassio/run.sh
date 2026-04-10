#!/usr/bin/with-contenv bashio

# ── Home Assistant Options 읽기 ──────────────────────
ANTHROPIC_API_KEY=$(bashio::config 'anthropic_api_key')
PORT=$(bashio::config 'port')
DAILY_REVIEW_LIMIT=$(bashio::config 'daily_review_limit')

if [ -z "$ANTHROPIC_API_KEY" ]; then
    bashio::log.fatal "anthropic_api_key가 설정되지 않았습니다. 애드온 설정에서 API 키를 입력하세요."
    exit 1
fi

PORT="${PORT:-8000}"

# ── 환경 변수 설정 ────────────────────────────────────
export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
export DATABASE_URL="sqlite:////data/envo/envo.db"
export UPLOAD_DIR="/data/envo/uploads"
export DAILY_REVIEW_LIMIT="${DAILY_REVIEW_LIMIT:-50}"
export FRONTEND_DIST="/app/dist_frontend"

bashio::log.info "데이터 경로: /data/envo"
bashio::log.info "Envo 서버 시작 중 (포트 ${PORT})..."

# ── 서버 실행 ─────────────────────────────────────────
cd /app
exec python3 -m uvicorn main:app \
    --host 0.0.0.0 \
    --port "${PORT}" \
    --workers 2 \
    --log-level info
