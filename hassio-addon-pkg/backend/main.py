from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from database import create_tables
from routers import cards, conversation, uploads, users, review, word_sets


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


app = FastAPI(title="Envo - English Learning", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routers
app.include_router(users.router, prefix="/api")
app.include_router(cards.router, prefix="/api")
app.include_router(uploads.router, prefix="/api")
app.include_router(review.router, prefix="/api")
app.include_router(conversation.router, prefix="/api")
app.include_router(word_sets.router, prefix="/api")

# Serve React build
# FRONTEND_DIST 환경변수 우선, 없으면 기본 경로 (hassio / 일반 배포 모두 지원)
import os as _os
_env_dist = _os.environ.get("FRONTEND_DIST")
frontend_dist = Path(_env_dist) if _env_dist else Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        return FileResponse(str(frontend_dist / "index.html"))
