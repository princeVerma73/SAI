"""
Unified LLM Client supporting both Groq (Qwen 3.8 27B / GPT OSS) and Gemini 3.8 Flash with automatic fallback.
"""

import os
import requests
from dotenv import load_dotenv

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
load_dotenv(os.path.join(base_dir, ".env"))
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={GEMINI_API_KEY}"

def call_llm(prompt: str, system_prompt: str = "", temperature: float = 0.2, max_tokens: int = 1024) -> str:
    """
    Calls Groq (ultra-low latency), falling back to Gemini if unavailable.
    """
    # 1. Try Groq with Qwen 3.8 27B
    if GROQ_API_KEY:
        try:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            payload = {
                "model": "qwen/qwen3.8-27b",
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max(max_tokens, 150)
            }
            res = requests.post(
                GROQ_API_URL,
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json=payload,
                timeout=10
            )
            if res.status_code == 200:
                data = res.json()
                msg = data["choices"][0]["message"]
                content = (msg.get("content") or msg.get("reasoning") or "").strip()
                if content:
                    return content
        except Exception as e:
            print(f"[LLM Client] Groq error: {e}, falling back to Gemini...")

    # 2. Try Gemini 3.8 Flash
    if GEMINI_API_KEY:
        try:
            gemini_payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": f"{system_prompt}\n\n{prompt}" if system_prompt else prompt}
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": temperature,
                    "maxOutputTokens": max_tokens
                }
            }
            res = requests.post(GEMINI_API_URL, json=gemini_payload, timeout=12)
            if res.status_code == 200:
                data = res.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text", "").strip()
        except Exception as e:
            print(f"[LLM Client] Gemini error: {e}")

    return "Clinical decision support is temporarily unavailable. Please consult your physician directly."
