#!/bin/bash
set -e

# ── Home Assistant Options 읽기 ──────────────────────
# bashio가 있으면 사용, 없으면 환경변수 fallback
if command -v bashio &> /dev/null; then
    ANTHROPIC_API_KEY=$(bashio::config 'anthropic_api_key')
    PORT=$(bashio::config 'port')
    DAILY_REVIEW_LIMIT=$(bashio::config 'daily_review_limit')
fi

# 환경변수 기본값 처리
PORT="${PORT:-8000}"
DAILY_REVIEW_LIMIT="${DAILY_REVIEW_LIMIT:-50}"

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "[FATAL] anthropic_api_key가 설정되지 않았습니다. 애드온 설정에서 API 키를 입력하세요."
    exit 1
fi

# ── 데이터 디렉터리 런타임 생성 ──────────────────────
mkdir -p /data/envo/uploads

# ── 환경 변수 export ──────────────────────────────────
export ANTHROPIC_API_KEY
export DATABASE_URL="sqlite:////data/envo/envo.db"
export UPLOAD_DIR="/data/envo/uploads"
export DAILY_REVIEW_LIMIT
export FRONTEND_DIST="/app/dist_frontend"

echo "[INFO] 데이터 경로: /data/envo"
echo "[INFO] Envo 서버 시작 중 (포트 ${PORT})..."

# ── 서버 실행 ─────────────────────────────────────────
cd /app
exec python -m uvicorn main:app \
    --host 0.0.0.0 \
    --port "${PORT}" \
    --workers 2 \
    --log-level info
