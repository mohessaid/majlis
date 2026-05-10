# Majlis

A multi-LLM discussion arena. Multiple AI models sit at the same table, respond to your questions, and earn or lose reputation based on their performance. The Curator watches the room and keeps things sharp.

## Architecture

| Layer | Tech |
|---|---|
| Frontend | React + Vite + TypeScript → Cloudflare Pages |
| Backend | FastAPI (Python) → AMD MI300X Droplet |
| Models | vLLM (ROCm) serving 5 x 8B models in parallel |
| Auth | Clerk |
| Search | Tavily |
| Database | SQLite via SQLModel |

## Project Structure

```
majlis/
├── agents/              # Project spec docs
├── backend/             # FastAPI app
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models.py        # SQLModel tables
│   ├── llm.py           # vLLM client + Curator calls
│   ├── scores.py        # Reputation system
│   ├── search.py        # Tavily integration
│   ├── auth.py          # Clerk JWT verification
│   ├── seed_db.py       # Seed reputation scores
│   ├── Dockerfile
│   └── routers/
│       ├── rooms.py
│       ├── discuss.py   # SSE streaming
│       ├── curator.py
│       └── feedback.py
├── frontend/            # React + Vite app
│   ├── src/
│   │   ├── pages/       # Landing, RoomSetup, DiscussionRoom
│   │   ├── components/  # Room UI, ModelPicker
│   │   ├── hooks/       # useDiscussion, useRoom
│   │   └── lib/api.ts   # All API calls
│   └── wrangler.toml    # Cloudflare Pages config
├── docker-compose.yml   # Full AMD droplet deployment
├── nginx.conf           # Reverse proxy + SSE support
└── .env.example
```

## Setup

### 1. Get API keys

- **Clerk**: https://clerk.com → create app → get publishable + secret keys
- **Tavily**: https://tavily.com → sign up → get API key (free tier)
- **HuggingFace**: https://huggingface.co → settings → access tokens (needed for Llama)

### 2. Deploy backend on AMD MI300X Droplet

```bash
# On the droplet
git clone <repo> && cd majlis

# Copy and fill in env vars
cp .env.example .env
nano .env

# Start all services (vLLM x5 + backend + nginx)
docker compose up -d

# First run downloads models (~30 GB total). Monitor:
docker compose logs -f vllm-llama
```

Model download takes 10–20 min on first start. After that, startup is fast.

### 3. Deploy frontend to Cloudflare Pages

```bash
cd frontend

# Copy and fill in env vars
cp .env.example .env.local
# Set VITE_API_URL=https://your-droplet-ip
# Set VITE_CLERK_PUBLISHABLE_KEY=pk_live_...

# Build
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name majlis
```

### 4. Local development

```bash
# Backend (needs vLLM running or models mocked)
cd backend
pip install -r requirements.txt
cp ../.env.example .env && nano .env
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Environment Variables

See `.env.example` for all required variables.

| Variable | Where | Purpose |
|---|---|---|
| `HF_TOKEN` | droplet `.env` | Download gated models (Llama) |
| `TAVILY_API_KEY` | droplet `.env` | Web search capability |
| `CLERK_SECRET_KEY` | droplet `.env` | Verify frontend JWTs |
| `FRONTEND_ORIGIN` | droplet `.env` | CORS whitelist |
| `VITE_API_URL` | `frontend/.env.local` | Backend URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | `frontend/.env.local` | Clerk frontend key |

## Models

| Key | Model | Port | Notes |
|---|---|---|---|
| `llama-3.1-8b` | Llama 3.1 8B Instruct | 8001 | Requires HF token |
| `qwen2.5-7b` | Qwen 2.5 7B Instruct | 8002 | Thinking capable |
| `mistral-7b` | Mistral 7B v0.3 | 8003 | Fast, general |
| `deepseek-r1-8b` | DeepSeek R1 Distill 8B | 8004 | Best for reasoning |
| `curator` | Qwen 2.5 0.5B Instruct | 8005 | Curator/moderator |

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/room/create` | Create room, get Curator recommendations |
| `GET` | `/room/{id}` | Get room state |
| `POST` | `/room/{id}/participant/add` | Add a model to the room |
| `POST` | `/room/{id}/participant/{pid}/dismiss` | Dismiss a model |
| `POST` | `/room/{id}/end` | End session + update scores |
| `POST` | `/discuss` | SSE stream — all models respond |
| `GET` | `/curator/warn` | Check reputation warning |
| `GET` | `/curator/models` | List models with scores |
| `GET` | `/health` | Health check |
