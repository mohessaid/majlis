"""
LLM client layer. Uses the openai-compatible API exposed by vLLM.
Each model can have its own vLLM endpoint (separate processes on AMD droplet).
"""
import asyncio
import json
from typing import AsyncGenerator, Optional
from openai import AsyncOpenAI

from config import MODEL_IDS, MODEL_BASE_URLS, AMD_API_KEY, MODEL_SUPPORTS_THINKING


def _client(model_key: str, api_key: Optional[str] = None) -> AsyncOpenAI:
    base_url = MODEL_BASE_URLS.get(model_key, MODEL_BASE_URLS["llama-3.1-8b"])
    return AsyncOpenAI(
        base_url=base_url,
        api_key=api_key or AMD_API_KEY or "EMPTY",
    )


async def call_model_streaming(
    model_key: str,
    messages: list[dict],
    max_tokens: int = 512,
    temperature: float = 0.7,
    api_key: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    client = _client(model_key, api_key)
    model_name = MODEL_IDS.get(model_key, model_key)

    stream = await client.chat.completions.create(
        model=model_name,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        stream=True,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content


async def call_model_sync(
    model_key: str,
    messages: list[dict],
    max_tokens: int = 256,
    temperature: float = 0.1,
    api_key: Optional[str] = None,
) -> str:
    """Non-streaming call, used for Curator classification tasks."""
    client = _client(model_key, api_key)
    model_name = MODEL_IDS.get(model_key, model_key)

    response = await client.chat.completions.create(
        model=model_name,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        stream=False,
    )
    return response.choices[0].message.content or ""


async def detect_category(question: str) -> str:
    prompt = (
        "You are categorizing a discussion topic. Given the user's question, return exactly one "
        "category from this list: recent_events, philosophy, coding, science, mathematics, "
        "politics, culture, general.\n\n"
        "Return only the category word, nothing else.\n\n"
        f"Question: {question}"
    )
    result = await call_model_sync("curator", [{"role": "user", "content": prompt}], max_tokens=10)
    result = result.strip().lower()
    valid = {"recent_events", "philosophy", "coding", "science", "mathematics", "politics", "culture", "general"}
    return result if result in valid else "general"


async def get_curator_recommendations(
    category: str,
    question: str,
    models_with_scores: list[dict],
) -> dict:
    models_json = json.dumps(models_with_scores, indent=2)
    prompt = f"""You are the Curator, a discussion moderator. Your job is to recommend the right AI models
for a discussion based on the topic and their past performance.

You have access to reputation scores for each model per topic category.
Scores range from 0.0 (frequently dismissed) to 1.0 (consistently valuable).
A score of 0.5 means no history — treat as neutral.

Topic category: {category}
User question: {question}

Available models and their scores for this category:
{models_json}

Respond in JSON only:
{{
  "recommendations": [
    {{
      "model_id": "string",
      "reason": "one sentence, specific, not generic",
      "suggested_capabilities": {{
        "web_search": true,
        "thinking": false,
        "fast_mode": false
      }}
    }}
  ],
  "notes": "one optional sentence if something important needs flagging, otherwise null"
}}

Rules:
- Recommend 2 to 3 models maximum
- If the question involves recent events, always flag web_search: true for at least one model
- If the question requires deep reasoning, suggest thinking: true for capable models
- Be specific in your reason — mention WHY this model fits THIS question
- Never recommend a model with score below 0.25 unless there are no better options"""

    raw = await call_model_sync("curator", [{"role": "user", "content": prompt}], max_tokens=512)
    try:
        # Extract JSON from response (model may wrap it)
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
    except Exception:
        return {"recommendations": [], "notes": "Curator unavailable"}


async def get_curator_warning(
    category: str,
    model_id: str,
    display_name: str,
    score: float,
    dismissal_count: int,
    total_sessions: int,
) -> dict:
    prompt = f"""You are the Curator. A user is about to add a model to their discussion.

Current topic category: {category}
Model they want to add: {model_id} ({display_name})
That model's reputation score for this category: {score}
Times dismissed in this category: {dismissal_count} out of {total_sessions} sessions

Write a single warning sentence if score is below 0.40. Be direct, not alarmist.
If score is above 0.40, return null.

Return JSON only:
{{
  "warning": "string or null",
  "alternatives": ["model_id_1", "model_id_2"] or []
}}"""

    raw = await call_model_sync("curator", [{"role": "user", "content": prompt}], max_tokens=128)
    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
    except Exception:
        return {"warning": None, "alternatives": []}


async def check_shallow_response(surface: str, depth: str) -> dict:
    prompt = f"""You are evaluating whether an AI model added genuine depth when asked to elaborate.

Surface response: {surface}
Depth response: {depth}

Did the depth response add meaningful new information, reasoning, or perspective
beyond what was in the surface response?

Return JSON only:
{{
  "is_shallow": true,
  "confidence": 0.0
}}

Only return is_shallow: true if confidence is above 0.75."""

    raw = await call_model_sync("curator", [{"role": "user", "content": prompt}], max_tokens=64)
    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
    except Exception:
        return {"is_shallow": False, "confidence": 0.0}


async def get_replacement_suggestion(
    category: str,
    dismissed_model_id: str,
    available_models: list[dict],
) -> Optional[dict]:
    if not available_models:
        return None
    # Pick the highest-scored non-dismissed model
    candidates = sorted(available_models, key=lambda m: m.get("score", 0.5), reverse=True)
    if candidates and candidates[0]["model_id"] != dismissed_model_id:
        return {"model_id": candidates[0]["model_id"], "reason": "Highest reputation for this topic category"}
    return None
