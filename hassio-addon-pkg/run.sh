#!/usr/bin/with-contenv bash
set -e

# ── /data/options.json 에서 설정 읽기 ───────────────────
# HA 애드온은 항상 이 파일에 설정을 저장함
OPTIONS_FILE="/data/options.json"

if [ ! -f "$OPTIONS_FILE" ]; then
    echo "[FATAL] $OPTIONS_FILE 을 찾을 수 없습니다."
    exit 1
fi

read_option() {
    python -c "import json,sys; d=json.load(open('$OPTIONS_FILE')); print(d.get('$1',''))"
}

ANTHROPIC_API_KEY=$(read_option 'anthropic_api_key')
PORT=$(read_option 'port')
DAILY_REVIEW_LIMIT=$(read_option 'daily_review_limit')

# 기본값 처리
PORT="${PORT:-8000}"
DAILY_REVIEW_LIMIT="${DAILY_REVIEW_LIMIT:-50}"

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "[FATAL] anthropic_api_key가 설정되지 않았습니다. 애드온 설정에서 API 키를 입력하세요."
    exit 1
fi

# ── 런타임 디렉터리 생성 ──────────────────────────────
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
