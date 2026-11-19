"""
Lab Report Analyzer — Extracts complete biomarkers from PDF and Image lab reports.
- Images: Gemini Vision (gemini-flash-lite-latest / gemini-flash-latest / gemini-3.8-flash)
- PDFs: pypdf text extraction + Groq LLM (qwen/qwen3.8-27b) / Gemini fallback
"""

import os
import json
import base64
import re
import requests
import pypdf
from dotenv import load_dotenv
from typing import Dict, Any, List

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
load_dotenv(os.path.join(base_dir, ".env"))
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

GEMINI_MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-3.8-flash"]

ANALYSIS_PROMPT = """You are a senior clinical pathologist analyzing an uploaded diagnostic laboratory report.

CRITICAL INSTRUCTIONS:
1. Extract EVERY SINGLE test biomarker shown anywhere in the report (CBC, Hematology, Biochemistry, Lipid profile, Thyroid, Urine, Liver, Kidney, etc.). Do not skip any row.
2. For each test, extract:
   - "test": Standard test name (e.g. "HB", "Total RBC", "HCT", "MCV", "MCH", "MCHC", "Platelets", "WBC", "Neutrophils", "Lymphocytes", "Eosinophils", "Monocytes", "ESR", "TSH")
   - "value": The measured value with its unit as written in the report (e.g. "13.9 g/dl", "5.7 10^3/uL", "12 %")
   - "normal_range": The reference range stated in the report (e.g. "12.0 - 16", "6 - 13", "2 - 6")
   - "status": Strictly compare value with normal_range and mark as "Normal", "Low", "High", or "Critical"
3. Extract "patient_name" and "lab_name" if present.
4. Write a comprehensive clinical "summary" explaining any out-of-range/abnormal markers (e.g. mild leukopenia, monocytosis) and what they signify clinically.
5. Provide actionable "dietary_tips" and lifestyle guidance.
6. Set "urgency": "ROUTINE_FOLLOWUP" or "ATTENTION_NEEDED" or "EMERGENCY".

Return ONLY valid JSON with this exact schema:
{
  "patient_name": "Mr. Ali Shah",
  "lab_name": "Labspot Diagnostic Laboratory",
  "tests": [
    {"test": "HB", "value": "13.9 g/dl", "normal_range": "12.0 - 16", "status": "Normal"},
    {"test": "WBC", "value": "5.7 10^3/uL", "normal_range": "6 - 13", "status": "Low"},
    {"test": "Monocytes", "value": "12 %", "normal_range": "2 - 6", "status": "High"}
  ],
  "summary": "Detailed medical interpretation...",
  "dietary_tips": "Dietary advice...",
  "urgency": "ROUTINE_FOLLOWUP"
}"""


def _call_groq(prompt: str) -> dict | None:
    """Call Groq LLM and parse JSON response."""
    if not GROQ_API_KEY:
        return None
    try:
        payload = {
            "model": "qwen/qwen3.8-27b",
            "messages": [
                {"role": "system", "content": "You are a clinical pathologist. Always respond with valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 3000,
        }
        res = requests.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json=payload,
            timeout=20,
        )
        if res.status_code == 200:
            msg = res.json()["choices"][0]["message"]
            raw = (msg.get("content") or msg.get("reasoning") or "").strip()
            raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
            raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
            match = re.search(r"\{[\s\S]*\}", raw)
            if match:
                return json.loads(match.group())
    except Exception as e:
        print(f"[Report Analyzer] Groq error: {e}")
    return None


def _call_gemini_vision(file_path: str, ext: str) -> tuple[dict | None, str]:
    """Use Gemini Vision for image files across prioritized models."""
    if not GEMINI_API_KEY:
        return None, ""

    try:
        with open(file_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
    except Exception as e:
        print(f"[Report Analyzer] Image read error: {e}")
        return None, ""

    mime = "image/png" if ext == ".png" else "image/jpeg"

    for model in GEMINI_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": [{
                "parts": [
                    {"inlineData": {"mimeType": mime, "data": b64}},
                    {"text": ANALYSIS_PROMPT}
                ]
            }],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.1,
                "maxOutputTokens": 3500
            }
        }
        try:
            res = requests.post(url, json=payload, timeout=25)
            if res.status_code == 200:
                data = res.json()
                raw = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
                raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
                match = re.search(r"\{[\s\S]*\}", raw)
                if match:
                    parsed = json.loads(match.group())
                    if parsed.get("tests"):
                        print(f"[Report Analyzer] Successfully extracted {len(parsed['tests'])} tests using {model}")
                        return parsed, model
        except Exception as e:
            print(f"[Report Analyzer] Gemini {model} error: {e}")

    return None, ""


def analyze_report_llm(file_path: str = None, text_content: str = None, mime_type: str = None) -> dict:
    """
    Extracts all biomarkers and clinical narrative from a lab report.
    """
    print(f"[Report Analyzer] analyze_report_llm called with file_path={file_path}, exists={os.path.exists(file_path) if file_path else False}")
    if file_path and os.path.exists(file_path):
        ext = os.path.splitext(file_path)[1].lower()
        print(f"[Report Analyzer] File ext={ext}, size={os.path.getsize(file_path)} bytes")

        # --- Image Lab Report (JPEG, PNG, WEBP) ---
        if ext in [".png", ".jpg", ".jpeg", ".webp"]:
            parsed, model_name = _call_gemini_vision(file_path, ext)
            print(f"[Report Analyzer] _call_gemini_vision returned model_name={model_name}, test_count={len(parsed.get('tests', [])) if parsed else 0}")
            if parsed and parsed.get("tests") and len(parsed["tests"]) > 0:
                return {
                    "success": True,
                    "model": f"Gemini Vision ({model_name})",
                    "data": parsed
                }

        # --- PDF Lab Report ---
        elif ext == ".pdf":
            try:
                reader = pypdf.PdfReader(file_path)
                pages_text = []
                for idx, page in enumerate(reader.pages):
                    t = page.extract_text()
                    if t:
                        pages_text.append(f"--- Page {idx + 1} ---\n{t.strip()}")
                pdf_text = "\n\n".join(pages_text)
                if pdf_text and len(pdf_text) > 40:
                    text_content = pdf_text
            except Exception as e:
                print(f"[Report Analyzer] PDF read error: {e}")

    # Process text content with Groq LLM (or Gemini fallback)
    if text_content and len(text_content.strip()) > 30:
        prompt = f"Lab Report Text Content:\n\n{text_content[:6000]}\n\n{ANALYSIS_PROMPT}"
        parsed = _call_groq(prompt)
        if parsed and parsed.get("tests") and len(parsed["tests"]) > 0:
            return {
                "success": True,
                "model": "Groq (qwen/qwen3.8-27b)",
                "data": parsed
            }

        # Fallback to Gemini text
        for model in GEMINI_MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
            try:
                res = requests.post(url, json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1}
                }, timeout=15)
                if res.status_code == 200:
                    raw = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    match = re.search(r"\{[\s\S]*\}", raw)
                    if match:
                        p = json.loads(match.group())
                        if p.get("tests"):
                            return {"success": True, "model": f"Gemini ({model})", "data": p}
            except Exception:
                pass

    return {
        "success": False,
        "error": "Could not extract test biomarkers from this file. Please ensure the image or PDF is clear and readable.",
        "data": {"tests": [], "summary": "", "dietary_tips": ""}
    }


def chat_about_report(report_data: dict, question: str) -> str:
    """
    Answers user questions specifically grounded in the analyzed report.
    """
    tests_summary = "\n".join([
        f"- {t.get('test')}: {t.get('value')} (Normal: {t.get('normal_range')}) -> Status: {t.get('status')}"
        for t in report_data.get("tests", [])
    ])

    context = f"""Patient Name: {report_data.get('patient_name', 'Patient')}
Lab: {report_data.get('lab_name', 'Diagnostic Lab')}
Extracted Test Biomarkers:
{tests_summary}

Clinical Summary:
{report_data.get('summary', '')}

Dietary Tips:
{report_data.get('dietary_tips', '')}
"""

    prompt = f"""Clinical Context of Patient's Lab Report:
{context}

Patient Question: {question}

Provide a concise, clear, and reassuring medical explanation based directly on their report. Mention specific biomarker values where relevant. If something is abnormal, explain what it means in plain English and advise them clearly."""

    # Call Groq
    if GROQ_API_KEY:
        try:
            payload = {
                "model": "qwen/qwen3.8-27b",
                "messages": [
                    {"role": "system", "content": "You are HealthAssist, an empathetic clinical diagnostics assistant helping a patient understand their lab test report."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.2,
                "max_tokens": 600
            }
            res = requests.post(GROQ_URL, headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}, json=payload, timeout=12)
            if res.status_code == 200:
                c = res.json()["choices"][0]["message"].get("content")
                if c:
                    return c.strip()
        except Exception as e:
            print(f"[Report Chat] Groq error: {e}")

    # Fallback to Gemini
    for model in GEMINI_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
        try:
            res = requests.post(url, json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=12)
            if res.status_code == 200:
                return res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception:
            pass

    return "Based on your report, please consult with your healthcare provider for an individualized clinical assessment."
