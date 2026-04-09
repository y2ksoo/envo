#!/bin/bash
set -e

# 설치 디렉터리 (기본값: /home/pi/envo, 인수로 변경 가능)
# 사용 예: ./setup.sh /home/myuser/envo
ENVO_DIR="${1:-/home/pi/envo}"

echo "=== Envo 설치 시작 (경로: $ENVO_DIR) ==="

# 1. 시스템 패키지
echo "[1/5] 시스템 패키지 설치..."
sudo apt update && sudo apt install -y python3-pip python3-venv nodejs npm nginx

# 2. Python 가상환경
echo "[2/5] Python 가상환경 설정..."
cd "$ENVO_DIR/backend"
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

# 3. .env 파일 생성
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

# 4. 프론트엔드 빌드
echo "[4/5] 프론트엔드 빌드..."
cd "$ENVO_DIR/frontend"
npm install
npm run build

# 5. systemd 서비스 등록
echo "[5/5] systemd 서비스 등록..."
# ENVO_DIR를 반영해서 서비스 파일 생성
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

# 데이터 디렉터리 생성
mkdir -p "$ENVO_DIR/data/backups"
mkdir -p "$ENVO_DIR/backend/uploads"

echo ""
echo "=== 설치 완료 ==="
echo "접속 주소: http://$(hostname -I | awk '{print $1}')"
echo ""
echo "로그 확인: sudo journalctl -u envo-backend -f"
echo "서비스 상태: sudo systemctl status envo-backend"
