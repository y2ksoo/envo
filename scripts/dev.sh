#!/bin/bash
# Envo 로컬 개발 서버 실행 스크립트 (Mac/Linux)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENVO_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$ENVO_DIR/backend"
FRONTEND_DIR="$ENVO_DIR/frontend"

echo "=== Envo 개발 서버 시작 ==="

# .env 파일 확인
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo ""
    echo "⚠️  backend/.env 파일이 없습니다."
    echo "   다음 명령어로 생성하세요:"
    echo "   cp $BACKEND_DIR/.env.example $BACKEND_DIR/.env"
    echo "   그 후 ANTHROPIC_API_KEY를 입력하세요."
    echo ""
    exit 1
fi

# Python 가상환경 설정
if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo "[setup] Python 가상환경 생성..."
    python3.12 -m venv "$BACKEND_DIR/venv"
fi

echo "[setup] Python 패키지 설치 확인..."
"$BACKEND_DIR/venv/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"

# Node 패키지 설치
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "[setup] Node 패키지 설치..."
    cd "$FRONTEND_DIR" && npm install
fi

# 백엔드 실행 (백그라운드)
echo "[backend] http://localhost:8000 시작..."
cd "$BACKEND_DIR"
"$BACKEND_DIR/venv/bin/uvicorn" main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# 프론트엔드 실행 (백그라운드)
echo "[frontend] http://localhost:5173 시작..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 개발 서버 실행 중"
echo "   브라우저: http://localhost:5173"
echo "   API 문서: http://localhost:8000/docs"
echo ""
echo "   종료: Ctrl+C"
echo ""

# Ctrl+C 시 두 프로세스 모두 종료
trap "echo '종료 중...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM

wait $BACKEND_PID $FRONTEND_PID
