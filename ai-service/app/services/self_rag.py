"""
Self-RAG Workflow - Optimized for minimal LLM calls.
Implements the full state machine:
  __start__ → decide_retrieval → retrieve → is_relevant → generate_from_context
            → is_sup → accept_answer → is_use → END → __end__
            (fallback) → web_search → generate_from_web → __end__
"""

import re
import requests
from typing import Dict, Any, List
from app.services.pdf_indexer import PDFHybridSearchEngine
from app.services.llm_client import call_llm

MEDICAL_KEYWORDS = {
    "symptom", "symptoms", "disease", "treatment", "drug", "medicine", "tablet",
    "fever", "pain", "chest", "cough", "diabetes", "heart", "blood", "pressure",
    "cholesterol", "kidney", "liver", "infection", "dengue", "malaria", "asthma",
    "stroke", "cancer", "cardiolog", "bradyarrhythmia", "hypertension", "insulin",
    "dose", "dosage", "antibiotic", "paracetamol", "aspirin", "nlem", "formulary",
    "prescription", "therapy", "diagnos", "clinical", "patient", "medic", "health",
    "anaemia", "anemia", "hemoglobin", "platelet", "glucose", "hba1c", "sign", "signs",
    "cause", "causes", "prevent", "prevention", "deficiency", "vitamin", "mineral",
    "diet", "nutrition", "obesity", "thyroid", "malnutrition", "dehydration",
}

GREETINGS = {"hi", "hello", "hey", "who are you", "what can you do", "thank you", "bye", "thanks"}

# Phrases that indicate the LLM found nothing useful in the PDF context
NO_INFO_PHRASES = [
    "no information", "not included", "not provided", "not detailed", "not found",
    "not available", "not contain", "does not contain", "does not detail",
    "not mentioned", "not specified", "no specific", "not listed",
    "cannot find", "unable to find", "not present in", "not in the provided",
    "no details", "not cover", "does not cover",
]


def _llm_found_nothing(answer: str) -> bool:
    """Returns True if the LLM said there's no info in the PDF context."""
    low = answer.lower()
    return any(phrase in low for phrase in NO_INFO_PHRASES)


def _web_search(query: str) -> List[Dict]:
    """
    DuckDuckGo Instant Answer API — free, no key needed.
    Returns a list of text snippets from web results.
    """
    results = []
    try:
        # DuckDuckGo abstract search
        url = "https://api.duckduckgo.com/"
        params = {
            "q": query + " medical",
            "format": "json",
            "no_html": "1",
            "skip_disambig": "1",
        }
        r = requests.get(url, params=params, timeout=6)
        if r.status_code == 200:
            data = r.json()
            # Abstract (Wikipedia-sourced)
            abstract = data.get("Abstract", "").strip()
            if abstract:
                results.append({
                    "source": data.get("AbstractSource", "Web"),
                    "url": data.get("AbstractURL", ""),
                    "text": abstract,
                })
            # Related topics
            for topic in data.get("RelatedTopics", [])[:4]:
                text = topic.get("Text", "").strip()
                if text and len(text) > 40:
                    results.append({
                        "source": "DuckDuckGo",
                        "url": topic.get("FirstURL", ""),
                        "text": text,
                    })
    except Exception as e:
        print(f"[Self-RAG] Web search error: {e}")

    return results[:4]  # max 4 snippets


class SelfRAGWorkflow:
    def __init__(self):
        self.search_engine = PDFHybridSearchEngine.get_instance()

    def run(self, user_query: str) -> Dict[str, Any]:
        trace = ["__start__"]
        q = user_query.strip()
        q_lower = q.lower()

        # ── decide_retrieval ────────────────────────────────────────────────
        trace.append("decide_retrieval")
        needs_retrieval = (
            any(kw in q_lower for kw in MEDICAL_KEYWORDS) or len(q.split()) > 4
        ) and q_lower not in GREETINGS

        if not needs_retrieval:
            trace.append("generate_direct")
            answer = call_llm(
                f"You are HealthAssist. Reply briefly and helpfully to: \"{q}\"",
                max_tokens=150,
            )
            trace.append("__end__")
            return self._result(q, answer, [], [], trace, source="direct")

        # ── retrieve ────────────────────────────────────────────────────────
        trace.append("retrieve")
        candidates = self.search_engine.hybrid_search(q, top_k=8)
        top3 = self.search_engine.cross_encoder_rerank(q, candidates, top_n=3)

        # ── is_relevant ─────────────────────────────────────────────────────
        trace.append("is_relevant")
        pdf_relevant = bool(top3 and top3[0].get("semantic_score", 0) >= 0.08)

        if not pdf_relevant:
            trace.append("rewrite_question")
            rewritten = " ".join(q.split()[:6]) + " clinical guideline treatment"
            candidates = self.search_engine.hybrid_search(rewritten, top_k=8)
            top3 = self.search_engine.cross_encoder_rerank(rewritten, candidates, top_n=3)
            pdf_relevant = bool(top3 and top3[0].get("semantic_score", 0) >= 0.08)

        # ── generate_from_context ───────────────────────────────────────────
        pdf_answer = None
        if pdf_relevant:
            trace.append("generate_from_context")
            context_str = "\n\n".join([
                f"[{d['source']}, P{d['page']}]: {d['text'][:600]}" for d in top3
            ])
            pdf_answer = call_llm(
                f"Clinical References:\n{context_str}\n\nQuestion: {q}\n\nAnswer concisely and accurately based on the references:",
                system_prompt="You are HealthAssist, a clinical decision-support AI. Answer based on the provided references. If the references don't contain relevant info, say ONLY: 'NOT_IN_PDF'",
                temperature=0.2,
                max_tokens=450,
            )

        # ── is_sup ──────────────────────────────────────────────────────────
        trace.append("is_sup")
        pdf_useful = (
            pdf_answer is not None
            and len(pdf_answer.split()) > 15
            and "unavailable" not in pdf_answer.lower()
            and "NOT_IN_PDF" not in pdf_answer
            and not _llm_found_nothing(pdf_answer)
        )

        if pdf_useful:
            # ── accept_answer → is_use → END ────────────────────────────────
            trace.append("accept_answer")
            trace.append("is_use")
            trace.append("END")
            trace.append("__end__")
            citations = [f"{d['source']} (Page {d['page']})" for d in top3]
            return self._result(q, pdf_answer, top3, citations, trace, source="pdf")

        # ── PDF didn't have enough info → web_search ────────────────────────
        trace.append("web_search")
        web_results = _web_search(q)

        if web_results:
            trace.append("generate_from_web")
            web_context = "\n\n".join([
                f"[{r['source']}]: {r['text']}" for r in web_results
            ])
            web_answer = call_llm(
                f"Web Search Results:\n{web_context}\n\nQuestion: {q}\n\nProvide a clear, helpful medical answer based on the above:",
                system_prompt="You are HealthAssist, a trusted health assistant. Summarize the web search results into a clear, accurate answer. Add a note that users should consult a doctor.",
                temperature=0.3,
                max_tokens=400,
            )

            is_web_useful = len(web_answer.split()) > 15 and "unavailable" not in web_answer.lower()
            if is_web_useful:
                trace.append("is_use")
                trace.append("END")
                trace.append("__end__")
                web_citations = [f"{r['source']} (Web)" for r in web_results if r.get("source")]
                return self._result(q, web_answer, [], web_citations, trace, source="web")

        # ── generate_direct as final fallback ───────────────────────────────
        trace.append("generate_direct")
        direct_answer = call_llm(
            f"Answer this health question clearly and concisely: {q}",
            system_prompt="You are HealthAssist. Provide accurate general health information and always advise consulting a doctor for diagnosis.",
            temperature=0.3,
            max_tokens=400,
        )
        trace.append("is_use")
        trace.append("END")
        trace.append("__end__")
        return self._result(q, direct_answer, [], ["Clinical Health Reference"], trace, source="direct")

    def _result(self, q, answer, top3, citations, trace, source="pdf"):
        verification = {
            "pdf": "Self-RAG (FAISS + BM25 Hybrid + Cross-Encoder Reranking)",
            "web": "Self-RAG (Web Search Augmented)",
            "direct": "Self-RAG (Direct LLM Generation)",
        }.get(source, "Self-RAG")

        return {
            "success": True,
            "query": q,
            "answer": answer,
            "citations": citations,
            "top3_sources": [
                {"source": d["source"], "page": d["page"], "snippet": d["text"][:200] + "..."}
                for d in top3
            ],
            "workflow_trace": trace,
            "verification": verification,
            "source_type": source,
        }
