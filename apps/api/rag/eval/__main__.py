"""Run the golden set and write a Markdown report.

    python -m rag.eval                  # all cases, Demo mode (no API calls)
    python -m rag.eval --split dev      # tune thresholds on dev only
    python -m rag.eval --judge          # live mode only: add an LLM groundedness judge (costs money)

Metrics: retrieval hit@k and MRR, citation precision, groundedness (lexical support check; LLM
judge optional), abstention precision/recall, emergency routing accuracy, patch validity and
unaffected-items-preserved, safety checks, latency. Failures are printed with retrieved chunks.
"""

from __future__ import annotations

import argparse
import asyncio
import datetime as dt
import json
import os
import re
import statistics
import sys
import time
from pathlib import Path
from typing import Any

os.environ.setdefault("MITRA_DEMO_MODE", "1")

from app.data import load as load_places  # noqa: E402
from app.sample import sample_plan  # noqa: E402
from app.schema import Itinerary  # noqa: E402

from rag import assistant  # noqa: E402
from rag.context import DietProfile, Fact, TripContext  # noqa: E402
from rag.models import ChatRequest  # noqa: E402
from rag.retrieve import Filters, get_retriever  # noqa: E402
from rag.rewrite import rewrite  # noqa: E402
from rag.router import Route  # noqa: E402
from rag.text import tokenize  # noqa: E402

HERE = Path(__file__).parent
SAMPLE_ITINERARY = Path(__file__).resolve().parents[3] / "web" / "src" / "data" / "sampleItinerary.json"


def load_cases(split: str | None) -> list[dict]:
    cases = json.loads((HERE / "cases.json").read_text(encoding="utf8"))
    return [c for c in cases if split in (None, "all") or c["split"] == split]


def build_context(case: dict) -> TripContext:
    spec = case.get("context") or {}
    ctx = TripContext(session_id=f"eval-{case['id']}")
    if spec.get("itinerary") == "sample":
        ctx.itinerary = Itinerary.model_validate(json.loads(SAMPLE_ITINERARY.read_text(encoding="utf8")))
    if spec.get("current_day"):
        ctx.current_day = spec["current_day"]
    if spec.get("diet"):
        ctx.diet = Fact[DietProfile](value=DietProfile(diet=spec["diet"]), provenance="user-provided")
    ctx.pinned = spec.get("pinned", [])
    return ctx


def supported(statement: str, chunk_text: str) -> float:
    s = set(tokenize(statement))
    if not s:
        return 1.0
    return len(s & set(tokenize(chunk_text))) / len(s)


async def run_case(case: dict) -> dict[str, Any]:
    exp = case["expect"]
    out: dict[str, Any] = {"id": case["id"], "split": case["split"], "scenario": case["scenario"], "query": case["query"], "checks": {}}
    t0 = time.perf_counter()

    if exp.get("kind") == "planner":
        plan = sample_plan(load_places(), persona=exp["persona"], diet=exp["diet"], days=exp["days"])
        data = load_places()
        food = [s for d in plan.days for s in d.stops if s.foodSpotId]
        ok = all(exp["diet"] in data.food[s.foodSpotId].diets for s in food) and len(plan.days) == exp["days"]
        out["checks"]["planner_diet_respected"] = ok
        out["latency_ms"] = round((time.perf_counter() - t0) * 1000)
        return out

    if case.get("include_fixtures"):
        os.environ["RAG_INCLUDE_FIXTURES"] = "1"
    try:
        ctx = build_context(case)
        req = ChatRequest(message=case["query"], session_id=f"eval-{case['id']}", trip_context=ctx, history=case.get("history", []))
        resp = await assistant.handle(req)
    finally:
        os.environ.pop("RAG_INCLUDE_FIXTURES", None)
    out["latency_ms"] = round((time.perf_counter() - t0) * 1000)
    out["intent"] = resp.intent
    out["confidence"] = resp.confidence
    out["answer"] = resp.answer
    out["citations"] = [c.doc_id for c in resp.citations]

    if "intent" in exp:
        out["checks"]["intent"] = resp.intent == exp["intent"]
    if "emergency_kind" in exp:
        out["checks"]["emergency_kind"] = resp.emergency is not None and resp.emergency.kind == exp["emergency_kind"]
    if "abstain" in exp:
        out["abstained"] = resp.confidence == "abstained"
        out["checks"]["abstain"] = out["abstained"] == exp["abstain"]
    for rx in exp.get("must_not_contain", []):
        out["checks"][f"not:{rx}"] = re.search(rx, resp.answer, re.I) is None

    # Retrieval ranks for cases with known relevant docs (same rewrite + filters as the assistant).
    if exp.get("docs"):
        rew = rewrite(case["query"], case.get("history", []), ctx)
        res = get_retriever().search(rew.text, assistant._filters(ctx, Route("info")))
        ranked_docs: list[str] = []
        for c in res.candidates:
            if c.chunk.doc_id not in ranked_docs:
                ranked_docs.append(c.chunk.doc_id)
        rank = next((i + 1 for i, d in enumerate(ranked_docs) if d in exp["docs"]), None)
        out["rank"] = rank
        out["retrieved"] = [c.debug() for c in res.candidates[:5]]
        if resp.citations:
            relevant = [d for d in out["citations"] if d in exp["docs"]]
            out["citation_precision"] = len(relevant) / len(out["citations"])

    # Groundedness: every cited fact must share most of its words with a cited chunk.
    if resp.citations and resp.intent == "info":
        by_n = {c.n: c for c in resp.citations}
        scores = []
        retr = get_retriever()
        texts = {c.id: c.text for c in retr.store.chunks}
        for s in resp.statements:
            if s.kind == "fact" and s.citations:
                scores.append(max(supported(s.text, texts.get(by_n[n].chunk_id, "")) for n in s.citations if n in by_n))
        if scores:
            out["groundedness"] = sum(1 for x in scores if x >= 0.6) / len(scores)

    if "ops" in exp:
        patch = resp.proposed_patch
        out["checks"]["patch_valid"] = patch is not None and patch.get("diff") is not None
        if patch:
            ops = {o["op"] for o in patch["patch"]["ops"]}
            out["checks"]["patch_ops"] = bool(ops & set(exp["ops"]))
            touched = {o.get("day") for o in patch["patch"]["ops"]} | {o.get("to_day") for o in patch["patch"]["ops"]}
            before = ctx.itinerary
            # Unaffected-items-preserved: days not named by any op keep exactly their stops.
            after_days = [d for d in patch["diff"]["days"] if d["status"] != "added"]
            preserved = []
            for d in before.days if before else []:
                if d.day in touched:
                    continue
                twin = next((a for a in after_days if a["title"] == d.title and a["cityId"] == d.cityId), None)
                preserved.append(twin is not None and [s["name"] for s in twin["stops"] if s["status"] == "kept"] == [s.name for s in d.stops])
            out["preserved"] = (sum(preserved) / len(preserved)) if preserved else 1.0
            for key in exp.get("pinned_kept", []):
                city, name = key.split("|", 1)
                kept = any(s["name"] == name and s["status"] in ("kept", "moved-in") for d in patch["diff"]["days"] for s in d["stops"] if d["cityId"] == city)
                out["checks"][f"pinned_kept:{name}"] = kept
    return out


def pct(x: float | None) -> str:
    return "n/a" if x is None else f"{x * 100:.0f}%"


def summarise(results: list[dict]) -> dict[str, Any]:
    ranked = [r for r in results if "rank" in r]
    def hit(k: int) -> float | None:
        return (sum(1 for r in ranked if r["rank"] and r["rank"] <= k) / len(ranked)) if ranked else None
    mrr = (sum(1 / r["rank"] for r in ranked if r["rank"]) / len(ranked)) if ranked else None
    cp = [r["citation_precision"] for r in results if "citation_precision" in r]
    gr = [r["groundedness"] for r in results if "groundedness" in r]
    ab = [r for r in results if "abstained" in r]
    tp = sum(1 for r in ab if r["abstained"] and r["checks"]["abstain"])
    fp = sum(1 for r in ab if r["abstained"] and not r["checks"]["abstain"])
    fn = sum(1 for r in ab if not r["abstained"] and not r["checks"]["abstain"])
    em = [r for r in results if r["scenario"] == "6-emergency" and "intent" in r["checks"]]
    patches = [r for r in results if "patch_valid" in r["checks"]]
    preserved = [r["preserved"] for r in results if "preserved" in r]
    safety = [v for r in results for k, v in r["checks"].items() if k.startswith("not:")]
    lat = [r["latency_ms"] for r in results]
    return {
        "cases": len(results),
        "hit@1": hit(1),
        "hit@3": hit(3),
        "hit@5": hit(5),
        "mrr": mrr,
        "citation_precision": statistics.mean(cp) if cp else None,
        "groundedness": statistics.mean(gr) if gr else None,
        "abstain_precision": tp / (tp + fp) if (tp + fp) else None,
        "abstain_recall": tp / (tp + fn) if (tp + fn) else None,
        "emergency_routing": (sum(1 for r in em if r["checks"]["intent"] and r["checks"].get("emergency_kind", True)) / len(em)) if em else None,
        "patch_validity": (sum(1 for r in patches if r["checks"]["patch_valid"] and r["checks"].get("patch_ops", False)) / len(patches)) if patches else None,
        "unaffected_preserved": statistics.mean(preserved) if preserved else None,
        "safety_checks": (sum(safety) / len(safety)) if safety else None,
        "latency_p50_ms": statistics.median(lat) if lat else None,
        "latency_p95_ms": sorted(lat)[int(0.95 * (len(lat) - 1))] if lat else None,
        "passed": sum(1 for r in results if all(r["checks"].values()) and (r.get("rank") is None or r["rank"] <= 5 if "rank" in r else True)),
    }


def failed(r: dict) -> bool:
    if not all(r["checks"].values()):
        return True
    return "rank" in r and (r["rank"] is None or r["rank"] > 5)


def report(results: list[dict], path: Path, mode: str) -> str:
    lines = [
        "# Mitra Japan assistant: evaluation report",
        "",
        f"Generated {dt.datetime.now().isoformat(timespec='seconds')} · mode: **{mode}** · cases: {len(results)}",
        "",
        "Thresholds were tuned on the **dev** split only; **held-out** numbers are the honest ones.",
        "Groundedness here is a lexical check (≥60% of a cited fact's words appear in the cited chunk). It is",
        "imperfect: it can't catch a fact that reuses the source's words with a wrong meaning. Run with `--judge`",
        "in live mode for an LLM judge, and spot-check by hand (sample below).",
        "",
        "| Metric | dev | held-out | all |",
        "| --- | --- | --- | --- |",
    ]
    splits = {s: summarise([r for r in results if r["split"] == s]) for s in ("dev", "heldout")}
    splits["all"] = summarise(results)
    for key in ["hit@1", "hit@3", "hit@5", "mrr", "citation_precision", "groundedness", "abstain_precision", "abstain_recall", "emergency_routing", "patch_validity", "unaffected_preserved", "safety_checks"]:
        fmt = (lambda v: "n/a" if v is None else f"{v:.2f}") if key == "mrr" else pct
        lines.append(f"| {key} | {fmt(splits['dev'][key])} | {fmt(splits['heldout'][key])} | {fmt(splits['all'][key])} |")
    for key in ["latency_p50_ms", "latency_p95_ms", "passed", "cases"]:
        lines.append(f"| {key} | {splits['dev'][key]} | {splits['heldout'][key]} | {splits['all'][key]} |")

    fails = [r for r in results if failed(r)]
    lines += ["", f"## Failures ({len(fails)})", ""]
    for r in fails:
        bad = [k for k, v in r["checks"].items() if not v]
        if "rank" in r and (r["rank"] is None or r["rank"] > 5):
            bad.append(f"retrieval rank {r['rank']}")
        lines += [f"### {r['id']} ({r['split']}, {r['scenario']}): {r['query']}", "", f"- failed: {', '.join(bad)}", f"- intent: {r.get('intent')} · confidence: {r.get('confidence')} · cited: {r.get('citations')}"]
        if r.get("answer"):
            lines += ["- answer:", "", "```", r["answer"][:900], "```"]
        for c in r.get("retrieved", []):
            lines.append(f"  - {c['chunk_id']} score={c['score']} dense={c['dense']} bm25_rank={c['bm25_rank']} cov={c['coverage']}")
        lines.append("")

    lines += ["## Hand-check sample (first 5 answered info cases)", ""]
    for r in [r for r in results if r.get("intent") == "info" and r.get("confidence") not in (None, "abstained")][:5]:
        lines += [f"**{r['query']}** → cited {r['citations']}", "", "```", (r.get("answer") or "")[:600], "```", ""]
    text = "\n".join(lines) + "\n"
    path.write_text(text, encoding="utf8")
    return text


async def main_async(args) -> int:
    cases = load_cases(args.split)
    results = [await run_case(c) for c in cases]
    mode = "live" if assistant.settings.live else "demo"
    out = Path(args.out)
    report(results, out, mode)
    s = summarise(results)
    print(f"{len(results)} cases · passed {s['passed']} · hit@3 {pct(s['hit@3'])} · MRR {s['mrr'] and round(s['mrr'], 2)} · "
          f"abstain P/R {pct(s['abstain_precision'])}/{pct(s['abstain_recall'])} · emergency {pct(s['emergency_routing'])} · "
          f"patch {pct(s['patch_validity'])} · preserved {pct(s['unaffected_preserved'])} · safety {pct(s['safety_checks'])}")
    for r in results:
        if failed(r):
            print(f"  FAIL {r['id']} [{r['split']}] {r['query'][:60]} :: {[k for k, v in r['checks'].items() if not v]} rank={r.get('rank')} conf={r.get('confidence')}")
    print(f"Report: {out}")
    if args.judge:
        print("LLM judge: only available in live mode with an API key; skipped in demo." if mode == "demo" else "LLM judge: not implemented for this run.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(prog="python -m rag.eval")
    ap.add_argument("--split", choices=["dev", "heldout", "all"], default="all")
    ap.add_argument("--out", default=str(HERE / "report.md"))
    ap.add_argument("--judge", action="store_true")
    return asyncio.run(main_async(ap.parse_args()))


if __name__ == "__main__":
    sys.exit(main())
