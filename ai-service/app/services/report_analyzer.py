"""
Lab Report Analyzer — Extracts text from PDF/image and uses Groq to analyze biomarkers.
Primary: pypdf text extraction + Groq LLM (fast, no timeout)
Fallback: Gemini multimodal for image files
"""

import os
import json
import base64
import re
import requests
import pypdf
from dotenv import load_dotenv
from typing import Dict, Any

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
load_dotenv(os.path.join(base_dir, ".env"))
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={GEMINI_API_KEY}"

ANALYSIS_PROMPT = """You are a senior clinical pathologist analyzing a patient's lab report.

Extract ALL test results from the report text below. For each test found, extract:
- test: Standard medical test name (e.g. Hemoglobin, WBC, Platelets, Fasting Blood Sugar, HbA1c, Creatinine, Total Cholesterol etc.)
- value: The measured value with its unit as written in the report (e.g. "10.2 g/dL")
- normal_range: The reference range from the report (e.g. "12.0 - 15.5 g/dL")
- status: "Normal", "Low", "High", or "Critical" based on comparing value to range

Then write a brief patient-friendly clinical summary of the findings.

IMPORTANT: Only extract tests that are ACTUALLY present in the report text. Do NOT invent values.

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "tests": [
    {"test": "Hemoglobin", "value": "10.2 g/dL", "normal_range": "12.0 - 15.5 g/dL", "status": "Low"}
  ],
  "summary": "Brief explanation of abnormal results and recommended follow-up.",
  "dietary_tips": "Specific dietary advice based on the findings.",
  "urgency": "ROUTINE_FOLLOWUP"
}"""


def _call_groq(prompt: str) -> dict | None:
    """Call Groq LLM and parse JSON response."""
    try:
        payload = {
            "model": "qwen/qwen3.8-27b",
            "messages": [
                {"role": "system", "content": "You are a clinical pathologist. Always respond with valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 2000,
        }
        res = requests.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json=payload,
            timeout=15,
        )
        if res.status_code == 200:
            msg = res.json()["choices"][0]["message"]
            raw = (msg.get("content") or msg.get("reasoning") or "").strip()
            # Strip markdown code fences if present
            raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
            raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
            # Find JSON object
            match = re.search(r"\{[\s\S]*\}", raw)
            if match:
                return json.loads(match.group())
    except Exception as e:
        print(f"[Report Analyzer] Groq error: {e}")
    return None


def _call_gemini_vision(file_path: str, ext: str) -> dict | None:
    """Use Gemini multimodal for image files (fallback)."""
    try:
        with open(file_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        mime = "image/png" if ext == ".png" else "image/jpeg"
        payload = {
            "contents": [{"parts": [
                {"inlineData": {"mimeType": mime, "data": b64}},
                {"text": ANALYSIS_PROMPT},
            ]}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 2048}
        }
        res = requests.post(GEMINI_URL, json=payload, timeout=20)
        if res.status_code == 200:
            raw = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            match = re.search(r"\{[\s\S]*\}", raw)
            if match:
                return json.loads(match.group())
    except Exception as e:
        print(f"[Report Analyzer] Gemini vision error: {e}")
    return None


def analyze_report_llm(file_path: str = None, text_content: str = None, mime_type: str = None) -> dict:
    """
    Analyze a lab report from a file or text.
    - PDF: extract text with pypdf → Groq LLM
    - Image: Groq vision description → Groq LLM (or Gemini fallback)
    - Text: directly analyze with Groq
    """
    report_text = ""
    model_used = "groq-qwen3.8-27b"

    if file_path and os.path.exists(file_path):
        ext = os.path.splitext(file_path)[1].lower()

        # --- PDF: extract text ---
        if ext == ".pdf":
            try:
                reader = pypdf.PdfReader(file_path)
                pages_text = []
                for page in reader.pages:
                    t = page.extract_text()
                    if t:
                        pages_text.append(t.strip())
                report_text = "\n\n".join(pages_text)
                print(f"[Report Analyzer] Extracted {len(report_text)} chars from PDF ({len(reader.pages)} pages)")
            except Exception as e:
                print(f"[Report Analyzer] PDF read error: {e}")

        # --- Image: try Gemini vision first ---
        elif ext in [".png", ".jpg", ".jpeg", ".webp"]:
            parsed = _call_gemini_vision(file_path, ext)
            if parsed and parsed.get("tests"):
                return {"success": True, "model": "gemini-3.8-flash", "data": parsed}
            # Gemini failed — describe we have an image
            report_text = "[Image file uploaded — please analyze this medical report image for all biomarker test results, values, units, reference ranges and status.]"
            model_used = "groq-qwen3.8-27b (image fallback)"

    elif text_content:
        report_text = text_content

    if not report_text:
        return _error_response("Could not extract text from the uploaded file.")

    # Analyze with Groq
    prompt = f"Lab Report Content:\n\n{report_text[:4000]}\n\n{ANALYSIS_PROMPT}"
    parsed = _call_groq(prompt)

    if parsed and parsed.get("tests") and len(parsed["tests"]) > 0:
        return {"success": True, "model": model_used, "data": parsed}

    # If Groq returned empty tests, it means no recognizable report data
    return _error_response("No biomarker data could be extracted from this file. Please upload a blood/lab report PDF.")


def _error_response(msg: str) -> dict:
    return {
        "success": False,
        "model": "none",
        "error": msg,
        "data": {"tests": [], "summary": msg, "dietary_tips": "", "urgency": "NONE"}
    }
