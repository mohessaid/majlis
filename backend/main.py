from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import FRONTEND_ORIGIN
from database import create_db_and_tables
from llm import call_model_sync
from routers import curator, discuss, feedback, rooms


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(title="Majlis API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rooms.router)
app.include_router(discuss.router)
app.include_router(curator.router)
app.include_router(feedback.router)


@app.get("/health")
async def health():
    try:
        result = await call_model_sync(
            "curator",
            [{"role": "user", "content": "ping"}],
            max_tokens=5,
        )
        return {"status": "ok", "curator": "responding", "response": result[:20]}
    except Exception as e:
        return {"status": "degraded", "curator": "unavailable", "error": str(e)}


@app.get("/")
async def root():
    return {"name": "Majlis", "version": "1.0.0"}
