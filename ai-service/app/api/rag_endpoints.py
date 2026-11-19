"""
FastAPI Routes for Self-RAG Chatbot & Multimodal LLM Report Analyzer.
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import shutil
import tempfile
import os

from app.services.self_rag import SelfRAGWorkflow
from app.services.report_analyzer import analyze_report_llm, chat_about_report

router = APIRouter()
rag_engine = SelfRAGWorkflow()

class QueryRequest(BaseModel):
    query: str = Field(..., description="User symptom or general healthcare query")

class AnalyzeReportTextRequest(BaseModel):
    text: Optional[str] = None
    report_title: Optional[str] = "Clinical Diagnostic Report"

class ReportChatRequest(BaseModel):
    report_data: Dict[str, Any]
    question: str

@router.post("/rag/ask")
async def ask_self_rag(req: QueryRequest):
    """
    Executes the complete Self-RAG workflow:
    __start__ -> decide_retrieval -> retrieve -> is_relevant -> generate_from_context -> is_sup -> is_use -> __end__
    """
    try:
        result = rag_engine.run(req.query)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reports/analyze-llm")
async def analyze_report_upload(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None)
):
    """
    Multimodal LLM-powered lab report analyzer for images or PDF documents.
    """
    temp_path = None
    try:
        if file:
            suffix = os.path.splitext(file.filename)[1]
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                shutil.copyfileobj(file.file, tmp)
                temp_path = tmp.name

            result = analyze_report_llm(file_path=temp_path, mime_type=file.content_type)
        else:
            result = analyze_report_llm(text_content=text or "")

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@router.post("/reports/chat")
async def chat_report_endpoint(req: ReportChatRequest):
    """
    Answers questions grounded in the current lab report context.
    """
    try:
        reply = chat_about_report(req.report_data, req.question)
        return {"success": True, "answer": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
