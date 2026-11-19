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
GEMINI_MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-3.8-flash"]

CLINICAL_IMAGE_SYSTEM_PROMPT = """You are HealthAssist, an empathetic clinical triage and decision-support AI.
When the user shares an image (such as a skin rash, cut mark, burn, insect bite, wound, lesion, swelling, or redness):
1. Carefully observe the visual characteristics (color, borders, depth, bleeding, redness/erythema, pustules, swelling).
2. Offer immediate, practical first aid guidance (e.g. gentle washing with clean water/mild soap, pressure for bleeding, cold compress, elevation).
3. List critical red flags that require urgent medical attention (e.g. spreading redness, red streaks, heat, purulent discharge, deep wound needing stitches, fever, animal/human bite).
4. Maintain full context across continuous follow-up questions so the patient can ask follow-ups naturally (e.g. "Can I put an ointment?", "Should I keep it covered?").
5. Always clearly state: This is clinical awareness and first aid guidance, not a definitive medical diagnosis."""

def call_multimodal_clinical(
    prompt: str,
    image_b64: str = None,
    mime_type: str = "image/jpeg",
    history: list = None
) -> str:
    """
    Multimodal visual dermatology & wound clinical chat assistant with conversational memory.
    """
    # 1. If an image is attached, call Gemini Vision
    if image_b64 and GEMINI_API_KEY:
        # Strip header if present
        clean_b64 = image_b64
        if "base64," in clean_b64:
            clean_b64 = clean_b64.split("base64,")[1]

        # Format conversation history
        conv_text = ""
        if history:
            conv_text = "Prior Conversation History:\n" + "\n".join([
                f"{'Patient' if m.get('sender') == 'user' else 'HealthAssist'}: {m.get('text') or m.get('answer') or ''}"
                for m in history[-6:]
            ]) + "\n\n"

        full_prompt = f"{CLINICAL_IMAGE_SYSTEM_PROMPT}\n\n{conv_text}Current Patient Question: {prompt or 'Please examine this image and provide clinical observations, first aid, and what to watch out for.'}"

        for model in GEMINI_MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
            payload = {
                "contents": [{
                    "parts": [
                        {"inlineData": {"mimeType": mime_type, "data": clean_b64}},
                        {"text": full_prompt}
                    ]
                }],
                "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1000}
            }
            try:
                res = requests.post(url, json=payload, timeout=20)
                if res.status_code == 200:
                    data = res.json()
                    ans = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    if ans:
                        return ans
            except Exception as e:
                print(f"[Multimodal] Gemini {model} error: {e}")

    # 2. If no image or Gemini unavailable, use Groq LLM with conversation history
    if GROQ_API_KEY:
        try:
            messages = [{"role": "system", "content": CLINICAL_IMAGE_SYSTEM_PROMPT}]
            if history:
                for m in history[-6:]:
                    content = m.get("text") or m.get("answer") or ""
                    if content:
                        role = "user" if m.get("sender") == "user" else "assistant"
                        messages.append({"role": role, "content": content})
            messages.append({"role": "user", "content": prompt})

            payload = {
                "model": "qwen/qwen3.8-27b",
                "messages": messages,
                "temperature": 0.2,
                "max_tokens": 800
            }
            res = requests.post(
                GROQ_API_URL,
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json=payload,
                timeout=12
            )
            if res.status_code == 200:
                c = res.json()["choices"][0]["message"].get("content")
                if c:
                    return c.strip()
        except Exception as e:
            print(f"[Multimodal] Groq error: {e}")

    return "Please consult a healthcare professional for an in-person examination of your wound or skin condition."

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
