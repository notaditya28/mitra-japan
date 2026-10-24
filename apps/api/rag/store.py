"""Local, file-based vector store: a FAISS inner-product index over normalised vectors, with
chunk metadata in JSON Lines next to it. No server, no account, nothing hosted.

Files in the index directory:
- chunks.jsonl   one Chunk per line, in index order
- vectors.npy    float32 matrix, row i = chunk i (kept so unchanged chunks are never re-embedded)
- faiss.index    the search index built from vectors.npy
- manifest.json  counts, hashes and the embedding model used
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import faiss
import numpy as np

from .schema import Chunk


@dataclass
class Hit:
    chunk: Chunk
    score: float


class FaissStore:
    def __init__(self, chunks: list[Chunk], vectors: np.ndarray, manifest: dict) -> None:
        if len(chunks) != len(vectors):
            raise ValueError("chunks and vectors are out of sync")
        self.chunks = chunks
        self.vectors = vectors.astype("float32")
        self.manifest = manifest
        self.index = faiss.IndexFlatIP(vectors.shape[1] if len(vectors) else int(manifest.get("dim", 1)))
        if len(self.vectors):
            self.index.add(self.vectors)

    # --- persistence -------------------------------------------------------------------

    def save(self, directory: Path) -> None:
        directory.mkdir(parents=True, exist_ok=True)
        with open(directory / "chunks.jsonl", "w", encoding="utf8") as f:
            for c in self.chunks:
                f.write(c.model_dump_json() + "\n")
        np.save(directory / "vectors.npy", self.vectors)
        faiss.write_index(self.index, str(directory / "faiss.index"))
        (directory / "manifest.json").write_text(
            json.dumps(self.manifest, indent=2, ensure_ascii=False), encoding="utf8"
        )

    @classmethod
    def load(cls, directory: Path) -> "FaissStore":
        manifest = json.loads((directory / "manifest.json").read_text(encoding="utf8"))
        with open(directory / "chunks.jsonl", encoding="utf8") as f:
            chunks = [Chunk.model_validate_json(line) for line in f if line.strip()]
        vectors = np.load(directory / "vectors.npy")
        return cls(chunks, vectors, manifest)

    @staticmethod
    def exists(directory: Path) -> bool:
        return all((directory / n).exists() for n in ("manifest.json", "chunks.jsonl", "vectors.npy"))

    # --- search ------------------------------------------------------------------------

    def search(self, query_vec: np.ndarray, k: int = 20) -> list[Hit]:
        if not self.chunks:
            return []
        scores, ids = self.index.search(query_vec.reshape(1, -1).astype("float32"), min(k, len(self.chunks)))
        return [Hit(self.chunks[i], float(s)) for s, i in zip(scores[0], ids[0]) if i >= 0]
