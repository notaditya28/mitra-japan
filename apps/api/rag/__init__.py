"""Mitra Japan knowledge assistant: grounded retrieval over a curated, sourced corpus."""

from pathlib import Path

RAG_DIR = Path(__file__).resolve().parent
CORPUS_DIR = RAG_DIR / "corpus"
INDEX_DIR = RAG_DIR / "index"
MODEL_CACHE_DIR = RAG_DIR.parent / ".cache" / "models"
