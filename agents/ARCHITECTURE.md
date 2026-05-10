# ARCHITECTURE.md — Majlis

## Stack Decision

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + Vite + TypeScript | Fast to build, Vercel AI SDK works natively |
| Streaming | Vercel AI SDK (`ai` package) | Handles multi-model streaming, unified interface |
| Backend | FastAPI (Python) | AI ecosystem is Python, async streaming support |
| Model routing | LiteLLM | Single unified API for all models regardless of provider |
| Curator model | Qwen2.5-0.5B via AMD cloud | Tiny, instruction-tuned, near-zero cost |
| Discussion models | AMD cloud (Llama-3.1-8B, Qwen2.5-7B, Mistral-7B, DeepSeek-R1-8B) | Hackathon compute |
| External models | User-provided API keys (Grok, Perplexity, GPT-4, Claude) | Passed through LiteLLM |
| Database | SQLite via SQLModel | Zero setup, sufficient for hackathon scale |
| Search tool | SerpAPI or Tavily (free tier) | Attached to any model with web_search enabled |

---

## System Diagram

```
User Browser (React)
        │
        │  REST + SSE streaming
        ▼
FastAPI Backend
        │
        ├── /room/*          Room management
        ├── /discuss         Main discussion endpoint (streams)
        ├── /curator/*       Curator recommendations and warnings
        └── /feedback/*      Dismissal and scoring
        │
        ├── LiteLLM Router
        │       ├── AMD Cloud models (Llama, Qwen, Mistral, DeepSeek)
        │       ├── User API keys (Grok, GPT-4, Claude, Perplexity)
        │       └── Curator endpoint (Qwen2.5-0.5B)
        │
        ├── Tool Layer
        │       └── Web Search (SerpAPI/Tavily) — injected pre-response
        │
        └── SQLite DB
                ├── rooms
                ├── messages
                ├── participants
                ├── dismissal_events
                └── reputation_scores
```

---

## API Contracts

### POST /room/create
```json
Request:
{
  "question": "string",
  "user_api_keys": { "grok": "key", "openai": "key" }  // optional
}

Response:
{
  "room_id": "uuid",
  "detected_category": "recent_events | philosophy | coding | science | general",
  "curator_recommendations": [
    {
      "model_id": "llama-3.1-8b",
      "display_name": "Llama 3.1",
      "reputation_score": 0.82,
      "reason": "Strong general reasoning for this topic",
      "suggested_capabilities": { "web_search": false, "thinking": false, "fast_mode": false }
    }
  ]
}
```

### POST /room/{room_id}/participant/add
```json
Request:
{
  "model_id": "string",
  "capabilities": {
    "web_search": true,
    "thinking": false,
    "fast_mode": false
  },
  "api_key": "string"  // only if external model
}

Response:
{
  "participant_id": "uuid",
  "curator_warning": "string | null",  // populated if reputation is poor
  "reputation_score": 0.34
}
```

### POST /discuss (Server-Sent Events stream)
```json
Request:
{
  "room_id": "uuid",
  "message": "string",
  "target_participant_id": "uuid | null"  // null = all participants respond
}

Stream events (one per token chunk, labeled):
{
  "participant_id": "uuid",
  "model_id": "string",
  "layer": "surface | depth | thinking",
  "chunk": "string",
  "done": false
}

Final event per participant:
{
  "participant_id": "uuid",
  "done": true,
  "searched": true | false,
  "thinking_available": true | false
}
```

### POST /room/{room_id}/participant/{participant_id}/dismiss
```json
Request:
{
  "reason": "recent_events | too_shallow | wrong_domain | hallucinating | other",
  "reason_text": "string | null"
}

Response:
{
  "score_delta": -1.0,
  "new_score": 0.23,
  "curator_suggestion": { "model_id": "...", "reason": "..." } | null
}
```

### GET /curator/warn
```json
Request (query params):
  room_id, model_id_to_add

Response:
{
  "should_warn": true,
  "warning": "This model has been dismissed in 7/10 recent events discussions",
  "reputation_score": 0.21,
  "better_alternatives": [{ "model_id": "...", "score": 0.87 }]
}
```

---

## LiteLLM Configuration

```python
# litellm_config.py

AMD_MODELS = {
    "llama-3.1-8b": {
        "model": "openai/meta-llama/Llama-3.1-8B-Instruct",
        "api_base": "https://api.amd.developer.cloud/...",
        "api_key": AMD_API_KEY,
        "capabilities": ["thinking_possible": False, "fast": True]
    },
    "qwen2.5-7b": {
        "model": "openai/Qwen/Qwen2.5-7B-Instruct",
        "api_base": "https://api.amd.developer.cloud/...",
        "api_key": AMD_API_KEY,
        "capabilities": ["thinking_possible": True]
    },
    "deepseek-r1-8b": {
        "model": "openai/deepseek-ai/DeepSeek-R1-Distill-Llama-8B",
        "api_base": "https://api.amd.developer.cloud/...",
        "api_key": AMD_API_KEY,
        "capabilities": ["thinking_possible": True]
    },
    "mistral-7b": {
        "model": "openai/mistralai/Mistral-7B-Instruct-v0.3",
        "api_base": "https://api.amd.developer.cloud/...",
        "api_key": AMD_API_KEY,
        "capabilities": []
    },
    "curator": {
        "model": "openai/Qwen/Qwen2.5-0.5B-Instruct",
        "api_base": "https://api.amd.developer.cloud/...",
        "api_key": AMD_API_KEY
    }
}

# User-provided external models go through same LiteLLM interface
# just with their own api_base and api_key per call
```

---

## Reputation Score Logic

```python
# scores.py

def update_score(model_id: str, category: str, event: str, capability_context: dict):
    """
    event: "dismissed" | "session_completed" | "curator_flagged"
    """
    deltas = {
        "dismissed": -1.0,
        "session_completed": +0.5,
        "curator_flagged": -0.5
    }
    # Upsert into reputation_scores table
    # score clamped between 0.0 and 1.0
    # Initial score for unseen (model, category) pair: 0.5 (neutral)

def get_recommendations(category: str, available_models: list, top_n: int = 3):
    """
    Returns top N models by score for this category.
    New models (score = 0.5) appear in middle, not bottom.
    """
```

---

## Topic Category Detection

Curator prompt for detection:
```
You are categorizing a discussion topic. Given the user's question, return exactly one 
category from this list: recent_events, philosophy, coding, science, mathematics, 
politics, culture, general.

Return only the category word, nothing else.

Question: {question}
```

---

## Database Schema (SQLModel)

```python
class Room(SQLModel, table=True):
    id: str  # uuid
    created_at: datetime
    question: str
    category: str
    status: str  # active | ended
    overall_rating: int | None  # 1-5, set on end

class Participant(SQLModel, table=True):
    id: str  # uuid
    room_id: str
    model_id: str
    display_name: str
    joined_at: datetime
    dismissed_at: datetime | None
    dismissal_reason: str | None
    capabilities: str  # JSON string

class Message(SQLModel, table=True):
    id: str
    room_id: str
    participant_id: str | None  # null = user message
    layer: str  # user | surface | depth | thinking | curator
    content: str
    created_at: datetime
    searched: bool = False

class ReputationScore(SQLModel, table=True):
    model_id: str
    category: str
    score: float = 0.5
    total_sessions: int = 0
    total_dismissals: int = 0
    last_updated: datetime
    # Primary key: (model_id, category)
```

---

## Frontend Component Structure

```
src/
├── components/
│   ├── Room/
│   │   ├── RoomSetup.tsx        # Topic input + Curator recommendations
│   │   ├── ParticipantPanel.tsx # Model card with capabilities toggles
│   │   ├── DiscussionThread.tsx # The chat area
│   │   ├── MessageBubble.tsx    # Per-model styled bubble, surface/depth toggle
│   │   ├── CuratorMessage.tsx   # Distinct styling for Curator interventions
│   │   └── DismissModal.tsx     # Reason picker
│   └── ModelPicker.tsx          # Add model flow with reputation display
├── hooks/
│   ├── useRoom.ts               # Room state management
│   ├── useDiscussion.ts         # SSE streaming handler
│   └── useReputation.ts         # Score display helpers
└── lib/
    └── api.ts                   # All backend calls
```

---

## Deployment for Hackathon

- Backend: single FastAPI process, Uvicorn
- Frontend: Vite dev server or Vercel deploy
- DB: SQLite file, local
- AMD Cloud: models called via HTTP, no local GPU needed
- Environment variables: AMD_API_KEY, SERPAPI_KEY, one per user-provided external model
