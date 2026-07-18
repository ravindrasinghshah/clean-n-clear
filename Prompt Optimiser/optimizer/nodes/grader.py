"""Grader node: score this iteration's outputs against the criteria (OpenAI).

Deliberate blindness: the grader sees the criteria, the target schema/enums,
this iteration's outputs, and the previous iteration's outputs + score. It
never sees the prompts — it grades results, not intent. If ground-truth labels
exist (test_images/labels.json) they are included for accuracy assessment.

The grader's system prompt and target-schema text come from config.yaml's
`prompts` section (RunConfig.agent_prompts) — edit them there, not here.
"""

from __future__ import annotations

import json
import logging

from optimizer.clients import agent_client
from optimizer.schemas import (
    BestRecord,
    GradeReport,
    ImageResult,
    OptimizerState,
)

log = logging.getLogger("optimizer.grader")


def _summarize_outputs(outputs: list[ImageResult]) -> str:
    """Compact JSON view of the batch for the grader prompt.

    Raw response text is included only when validation failed (truncated), so
    the grader can see what malformed output looked like without prompt bloat.
    """
    rows = []
    for out in outputs:
        row: dict = {"image": out.image_name}
        if out.parsed is not None:
            row["result"] = out.parsed.model_dump()
        elif out.validation_error is not None:
            row["validation_error"] = out.validation_error[:500]
            row["raw_response_excerpt"] = out.raw_text[:400]
        else:
            row["transport_error"] = out.error
        rows.append(row)
    return json.dumps(rows, indent=2)


def grader_node(state: OptimizerState) -> dict:
    """Grade the current outputs; update the best-so-far record."""
    config = state["config"]

    sections = [
        "# Grading criteria\n" + config.criteria_text,
        "# Target schema and enums\n" + config.agent_prompts.grader_target_schema,
    ]
    if config.labels_text:
        sections.append(
            "# Ground-truth labels (use for accuracy where applicable)\n"
            + config.labels_text
        )
    sections.append(
        "# This iteration's outputs\n" + _summarize_outputs(state["outputs"])
    )
    if state["prev_outputs"] is not None and state["prev_score"] is not None:
        sections.append(
            f"# Previous iteration (score {state['prev_score']:.1f})\n"
            + _summarize_outputs(state["prev_outputs"])
        )
    else:
        sections.append("# Previous iteration\nNone — this is the first graded run.")

    client, extra = agent_client(config)
    completion = client.chat.completions.parse(
        model=config.local_model or config.agent_model,
        messages=[
            {"role": "system", "content": config.agent_prompts.grader_system},
            {"role": "user", "content": "\n\n".join(sections)},
        ],
        response_format=GradeReport,
        **extra,
    )
    grade = completion.choices[0].message.parsed
    assert grade is not None, "OpenAI returned no parsed GradeReport (refusal?)"

    log.info(
        "Iteration %d graded: %.1f/100, trend=%s, %d gaps",
        state["iteration"],
        grade.overall_score,
        grade.trend,
        len(grade.manifest),
    )

    best = state["best"]
    if best is None or grade.overall_score > best.score:
        best = BestRecord(
            score=grade.overall_score,
            prompts=state["prompts"],
            phase=state["phase"],
            iteration=state["iteration"],
        )
        log.info("New best: %.1f (iteration %d, %s)", best.score, best.iteration, best.phase)

    return {"grade": grade, "best": best}
