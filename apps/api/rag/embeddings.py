"""Embedding providers behind one interface.

- `e5` (default): intfloat/multilingual-e5-small, run locally through fastembed (ONNX, no
  PyTorch). Works for English, Hindi/Hinglish and Japanese with no API key. ~465 MB download
  on first use, cached in apps/api/.cache/models.
- `hash`: deterministic bag-of-words vectors for tests and offline CI. Not for real use.

A hosted provider (for example Voyage) can be added by implementing `EmbeddingProvider` and
registering it in `PROVIDERS`; select it with RAG_EMBEDDINGS. Anthropic has no embeddings API.
"""

from __future__ import annotations

import hashlib
import os
import re
from functools import lru_cache
from typing import Protocol

import numpy as np

from . import MODEL_CACHE_DIR


class EmbeddingProvider(Protocol):
    name: str
    dim: int

    def embed_documents(self, texts: list[str]) -> np.ndarray: ...

    def embed_query(self, text: str) -> np.ndarray: ...


def _normalise(m: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(m, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return (m / norms).astype("float32")


class E5Provider:
    """multilingual-e5 expects 'query: ' / 'passage: ' prefixes."""

    name = "intfloat/multilingual-e5-small"
    dim = 384

    def __init__(self) -> None:
        os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
        from fastembed import TextEmbedding
        from fastembed.common.model_description import ModelSource, PoolingType

        if self.name not in {m["model"] for m in TextEmbedding.list_supported_models()}:
            TextEmbedding.add_custom_model(
                model=self.name,
                pooling=PoolingType.MEAN,
                normalization=True,
                sources=ModelSource(hf=self.name),
                dim=self.dim,
                model_file="onnx/model.onnx",
            )
        self._model = TextEmbedding(self.name, cache_dir=str(MODEL_CACHE_DIR))

    def embed_documents(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, self.dim), dtype="float32")
        return _normalise(np.array(list(self._model.embed([f"passage: {t}" for t in texts]))))

    def embed_query(self, text: str) -> np.ndarray:
        return _normalise(np.array(list(self._model.embed([f"query: {text}"]))))[0]


TOKEN = re.compile(r"\w+", re.UNICODE)


class HashProvider:
    """Deterministic hashing-trick embeddings: identical text → identical vector."""

    name = "hash-256"
    dim = 256

    def _vec(self, text: str) -> np.ndarray:
        v = np.zeros(self.dim, dtype="float32")
        for tok in TOKEN.findall(text.lower()):
            h = int(hashlib.md5(tok.encode("utf8")).hexdigest(), 16)
            v[h % self.dim] += 1.0 if (h >> 8) % 2 else -1.0
        return v

    def embed_documents(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, self.dim), dtype="float32")
        return _normalise(np.stack([self._vec(t) for t in texts]))

    def embed_query(self, text: str) -> np.ndarray:
        return _normalise(self._vec(text)[None, :])[0]


PROVIDERS = {"e5": E5Provider, "hash": HashProvider}


@lru_cache(maxsize=4)
def get_provider(name: str | None = None) -> EmbeddingProvider:
    key = (name or os.getenv("RAG_EMBEDDINGS") or "e5").strip().lower()
    if key not in PROVIDERS:
        raise ValueError(f"Unknown RAG_EMBEDDINGS={key!r}; choose one of {sorted(PROVIDERS)}")
    return PROVIDERS[key]()
