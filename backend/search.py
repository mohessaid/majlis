"""
Tavily web search integration. Injected before model response when web_search is enabled.
"""
import httpx
from typing import Optional
from config import TAVILY_API_KEY


async def tavily_search(query: str, max_results: int = 3) -> list[dict]:
    if not TAVILY_API_KEY:
        return []

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": TAVILY_API_KEY,
                    "query": query,
                    "max_results": max_results,
                    "search_depth": "basic",
                    "include_answer": False,
                    "include_raw_content": False,
                },
            )
            response.raise_for_status()
            data = response.json()
            return [
                {"title": r.get("title", ""), "snippet": r.get("content", ""), "url": r.get("url", "")}
                for r in data.get("results", [])[:max_results]
            ]
        except Exception:
            return []


def format_search_context(results: list[dict]) -> str:
    if not results:
        return ""
    lines = ["Recent search results:"]
    for r in results:
        lines.append(f"- {r['title']}: {r['snippet']}")
    lines.append("\nNow answer:")
    return "\n".join(lines)
