ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base-python:3.12
FROM $BUILD_FROM

# ── Node.js 설치 (프론트엔드 빌드용) ─────────────────
RUN apk add --no-cache nodejs npm

# ── 프론트엔드 빌드 ────────────────────────────────────
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Python 백엔드 설치 ────────────────────────────────
WORKDIR /app
COPY backend/ ./
RUN python3 -m pip install --no-cache-dir -r requirements.txt

# ── 빌드된 프론트엔드 배치 ────────────────────────────
RUN cp -r /build/frontend/dist /app/dist_frontend

# ── 시작 스크립트 ─────────────────────────────────────
COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD ["/run.sh"]
