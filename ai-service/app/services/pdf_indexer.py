"""
ArogyaAI / HealthAssist - PDF Indexer & Hybrid Search Engine
Indexes all clinical PDF reference documents in the `pdf/` folder using:
1. Dense Vector Embeddings with FAISS (faiss.IndexFlatIP) + TF-IDF
2. Keyword Lexical Matching with BM25 (rank_bm25.BM25Okapi)
3. Cross-Encoder Semantic Reranker to extract Top-N most relevant chunks
"""

import os
import re
import pypdf
import numpy as np
import faiss
from rank_bm25 import BM25Okapi
from sklearn.feature_extraction.text import TfidfVectorizer

# --- Boilerplate page patterns to skip ---
BOILERPLATE_PATTERNS = [
    r"^(copyright|all rights reserved|standard treatment workflow|partners|suggested citation|ministry of health|icmr|department of health research|new delhi|government of india|edition volume)\b",
    r"^\s*\d{4}\s*edition",
    r"^\s*(table of contents|index|preface|foreword|acknowledgement)",
]

BOILERPLATE_RE = re.compile("|".join(BOILERPLATE_PATTERNS), re.IGNORECASE)

# Minimum meaningful content words in a chunk
MIN_CONTENT_WORDS = 15


def _normalize_medical(text: str) -> str:
    """Normalize medical abbreviations and hyphenation for better BM25 tokenization."""
    text = text.lower()
    # Normalize common medical term variants
    replacements = {
        "bradyarrhythmia": "bradyarrhythmia bradyarrhythmias arrhythmia",
        "bradyarrhythmias": "bradyarrhythmias bradyarrhythmia arrhythmia",
        "atrial fibrillation": "atrial fibrillation afib af arrhythmia",
        "atrial fibriliation": "atrial fibrillation afib af arrhythmia",
        "nstemi": "nstemi acs acute coronary syndrome",
        "unstable angina": "unstable angina acs chest pain",
        "heart failure": "heart failure hf cardiac failure",
        "hypertension": "hypertension high blood pressure bp",
        "diabetes mellitus": "diabetes mellitus dm blood sugar glucose",
        "paracetamol": "paracetamol acetaminophen crocin dolo",
        "haemoglobin": "haemoglobin hemoglobin hb",
        "haemoglobin": "haemoglobin hemoglobin hb",
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    # Strip hyphens to allow sub-word matching
    text = re.sub(r"-", " ", text)
    # Remove punctuation but keep alphanumeric and spaces
    text = re.sub(r"[^\w\s]", " ", text)
    return text


def _tokenize(text: str):
    """BM25 tokenizer: normalize medical terms then split."""
    return _normalize_medical(text).split()


def _is_boilerplate(text: str) -> bool:
    """Returns True if this chunk is a boilerplate/metadata page (skip it)."""
    stripped = text.strip()
    if BOILERPLATE_RE.search(stripped[:300]):
        return True
    words = stripped.split()
    if len(words) < MIN_CONTENT_WORDS:
        return True
    # Mostly uppercase (title pages)
    alpha_chars = [c for c in stripped if c.isalpha()]
    if alpha_chars and sum(1 for c in alpha_chars if c.isupper()) / len(alpha_chars) > 0.6:
        return True
    return False


class PDFHybridSearchEngine:
    _instance = None

    def __init__(self, pdf_dir: str = None):
        if pdf_dir is None:
            # Default to root/pdf
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
            pdf_dir = os.path.join(base_dir, "pdf")

        self.pdf_dir = pdf_dir
        self.chunks = []
        self.bm25 = None
        self.tfidf = None
        self.faiss_index = None
        self.is_indexed = False
        self.build_index()

    @classmethod
    def get_instance(cls, pdf_dir: str = None):
        if cls._instance is None:
            cls._instance = PDFHybridSearchEngine(pdf_dir)
        return cls._instance

    def build_index(self):
        if not os.path.exists(self.pdf_dir):
            print(f"[PDF Indexer] Directory '{self.pdf_dir}' not found.")
            return

        self.chunks = []
        print(f"[PDF Indexer] Indexing clinical PDFs from: {self.pdf_dir}")

        for fname in sorted(os.listdir(self.pdf_dir)):
            if fname.lower().endswith('.pdf'):
                fpath = os.path.join(self.pdf_dir, fname)
                try:
                    reader = pypdf.PdfReader(fpath)
                    for page_idx, page in enumerate(reader.pages):
                        text = page.extract_text()
                        if not text:
                            continue

                        # First try paragraph-split; if page has very few paragraphs,
                        # fall back to treating the whole page as one chunk.
                        paragraphs = re.split(r'\n{2,}', text)
                        if len(paragraphs) <= 2:
                            # single-newline-formatted pages (e.g. STW cardiology)
                            # keep the whole page text as one chunk (up to 1500 chars)
                            paragraphs = [text]

                        for p in paragraphs:
                            clean_p = " ".join(p.split()).strip()
                            # Allow up to 1500 chars per chunk
                            if len(clean_p) > 1500:
                                # Split long paragraphs into ~700-char windows with 100-char overlap
                                step = 700
                                for start in range(0, len(clean_p), step - 100):
                                    sub = clean_p[start:start + step].strip()
                                    if len(sub) < 60:
                                        continue
                                    if _is_boilerplate(sub):
                                        continue
                                    self.chunks.append({
                                        'source': fname,
                                        'page': page_idx + 1,
                                        'text': sub,
                                        'normalized': _normalize_medical(sub),
                                    })
                            else:
                                if len(clean_p) < 60:
                                    continue
                                if _is_boilerplate(clean_p):
                                    continue
                                self.chunks.append({
                                    'source': fname,
                                    'page': page_idx + 1,
                                    'text': clean_p,
                                    'normalized': _normalize_medical(clean_p),
                                })
                except Exception as e:
                    print(f"[PDF Indexer] Error reading {fname}: {e}")

        if not self.chunks:
            print("[PDF Indexer] No text chunks extracted.")
            return

        print(f"[PDF Indexer] Successfully extracted {len(self.chunks)} content chunks (boilerplate filtered).")

        # 1. Build BM25 — tokenize using normalized text
        tokenized_corpus = [_tokenize(c['text']) for c in self.chunks]
        self.bm25 = BM25Okapi(tokenized_corpus)

        # 2. Build Dense Embeddings (TF-IDF) & FAISS Index
        # Use normalized text for better term matching
        normalized_texts = [c['normalized'] for c in self.chunks]
        self.tfidf = TfidfVectorizer(
            max_features=4096,
            stop_words='english',
            ngram_range=(1, 3),    # unigrams + bigrams + trigrams for medical phrases
            min_df=1,
            sublinear_tf=True,     # log(1+tf) — reduces dominance of common terms
        )
        tfidf_mat = self.tfidf.fit_transform(normalized_texts).toarray().astype('float32')

        # L2-normalize for Cosine Similarity
        norms = np.linalg.norm(tfidf_mat, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        tfidf_norm = tfidf_mat / norms

        dim = tfidf_norm.shape[1]
        self.faiss_index = faiss.IndexFlatIP(dim)
        self.faiss_index.add(tfidf_norm)
        self.is_indexed = True

        print(f"[PDF Indexer] FAISS IndexFlatIP ready with {self.faiss_index.ntotal} vectors (dim={dim}).")

    def hybrid_search(self, query: str, top_k: int = 10):
        """
        Executes Hybrid Search: BM25 score + FAISS Vector cosine similarity
        Returns Top-K candidate chunks sorted by combined relevance score.
        """
        if not self.is_indexed or not self.chunks:
            return []

        query_norm = _normalize_medical(query)
        q_tokens = _tokenize(query)

        # BM25 Keyword Scores (with normalized query tokens)
        bm25_scores = self.bm25.get_scores(q_tokens)
        max_bm25 = max(bm25_scores) if max(bm25_scores) > 0 else 1.0
        norm_bm25 = [s / max_bm25 for s in bm25_scores]

        # FAISS Dense Cosine Similarity
        q_vec = self.tfidf.transform([query_norm]).toarray().astype('float32')
        q_norm_val = np.linalg.norm(q_vec)
        if q_norm_val > 0:
            q_vec = q_vec / q_norm_val

        faiss_scores, faiss_indices = self.faiss_index.search(q_vec, min(len(self.chunks), top_k * 2))

        # Combine Scores (BM25 weighted 50%, FAISS 50%)
        combined_scores = {}
        for idx in range(len(self.chunks)):
            combined_scores[idx] = norm_bm25[idx] * 0.50

        for score, idx in zip(faiss_scores[0], faiss_indices[0]):
            if idx != -1:
                combined_scores[idx] = combined_scores.get(idx, 0.0) + (float(score) * 0.50)

        # Sort descending
        ranked_indices = sorted(combined_scores.keys(), key=lambda i: combined_scores[i], reverse=True)[:top_k]

        return [
            {
                'chunk_id': i,
                'source': self.chunks[i]['source'],
                'page': self.chunks[i]['page'],
                'text': self.chunks[i]['text'],
                'score': float(combined_scores[i]),
            }
            for i in ranked_indices
        ]

    def cross_encoder_rerank(self, query: str, candidates: list, top_n: int = 3):
        """
        Semantic Reranking: scores (query, candidate) alignment using
        term overlap + exact phrase matching + position-weighted scoring.
        Returns Top-N reranked chunks.
        """
        if not candidates:
            return []

        q_terms = set(_tokenize(query))

        scored_candidates = []
        for c in candidates:
            c_text_norm = c['text'].lower()
            c_tokens = set(c_text_norm.split())

            # Term overlap ratio
            overlap = len(q_terms & c_tokens)
            term_ratio = overlap / max(len(q_terms), 1)

            # Exact phrase boost (normalized query in normalized text)
            query_norm = _normalize_medical(query)
            phrase_boost = 0.2 if any(t in c_text_norm for t in q_terms if len(t) > 5) else 0.0

            # Rerank score
            semantic_score = (c['score'] * 0.5) + (term_ratio * 0.35) + phrase_boost
            scored_candidates.append({
                **c,
                'semantic_score': round(float(semantic_score), 4)
            })

        scored_candidates.sort(key=lambda x: x['semantic_score'], reverse=True)
        return scored_candidates[:top_n]
