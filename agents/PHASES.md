# PHASES.md — Agent Execution Plan

Each phase is a standalone task for your Copilot agent.
Complete and verify each phase before starting the next.
Do not merge phases into one agent run.

---

## PHASE 1 — Backend Foundation (Day 1)

### Goal
FastAPI server running, LiteLLM connected to AMD cloud, single model callable,
SQLite database initialized with all tables.

### Task for agent
```
Create a FastAPI application with the following:

1. Project structure:
   backend/
   ├── main.py
   ├── config.py
   ├── database.py
   ├── models.py        # SQLModel table definitions
   ├── litellm_config.py
   └── routers/
       ├── rooms.py
       ├── discuss.py
       ├── curator.py
       └── feedback.py

2. Database (SQLite via SQLModel):
   Implement all four tables exactly as defined in ARCHITECTURE.md:
   Room, Participant, Message, ReputationScore

3. LiteLLM setup:
   - Configure AMD cloud models as defined in ARCHITECTURE.md litellm_config section
   - All model API bases read from environment variables
   - Add a /health endpoint that calls the curator model with "ping" and returns ok

4. Config:
   - All secrets via python-dotenv
   - AMD_API_KEY, SERPAPI_KEY environment variables
   - CORS enabled for localhost:5173 (Vite default)

5. Verify: running uvicorn main:app --reload starts without errors,
   GET /health returns 200 with curator model responding
```

### Done when
- `uvicorn main:app` starts clean
- `GET /health` returns `{ "status": "ok", "curator": "responding" }`
- SQLite file created with all tables on startup

---

## PHASE 2 — Room and Participant Management (Day 2 morning)

### Goal
Full room lifecycle working: create room with Curator recommendations, add/remove
participants, capability toggles persisted.

### Task for agent
```
Implement these endpoints in the FastAPI backend. Follow the exact request/response
contracts defined in ARCHITECTURE.md API Contracts section.

1. POST /room/create
   - Save room to DB
   - Call Curator model with recommendation prompt from CURATOR_PROMPT.md
   - Parse Curator JSON response
   - Return room_id + curator_recommendations

2. POST /room/{room_id}/participant/add
   - Check reputation score for (model_id, room.category) from DB
   - Call Curator warning prompt if score < 0.40
   - Save participant to DB with capabilities as JSON string
   - Return participant_id + curator_warning + reputation_score

3. DELETE /room/{room_id}/participant/{participant_id}
   - Mark participant as dismissed (do not delete row)
   - Trigger score update: -1.0 for (model_id, room.category)
   - Call Curator suggestion prompt for replacement
   - Return updated score + suggestion

4. POST /room/{room_id}/end
   - Accept overall_rating (1-5)
   - Update all non-dismissed participants: +0.5 score for (model_id, room.category)
   - Mark room as ended
   - Return session summary

5. Implement score update logic as defined in ARCHITECTURE.md reputation section.
   Scores clamped 0.0 to 1.0. New (model, category) pairs start at 0.5.
```

### Done when
- Can create a room and get back Curator recommendations
- Can add 3 models to the room
- Can dismiss one and see score update
- Can end room and see remaining models get +0.5

---

## PHASE 3 — Discussion Streaming (Day 2 afternoon — Day 3)

### Goal
The core of the product. User sends a message, all participants respond in parallel
with streaming, surface layer first, depth on demand.

### Task for agent
```
Implement POST /discuss as a Server-Sent Events streaming endpoint.

Behavior:
1. Receive room_id, message, optional target_participant_id
2. If target_participant_id is set: only that model responds (depth expansion)
   If null: all active (non-dismissed) participants respond in parallel

3. For each responding participant:
   a. If web_search capability is enabled:
      - Call SerpAPI/Tavily with the user's message as query
      - Take top 3 result snippets
      - Prepend to model context as: "Recent search results:\n{snippets}\n\nNow answer:"
   
   b. Build the model's system prompt:
      Surface mode: "You are {display_name} in a group discussion. Give your position
      on the topic in 2-3 sentences. Be direct. Lead with your actual view, not
      acknowledgment that it's a complex topic."
      
      Depth mode: "You are {display_name}. The user wants you to elaborate on what
      you said. Go deeper — add specifics, examples, or reasoning you didn't include
      before. Do not repeat your previous response."

   c. If thinking capability enabled and model supports it:
      Add thinking prefix to system prompt. Stream thinking chunks with layer="thinking"

   d. Stream response chunks via SSE in the format defined in ARCHITECTURE.md
   
   e. Save completed message to DB (full content, searched flag)

4. After all participants have responded, run Curator shallow detection on each
   depth expansion response. If is_shallow: true and confidence > 0.75:
   Stream a Curator message flagging it.

5. Save all messages to DB.

SSE format: one JSON object per line, prefixed with "data: "
Final event: { "type": "done", "participant_id": "..." }
```

### Done when
- Send a message, see 3 models streaming responses in parallel
- Click expand on one model, see depth response stream
- Model with web_search enabled shows "searched" flag in response
- Curator fires a shallow flag when depth response adds nothing new

---

## PHASE 4 — Frontend (Day 4 — Day 5)

### Goal
Full working UI. User can go from question to room to discussion to dismissal.

### Task for agent
```
Create a React + Vite + TypeScript frontend. No component library — custom CSS only.
Keep it clean and dark-themed.

Pages / Views:

1. Landing (/)
   - Single text input: "What do you want to discuss?"
   - Submit calls POST /room/create
   - While loading: show "Curator is analyzing your question..."
   - On response: navigate to /room/{room_id}/setup

2. Room Setup (/room/{id}/setup)
   - Show Curator's recommendations as model cards
   - Each card shows: model name, reputation score bar, suggested capabilities, reason
   - Capability toggles: web_search, thinking, fast_mode — per model
   - "Add another model" button → opens model picker modal
   - Model picker shows all available models with their reputation scores
   - If reputation < 0.40: show Curator warning inline
   - "Start Discussion" button → navigates to /room/{id}

3. Discussion Room (/room/{id})
   Layout:
   - Left sidebar: participant list with their colors, capability badges, Dismiss button
   - Main area: discussion thread
   - Bottom: message input

   Message thread:
   - User messages: right-aligned, distinct style
   - Model messages: labeled with model name + color dot
   - Each model message has a "Go deeper →" button
   - Thinking traces: collapsed by default, expandable
   - Search indicator: small 🔍 icon if model searched
   - Curator messages: distinct dark purple style with 👁 prefix
   - Streaming: text appears token by token

   Dismiss flow:
   - Click Dismiss on sidebar participant
   - Modal with reason options (from ARCHITECTURE.md)
   - On confirm: model card grays out, score shown, Curator suggestion appears

4. Session End
   - Triggered by "End Discussion" button
   - Star rating 1-5
   - Curator's verdict on most valuable participant
   - Summary: who stayed, who was dismissed, reasons

Component structure as defined in ARCHITECTURE.md frontend section.
Use useEventSource or fetch with ReadableStream for SSE consumption.
```

### Done when
- Full flow works: question → setup → discussion → dismiss → end
- Streaming visible in UI
- Dismissal updates sidebar immediately
- Curator messages appear distinctly

---

## PHASE 5 — Polish and Demo Prep (Day 6)

### Task for agent
```
1. Seed the reputation database with realistic starting data:
   - Create seed_db.py script
   - Add 15-20 entries across models and categories
   - Make recent_events category show clear differentiation
     (search-capable models score high, non-search models score low)
   - This makes Curator recommendations feel smart from first launch

2. Add model capability definitions to config:
   For each AMD model, define: supports_thinking (bool), typical_speed, 
   best_categories (list). Used by Curator for recommendations.

3. Error handling:
   - If AMD cloud model fails: show error state on that participant's card
   - If Curator fails: skip gracefully, don't block discussion
   - If search fails: model responds without search, no indicator shown

4. Environment setup:
   - Create .env.example with all required variables
   - Create README.md with setup steps: pip install, env vars, uvicorn command, 
     vite dev command

5. Demo data:
   - Create a demo room seeder that pre-populates one complete discussion
     about "What happened with AI regulation in the past month"
   - Shows Grok/search model being valuable, non-search models being dismissed
   - This is your hackathon demo fallback if live API has issues
```

---

## VERIFICATION CHECKLIST (before submission)

- [ ] Room creation returns Curator recommendations
- [ ] Adding a low-reputation model shows warning
- [ ] 3 models stream responses in parallel
- [ ] Web search model shows search indicator
- [ ] Depth expansion works and Curator can flag shallow responses
- [ ] Dismissal updates score and shows suggestion
- [ ] Session end updates remaining model scores
- [ ] New room for same topic reflects previous dismissal scores
- [ ] Demo room loads without API calls (for fallback demo)
- [ ] .env.example documented
- [ ] AMD cloud models confirmed working with $100 credits
