#!/bin/bash
set -e

# ============================================================
# Envo 설치 스크립트
#
# 사용법:
#   ./setup.sh                        # 기본 (라즈베리파이 등 Linux)
#   ./setup.sh /home/myuser/envo      # 설치 경로 지정
#   ./setup.sh --hassio               # Home Assistant (hassio) 애드온 패키징
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENVO_DIR_DEFAULT="$(dirname "$SCRIPT_DIR")"

# ── hassio 애드온 패키징 ──────────────────────────────────────
hassio_install() {
    local src="$ENVO_DIR_DEFAULT"
    local out="$src/hassio-addon-pkg"

    echo "=== Envo Home Assistant 애드온 패키징 ==="
    echo "소스: $src"
    echo "출력: $out"
    echo ""

    rm -rf "$out"
    mkdir -p "$out"

    # 애드온 설정 및 실행 파일
    cp "$src/hassio/config.yaml" "$out/config.yaml"
    cp "$src/hassio/Dockerfile"  "$out/Dockerfile"
    cp "$src/hassio/run.sh"      "$out/run.sh"

    # 소스코드 복사 (Dockerfile 빌드 시 필요)
    cp -r "$src/backend"  "$out/backend"
    cp -r "$src/frontend" "$out/frontend"

    # 빌드 캐시 제외 (Docker 빌드 중 새로 생성됨)
    rm -rf "$out/frontend/node_modules"
    rm -rf "$out/frontend/dist"
    rm -rf "$out/backend/venv"
    rm -rf "$out/backend/__pycache__"
    rm -rf "$out/backend/data"
    rm -rf "$out/backend/uploads"
    find "$out" -name "*.pyc" -delete

    echo "✅ 패키징 완료!"
    echo ""
    echo "======================================================"
    echo " Home Assistant 애드온 설치 방법"
    echo "======================================================"
    echo ""
    echo "① HA에서 SSH 또는 Samba 애드온을 먼저 활성화하세요."
    echo ""
    echo "② 패키지를 HA의 /addons/envo 폴더에 복사:"
    echo ""
    echo "   # SSH 방식"
    echo "   scp -r $out root@<HA_IP>:/addons/envo"
    echo ""
    echo "   # Samba 방식: 네트워크 드라이브의 addons 폴더에"
    echo "   # 'envo' 폴더를 만들고 $out 내용을 붙여넣기"
    echo ""
    echo "③ Home Assistant UI에서:"
    echo "   설정 → 애드온 → 애드온 스토어 → ⋮ (우상단) → 로컬 애드온 확인"
    echo "   'Envo 영단어 학습' 을 찾아 [설치]"
    echo ""
    echo "④ 애드온 [설정] 탭에서 API 키 입력:"
    echo "   anthropic_api_key: sk-ant-..."
    echo ""
    echo "⑤ [시작] 후 http://<HA_IP>:8000 으로 접속"
    echo ""
    echo "  ※ DB와 업로드 파일은 HA의 /data/envo/에 영구 저장됩니다."
    echo "======================================================"
}

# ── 일반 Linux 설치 ───────────────────────────────────────────
linux_install() {
    local ENVO_DIR="${1:-/home/pi/envo}"

    echo "=== Envo 설치 시작 (경로: $ENVO_DIR) ==="

    echo "[1/5] 시스템 패키지 설치..."
    sudo apt update && sudo apt install -y python3-pip python3-venv nodejs npm nginx

    echo "[2/5] Python 가상환경 설정..."
    cd "$ENVO_DIR/backend"
    python3 -m venv venv
    ./venv/bin/pip install --upgrade pip
    ./venv/bin/pip install -r requirements.txt

    if [ ! -f "$ENVO_DIR/backend/.env" ]; then
        echo "[3/5] .env 파일 생성..."
        cat > "$ENVO_DIR/backend/.env" << EOF
ANTHROPIC_API_KEY=여기에_API_키_입력
DATABASE_URL=sqlite:////$ENVO_DIR/data/envo.db
UPLOAD_DIR=$ENVO_DIR/backend/uploads
EOF
        echo "  ⚠️  $ENVO_DIR/backend/.env 파일을 열어 API 키를 입력하세요!"
    else
        echo "[3/5] .env 파일 이미 존재"
    fi

    echo "[4/5] 프론트엔드 빌드..."
    cd "$ENVO_DIR/frontend"
    npm install
    npm run build

    echo "[5/5] systemd 서비스 등록..."
    sudo tee /etc/systemd/system/envo-backend.service > /dev/null << EOF
[Unit]
Description=Envo English Learning Backend
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$ENVO_DIR/backend
ExecStart=$ENVO_DIR/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=on-failure
RestartSec=5
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=$ENVO_DIR/backend/.env

[Install]
WantedBy=multi-user.target
EOF

    sudo cp "$ENVO_DIR/nginx/envo.conf" /etc/nginx/sites-available/envo
    sudo ln -sf /etc/nginx/sites-available/envo /etc/nginx/sites-enabled/envo
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo systemctl daemon-reload
    sudo systemctl enable envo-backend
    sudo systemctl restart envo-backend
    sudo systemctl restart nginx

    mkdir -p "$ENVO_DIR/data/backups"
    mkdir -p "$ENVO_DIR/backend/uploads"

    echo ""
    echo "=== 설치 완료 ==="
    echo "접속 주소: http://$(hostname -I | awk '{print $1}')"
    echo ""
    echo "로그 확인:  sudo journalctl -u envo-backend -f"
    echo "서비스 상태: sudo systemctl status envo-backend"
}

# ── 진입점 ────────────────────────────────────────────────────
case "${1:-}" in
    --hassio)
        hassio_install
        ;;
    --help|-h)
        echo "사용법:"
        echo "  ./setup.sh                   # 라즈베리파이 등 Linux 설치 (기본 경로)"
        echo "  ./setup.sh /path/to/envo     # 설치 경로 지정"
        echo "  ./setup.sh --hassio          # Home Assistant 애드온 패키징"
        ;;
    *)
        linux_install "${1:-/home/pi/envo}"
        ;;
esac
