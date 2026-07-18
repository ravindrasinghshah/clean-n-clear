"""Recorder node: append the iteration record and persist after every cycle.

Two artifacts per run, both rewritten every iteration (≤ ~14 rows, so cheap):
- runs/<run_id>.parquet — pandas DataFrame, nested structures stored as JSON
  strings (parquet-friendly, greppable with pandas later).
- runs/<run_id>.jsonl — one full human-readable record per line, crash-safe.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from optimizer.schemas import IterationRecord, OptimizerState

log = logging.getLogger("optimizer.recorder")


def _to_row(record: IterationRecord) -> dict:
    """Flatten one record into a parquet-friendly DataFrame row."""
    outputs = record.outputs
    return {
        "iteration": record.iteration,
        "phase": record.phase,
        "model": record.model,
        "system_instruction": record.prompts.system_instruction,
        "user_prompt": record.prompts.user_prompt,
        "overall_score": record.grade.overall_score,
        "trend": record.grade.trend,
        "gap_count": len(record.grade.manifest),
        "valid_outputs": sum(1 for o in outputs if o.parsed is not None),
        "image_count": len(outputs),
        "prompt_tokens": sum(o.prompt_tokens for o in outputs),
        "output_tokens": sum(o.output_tokens for o in outputs),
        "per_criterion_json": record.grade.model_dump_json(include={"per_criterion_scores"}),
        "manifest_json": record.grade.model_dump_json(include={"manifest"}),
        "outputs_json": "[" + ",".join(o.model_dump_json() for o in outputs) + "]",
        "timestamp": record.timestamp,
    }


def recorder_node(state: OptimizerState) -> dict:
    """Append this cycle to history and rewrite parquet + JSONL on disk.

    Also rolls the current outputs/score into prev_* so the next grading cycle
    can compare against them.
    """
    config = state["config"]
    grade = state["grade"]
    assert grade is not None, "recorder_node requires a grade"

    record = IterationRecord(
        iteration=state["iteration"],
        phase=state["phase"],
        model=config.executor_model(state["phase"]),
        prompts=state["prompts"],
        outputs=state["outputs"],
        grade=grade,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
    history = state["history"] + [record]

    runs_dir = Path(config.runs_dir)
    runs_dir.mkdir(parents=True, exist_ok=True)
    frame = pd.DataFrame([_to_row(r) for r in history])
    frame.to_parquet(runs_dir / f"{config.run_id}.parquet", index=False)
    with open(runs_dir / f"{config.run_id}.jsonl", "w", encoding="utf-8") as handle:
        for r in history:
            handle.write(r.model_dump_json() + "\n")

    row = _to_row(record)
    log.info(
        "Recorded iteration %d [%s]: score %.1f, tokens in/out %d/%d",
        record.iteration,
        record.phase,
        grade.overall_score,
        row["prompt_tokens"],
        row["output_tokens"],
    )

    return {
        "history": history,
        "prev_outputs": state["outputs"],
        "prev_score": grade.overall_score,
    }
