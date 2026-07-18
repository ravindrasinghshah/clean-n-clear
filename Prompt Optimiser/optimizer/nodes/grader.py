"""Grader node: score this iteration's outputs against the criteria (OpenAI).

Deliberate blindness: the grader sees the criteria, the target schema/enums,
the test photos themselves, this iteration's outputs, and the previous
iteration's outputs + score. It never sees the prompts — it grades results,
not intent. Seeing the photos lets it judge whether an output matches what is
actually visible, not just whether it is well-formed.

If ground-truth labels exist (test_images/labels.json, mapping image filename
to a partial expected result) a deterministic accuracy report is computed here
in code — exact matches for skinType/faceType, Jaccard overlap for concerns —
and handed to the grader as authoritative, so accuracy scoring doesn't rest on
the judge's own reading of the labels.

The grader's system prompt and target-schema text come from config.yaml's
`prompts` section (RunConfig.agent_prompts) — edit them there, not here.
"""

from __future__ import annotations

import base64
import json
import logging

from optimizer.clients import agent_client
from optimizer.nodes.executor import load_test_images
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


def _accuracy_report(outputs: list[ImageResult], labels_text: str) -> str | None:
    """Deterministic accuracy vs ground truth, computed in code (not by the judge).

    Expects labels.json to map image filename -> partial expected result with
    any of skinType, faceType, concerns; only labeled fields are scored.
    skinType/faceType score as exact matches, concerns as Jaccard overlap; an
    image with no valid output counts as wrong on every labeled field. Returns
    a text block for the grader, or None when labels.json isn't in that shape.
    """
    try:
        labels = json.loads(labels_text)
        if not isinstance(labels, dict) or not all(
            isinstance(v, dict) for v in labels.values()
        ):
            raise ValueError("expected {image_name: {field: expected_value}}")
    except (json.JSONDecodeError, ValueError) as exc:
        log.warning(
            "labels.json not scoreable (%s) — grader gets the raw text only", exc
        )
        return None

    lines: list[str] = []
    skin_hits = skin_total = face_hits = face_total = 0
    jaccards: list[float] = []
    for out in outputs:
        expected = labels.get(out.image_name)
        if expected is None:
            continue
        checks: list[str] = []
        if out.parsed is None:
            checks.append("no valid output — every labeled field counts as wrong")
            skin_total += "skinType" in expected
            face_total += "faceType" in expected
            if "concerns" in expected:
                jaccards.append(0.0)
        else:
            if "skinType" in expected:
                skin_total += 1
                if out.parsed.skinType == expected["skinType"]:
                    skin_hits += 1
                    checks.append("skinType correct")
                else:
                    checks.append(
                        f"skinType wrong: got {out.parsed.skinType}, "
                        f"expected {expected['skinType']}"
                    )
            if "faceType" in expected:
                face_total += 1
                if out.parsed.faceType == expected["faceType"]:
                    face_hits += 1
                    checks.append("faceType correct")
                else:
                    checks.append(
                        f"faceType wrong: got {out.parsed.faceType}, "
                        f"expected {expected['faceType']}"
                    )
            if "concerns" in expected:
                got = set(out.parsed.concerns)
                want = set(expected["concerns"])
                overlap = len(got & want) / len(got | want) if got | want else 1.0
                jaccards.append(overlap)
                checks.append(
                    f"concerns overlap {overlap:.2f}: got {sorted(got)}, "
                    f"expected {sorted(want)}"
                )
        lines.append(f"- {out.image_name}: " + "; ".join(checks))

    if not lines:
        log.warning("labels.json has no entries matching the test image filenames")
        return None

    summary: list[str] = []
    if skin_total:
        summary.append(f"skinType {skin_hits}/{skin_total} correct")
    if face_total:
        summary.append(f"faceType {face_hits}/{face_total} correct")
    if jaccards:
        summary.append(f"concerns mean Jaccard {sum(jaccards) / len(jaccards):.2f}")
    unlabeled = len(outputs) - len(lines)
    if unlabeled:
        summary.append(f"{unlabeled} image(s) have no labels and are not scored here")
    return "Summary: " + "; ".join(summary) + "\n" + "\n".join(lines)


def _photo_parts(images_dir: str) -> list[dict]:
    """The test photos as data-URL image parts, each preceded by its filename
    so the grader can match photos to outputs."""
    parts: list[dict] = [
        {
            "type": "text",
            "text": "# Test photos (match to the outputs above by filename)",
        }
    ]
    for name, data, mime in load_test_images(images_dir):
        parts.append({"type": "text", "text": f"Photo {name}:"})
        parts.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{mime};base64,{base64.b64encode(data).decode()}"
                },
            }
        )
    return parts


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
        accuracy = _accuracy_report(state["outputs"], config.labels_text)
        if accuracy:
            sections.append(
                "# Deterministic accuracy vs ground truth\n"
                "Computed in code from the labels above — authoritative for "
                "accuracy scoring; do not re-derive or contradict these numbers.\n"
                + accuracy
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

    user_content = [
        {"type": "text", "text": "\n\n".join(sections)},
        *_photo_parts(config.images_dir),
    ]
    client, extra = agent_client(config)
    completion = client.chat.completions.parse(
        model=config.local_model or config.agent_model,
        messages=[
            {"role": "system", "content": config.agent_prompts.grader_system},
            {"role": "user", "content": user_content},
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
