import os
from dotenv import load_dotenv

load_dotenv()

# AMD Cloud / vLLM
AMD_API_KEY = os.getenv("AMD_API_KEY", "EMPTY")
VLLM_BASE_URL = os.getenv("VLLM_BASE_URL", "http://localhost:8000/v1")

# Each model can have its own vLLM endpoint if running separate instances
LLAMA_BASE_URL = os.getenv("LLAMA_BASE_URL", VLLM_BASE_URL)
QWEN_BASE_URL = os.getenv("QWEN_BASE_URL", VLLM_BASE_URL)
MISTRAL_BASE_URL = os.getenv("MISTRAL_BASE_URL", VLLM_BASE_URL)
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", VLLM_BASE_URL)
CURATOR_BASE_URL = os.getenv("CURATOR_BASE_URL", VLLM_BASE_URL)

# Search
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

# Auth (Clerk)
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
CLERK_PUBLISHABLE_KEY = os.getenv("CLERK_PUBLISHABLE_KEY", "")

# Frontend origin for CORS
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./majlis.db")

# Model IDs (as served by vLLM)
MODEL_IDS = {
    "llama-3.1-8b": "meta-llama/Llama-3.1-8B-Instruct",
    "qwen2.5-7b": "Qwen/Qwen2.5-7B-Instruct",
    "mistral-7b": "mistralai/Mistral-7B-Instruct-v0.3",
    "deepseek-r1-8b": "deepseek-ai/DeepSeek-R1-Distill-Llama-8B",
    "curator": "Qwen/Qwen2.5-0.5B-Instruct",
}

MODEL_DISPLAY_NAMES = {
    "llama-3.1-8b": "Llama 3.1",
    "qwen2.5-7b": "Qwen 2.5",
    "mistral-7b": "Mistral",
    "deepseek-r1-8b": "DeepSeek R1",
    "curator": "Curator",
}

# Which models support thinking/extended reasoning
MODEL_SUPPORTS_THINKING = {
    "llama-3.1-8b": False,
    "qwen2.5-7b": True,
    "mistral-7b": False,
    "deepseek-r1-8b": True,
    "curator": False,
}

# vLLM base URLs per model key
MODEL_BASE_URLS = {
    "llama-3.1-8b": LLAMA_BASE_URL,
    "qwen2.5-7b": QWEN_BASE_URL,
    "mistral-7b": MISTRAL_BASE_URL,
    "deepseek-r1-8b": DEEPSEEK_BASE_URL,
    "curator": CURATOR_BASE_URL,
}
