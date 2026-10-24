"""Structure-aware chunking: split on Markdown headings, keep the section path, then pack
sections into ~300-500 token chunks with a small overlap when a section is too long."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

TARGET_TOKENS = 300
MAX_TOKENS = 500
OVERLAP_TOKENS = 50

HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
# Japanese kana/kanji, Devanagari and Gujarati: roughly one token per character.
CJK = re.compile(r"[぀-ヿ㐀-鿿ऀ-ॿ઀-૿]")
PARA_BREAK = "\n\n"


def estimate_tokens(text: str) -> int:
    """Cheap, model-free estimate: ~1.3 tokens per word, ~1 per CJK/Indic character."""
    cjk = len(CJK.findall(text))
    words = len(CJK.sub(" ", text).split())
    return int(words * 1.3) + cjk


@dataclass
class Section:
    path: list[str]
    text: str


def split_sections(body: str) -> list[Section]:
    """Walk the Markdown, tracking the heading path. The H1 is the title, so it isn't in paths."""
    sections: list[Section] = []
    stack: list[tuple[int, str]] = []
    buf: list[str] = []

    def flush() -> None:
        text = "\n".join(buf).strip()
        if text:
            sections.append(Section([h for lvl, h in stack if lvl > 1], text))
        buf.clear()

    for line in body.splitlines():
        m = HEADING.match(line)
        if m:
            flush()
            level = len(m.group(1))
            while stack and stack[-1][0] >= level:
                stack.pop()
            stack.append((level, m.group(2)))
            continue
        buf.append(line)
    flush()
    return sections


def _paragraphs(text: str) -> list[str]:
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    out: list[str] = []
    for p in paras:
        if estimate_tokens(p) <= MAX_TOKENS:
            out.append(p)
            continue
        # A single huge paragraph: fall back to sentences/lines.
        piece: list[str] = []
        for part in re.split(r"(?<=[.!?。])\s+|\n", p):
            if piece and estimate_tokens(" ".join([*piece, part])) > TARGET_TOKENS:
                out.append(" ".join(piece))
                piece = []
            piece.append(part)
        if piece:
            out.append(" ".join(piece))
    return out


def _tail(text: str, tokens: int) -> str:
    words = text.split()
    keep = max(1, int(tokens / 1.3))
    return " ".join(words[-keep:])


@dataclass
class RawChunk:
    path: list[str]
    text: str


def _common_path(a: list[str], b: list[str]) -> list[str]:
    out: list[str] = []
    for x, y in zip(a, b):
        if x != y:
            break
        out.append(x)
    return out


def _label(path: list[str]) -> str:
    return f"[{' > '.join(path)}]\n" if path else ""


def chunk_sections(sections: list[Section]) -> list[RawChunk]:
    """Consecutive sections are packed together up to the target size (each keeps its heading
    label); a section longer than the maximum is split by paragraph with an overlap, so a fact
    cut at a boundary still appears whole in one chunk."""
    chunks: list[RawChunk] = []
    pending: RawChunk | None = None

    for sec in sections:
        if estimate_tokens(sec.text) > MAX_TOKENS:
            if pending:
                chunks.append(pending)
                pending = None
            current: list[str] = []
            for para in _paragraphs(sec.text):
                if current and estimate_tokens(PARA_BREAK.join([*current, para])) > TARGET_TOKENS:
                    chunks.append(RawChunk(sec.path, _label(sec.path) + PARA_BREAK.join(current)))
                    current = [_tail(current[-1], OVERLAP_TOKENS)]
                current.append(para)
            if current:
                chunks.append(RawChunk(sec.path, _label(sec.path) + PARA_BREAK.join(current)))
            continue

        text = _label(sec.path) + sec.text
        if pending and estimate_tokens(pending.text + PARA_BREAK + text) <= TARGET_TOKENS:
            pending = RawChunk(_common_path(pending.path, sec.path), pending.text + PARA_BREAK + text)
            continue
        if pending:
            chunks.append(pending)
        pending = RawChunk(sec.path, text)
    if pending:
        chunks.append(pending)
    return chunks


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf8")).hexdigest()[:16]
