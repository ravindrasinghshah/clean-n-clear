"""Grader node: score this iteration's outputs against the criteria (OpenAI).

Deliberate blindness: the grader sees the criteria, the target schema/enums,
this iteration's outputs, and the previous iteration's outputs + score. It
never sees the prompts — it grades results, not intent. If ground-truth labels
exist (test_images/labels.json) they are included for accuracy assessment.
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

_TARGET_SCHEMA = """\
class SkinAnalysisResult:
    skinType: one of oily, dry, combination, normal, sensitive, unknown
    faceType: one of oval, round, square, heart, oblong, unknown
    concerns: list drawn from acne-prone, redness, dark-spots, texture,
              fine-lines, dehydration, irritation, congestion
    confidence: float 0-1
    notes: list of strings (plain-language visible observations)
    safetyFlags: list of strings (must include a no-diagnosis statement)
"""

_SYSTEM = """\
You are a strict, evidence-driven evaluator for a skincare image-analysis system.
You grade a batch of model outputs (one per test image) against explicit criteria.
You do NOT see the prompt that produced the outputs — judge only the results.

Rules:
- Score every criterion from the criteria document 0-100, then give an overall
  0-100 score reflecting how close the batch is to ideal.
- Every gap in the manifest must cite concrete evidence: name the image and
  quote or describe the offending output. No vague gaps.
- A validation_error or transport error on any image is at least a major gap;
  schema/enum violations are critical.
- Return an EMPTY manifest only when the outputs genuinely meet all criteria —
  an empty manifest is the loop's stop signal.
- Set trend by comparing against the previous iteration's outputs and score when
  provided; use first_run when there is no previous data.
"""


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
        "# Target schema and enums\n" + _TARGET_SCHEMA,
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
            {"role": "system", "content": _SYSTEM},
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
