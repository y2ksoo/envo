ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base-python:3.12
FROM $BUILD_FROM

# Install Node.js for frontend build
RUN apk add --no-cache nodejs npm

# ── 프론트엔드 빌드 ───────────────────────────────────
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci --quiet

COPY frontend/ ./
RUN npm run build

# ── 백엔드 설치 ───────────────────────────────────────
WORKDIR /app
COPY backend/ ./

RUN pip3 install --no-cache-dir -r requirements.txt

# 빌드된 프론트엔드 복사
COPY --from=0 /build/frontend/dist ./dist_frontend

# 데이터 디렉터리 생성
RUN mkdir -p /data/envo /data/envo/uploads

# 시작 스크립트
COPY hassio/run.sh /run.sh
RUN chmod +x /run.sh

CMD ["/run.sh"]
