# Majlis — Project Specification

## Vision

A discussion arena where multiple LLMs sit at the same table. Each carries a defined
capability profile — search, thinking, speed, depth. The user controls who's in the room
and what tools they carry. Models respond like humans — position first, depth on demand.
The Curator watches everything, scores models by question type and capability match, and
over time becomes genuinely useful at telling you "don't bring that model into this kind
of conversation." Users can bring their own API keys to unlock external models alongside
AMD-hosted open models.

---

## Core Concepts

### The Room
A session. Has a topic (user-defined or auto-detected). Has participants (models). Has a
moderator (the Curator). Rooms are ephemeral but their feedback signals persist.

### Participants (Discussion Agents)
Each participant is an LLM instance with:
- A model identity (Llama, Qwen, Mistral, DeepSeek, Grok, etc.)
- A capability profile (which tools are enabled for this participant in this room)
- A reputation score per topic category (loaded at room creation, updated on dismissal)
- A response mode: Surface → Depth

### The Curator
A lightweight model (Qwen2.5-0.5B or SmolLM2-135M) running separately.
Responsibilities:
- Recommend participants when user opens a new room (based on topic + reputation DB)
- Warn user when they try to add a model with poor reputation for this topic category
- Watch discussions and flag shallow/repetitive behavior
- Is itself a participant in the room — speaks when it has something worth saying

### Capability Flags (per participant, per room)
- `web_search` — model can search the web before responding
- `thinking` — extended reasoning mode enabled (if model supports it)
- `fast_mode` — shorter responses, higher speed priority

These can be toggled globally (all models) or per model by the user.

### The Reputation System
Not a global model score. A matrix:
```
(model_id, topic_category, capability_context) → score
```
Events that update score:
- User dismisses model → -1.0
- User completes session without dismissing → +0.5 per model that stayed
- Curator flags model as shallow mid-session → -0.5 (pending user confirmation)

Topic categories are auto-detected from the opening question by the Curator.

---

## User Flows

### Flow 1 — Starting a Room
1. User types their question or topic
2. Curator analyzes topic → detects category → loads reputation scores
3. Curator recommends 2–3 participants with reasoning ("Grok is strong here because
   this is a recent event", "DeepSeek for depth on this reasoning problem")
4. User accepts, modifies, or ignores recommendations
5. User can toggle capabilities globally or per model before starting
6. Room opens

### Flow 2 — The Discussion
1. User submits their question to the room
2. All active participants respond — **surface layer first** (2–3 sentences, their position)
3. Responses stream in labeled by model name, styled distinctly per model
4. User can click any model's response to **expand depth** — model elaborates
5. User or any model can address a specific model ("@Mistral what do you mean by...")
6. Curator observes — if a model repeats itself on depth expansion, Curator quietly flags it

### Flow 3 — Dismissal
1. User clicks Dismiss on a participant
2. Modal appears: select reason
   - "Didn't know recent events"
   - "Too shallow / repetitive"
   - "Wrong domain"
   - "Hallucinating"
   - "Other"
3. Model leaves the room
4. Score updates immediately
5. Curator may suggest a replacement

### Flow 4 — Adding a Model Mid-Session
1. User opens model picker
2. Curator displays reputation score for each available model for this topic
3. If model has poor score: warning shown ("This model has been dismissed 7 out of 10
   times in recent events discussions — are you sure?")
4. User confirms or picks different model
5. New model joins, gets context summary of discussion so far

### Flow 5 — Session End
1. User ends session
2. Short feedback prompt: overall quality rating (1–5)
3. Scores update for all remaining participants
4. Session archived (topic, models used, who got dismissed, overall rating)

---

## Capability Details

### Web Search
- Implemented via a search tool call before the model generates its response
- Model receives: question + top 3 search result snippets
- User sees a small indicator "🔍 searched" on that response
- Available to any model but most meaningful for real-time questions

### Thinking Mode
- For models that support extended reasoning (DeepSeek-R1, Qwen thinking variants)
- Adds a reasoning step before the surface response
- User can toggle to see the thinking trace or hide it
- Increases latency, shown to user upfront

### Fast Mode
- Caps response length, disables thinking, prioritizes speed
- Useful when user wants quick takes before going deep

---

## What Makes This Different from Existing Tools

1. **Dismissal as a signal, not just UX** — the kick button feeds a learning system
2. **Topic-scoped reputation** — not "is this a good model" but "is this model good HERE"
3. **Curator as a participant** — not a settings panel, an actual voice in the room
4. **Capability matching** — the system knows that real-time questions need search, not just a smart model
5. **Surface → Depth response model** — exposes who's bluffing vs who has substance
