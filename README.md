# Majlis

Multi-LLM **discussion arena**: several models answer in parallel, you moderate with **kicks**, **Curator moves** (ready debate prompts), and optional **web search** (Tavily). History is persisted per room.

## What you get

| Feature | Notes |
|--------|--------|
| Curator | Recommends panelists; **synthesizes** after each surface/discuss round; shallow “same answer twice” check on depth |
| **Curator moves** | `GET /curator/discuss-prompts` — e.g. *Challenge*, *Find consensus*, *Devil’s advocate* — UI sends `mode: "discuss"` with a structured directive |
| Discuss round | Models only see **active** panelists in the pasted context — **kicked** models are excluded from follow-up discussion |
| Tools | Per-participant **web_search** at join; **force_web_search** on `/discuss` runs **one shared** Tavily pass for that round |
| UI | Light shadcn/Tailwind; stacked **response cards**; Clerk auth |

## Architecture

| Layer | Tech |
|------|------|
| Frontend | React + Vite + TS, Tailwind, **shadcn/ui** → **Cloudflare Pages** |
| Backend | **FastAPI** → AMD droplet (**Docker** + **Nginx**) |
| Models | **vLLM (ROCm)** — parallel 8B-class workers + **`curator`** endpoint |
| Auth | **Clerk** (JWT verified with JWKS) |
| Search | **Tavily** |
| DB | **SQLite** + SQLModel |

## Project layout

```
majlis/
├── backend/           # FastAPI — routers/rooms, discuss, curator, feedback
├── frontend/          # Vite app — Pages, hooks/useDiscussion, components/ui (shadcn)
├── docker-compose.yml # vLLM × N + backend + nginx (droplet)
├── nginx.conf
├── docs/
│   └── MAJLIS_SLIDES.html   # Print / Save as PDF (browser: Print → PDF)
└── .env.example
```

## Quick API reference

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/room/create` | Create room + curator recommendations |
| GET | `/rooms` | List user’s recent rooms |
| GET | `/room/{id}` | Room state |
| GET | `/room/{id}/messages` | Full transcript (`model_id`, `display_name`, layers) |
| POST | `/discuss` | **SSE** stream — body: `message`, optional `target_participant_id`, `mode`, `force_web_search` |
| GET | `/curator/discuss-prompts` | **Curator moves** (labels + instructions) |
| GET | `/curator/models` | Models + reputation for category |
| POST | `/room/{id}/participant/add` | Add model (`web_search`, `thinking`, `fast_mode`) |
| POST | `/room/{id}/participant/{pid}/dismiss` | Kick + reason string |

## Deploy (summary)

1. **Droplet:** `docker compose up -d` with `.env` (`HF_TOKEN`, `TAVILY_API_KEY`, `CLERK_*`, `FRONTEND_ORIGIN`).
2. **DNS:** Point `api.` and app host to droplet / Pages (Cloudflare proxy OK).
3. **Frontend:** `VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY` → `npm run build` → Pages deploy (or GitHub Actions in `.github/workflows/`).

**Note:** GitHub runners may be blocked from SSH to your droplet; backend updates can be `rsync` + `docker cp` + restart, or open SSH to Actions IPs.

## Local dev

```bash
cd backend && pip install -r requirements.txt && uvicorn main:app --reload
cd frontend && npm i && npm run dev
```

## Slides (PDF)

**`docs/MAJLIS_SLIDES.pdf`** — 16-slide deck (thesis, product depth, architecture, API sketch, security, trade-offs, roadmap, demo script). Source: `docs/MAJLIS_SLIDES.html`.

Regenerate: open the HTML → **Print** → **Save as PDF** (set margins to **Default** or **Minimum** so `@page` in the file controls the box). Or:

`google-chrome --headless --no-pdf-header-footer --print-to-pdf=docs/MAJLIS_SLIDES.pdf file://$(pwd)/docs/MAJLIS_SLIDES.html`

## Environment

See `.env.example` for `HF_TOKEN`, `TAVILY_API_KEY`, `CLERK_SECRET_KEY`, `FRONTEND_ORIGIN`, model URLs, etc.

## Models (typical)

| Key | Role |
|-----|------|
| `llama-3.1-8b`, `qwen2.5-7b`, `mistral-7b`, `deepseek-r1-8b` | Panel |
| `curator` | Routing, warnings, synthesis, discuss-prompt copy |

Ports are wired in `docker-compose.yml` / `config.py`.
