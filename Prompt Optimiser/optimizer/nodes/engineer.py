"""Prompt Engineer node: rewrite the PromptPair to close the graded gaps (OpenAI).

Inputs: the current PromptPair, the grader's gap manifest, the curated Gemini
prompting guide, the target schema, and the non-negotiable safety constraint.
Output: a new PromptPair (with rationale, kept in the log).

The safety framing is enforced twice: stated as a hard invariant in the
engineer's instructions, and heuristically checked on the result. A pair that
fails the check gets one corrective retry; if it still fails, the previous
prompts are kept (no-op iteration) rather than letting a critical defect
propagate — the plateau guard will end the loop if this repeats.
"""

from __future__ import annotations

import logging

from openai import OpenAI

from optimizer.clients import agent_client
from optimizer.schemas import EngineerOutput, OptimizerState, PromptPair

log = logging.getLogger("optimizer.engineer")

_SAFETY_CONSTRAINT = """\
NON-NEGOTIABLE SAFETY INVARIANT — violating any point is a critical defect:
- Cosmetic-guidance-only positioning: the prompts must keep the assistant scoped
  to visible, cosmetic skin attributes for a US-market product.
- No medical diagnosis: the prompts must explicitly forbid diagnosing medical
  conditions or using diagnostic language.
- Low-confidence handling: the prompts must keep the "use unknown for low
  confidence" instruction.
- The JSON schema, field names, and allowed enum values must remain exactly as
  specified — the downstream app validates against them verbatim.
"""

_TARGET_SCHEMA = """\
Required JSON output (field names and enum values are a fixed contract):
  skinType: exactly one of oily,dry,combination,normal,sensitive,unknown
  faceType: exactly one of oval,round,square,heart,oblong,unknown
  concerns: array from acne-prone,redness,dark-spots,texture,fine-lines,dehydration,irritation,congestion
  confidence: number 0-1
  notes: array of strings
  safetyFlags: array of strings
"""

_SYSTEM = """\
You are an expert prompt engineer improving a two-part Gemini vision prompt
(system_instruction + user_prompt) for a skincare selfie analyzer. You receive
the current prompts and a graded gap manifest; produce an improved pair that
closes the gaps.

{safety}

Guidelines:
- Address every critical and major gap in the manifest; minors as space allows.
- Apply the attached Gemini prompting best practices.
- The two prompts work as a unit: role/scope/safety belongs in the system
  instruction; task steps, output schema, and enums belong in the user prompt.
- Keep prompts as short as they can be while doing the job — no filler.

# Gemini prompting best practices
{guides}
"""


def _passes_safety(pair: PromptPair) -> bool:
    """Cheap heuristic guard on the safety invariant.

    Checks that the combined prompt text still mentions the cosmetic scope, the
    no-diagnosis rule, and the unknown-for-low-confidence rule. A real breach of
    framing would drop at least one of these tokens.
    """
    text = (pair.system_instruction + " " + pair.user_prompt).lower()
    return "cosmetic" in text and "diagnos" in text and "unknown" in text


def _request_rewrite(
    client: OpenAI, model: str, user_message: str, guides: str, extra: dict
) -> EngineerOutput:
    """One structured-output rewrite call."""
    completion = client.chat.completions.parse(
        model=model,
        messages=[
            {
                "role": "system",
                "content": _SYSTEM.format(safety=_SAFETY_CONSTRAINT, guides=guides),
            },
            {"role": "user", "content": user_message},
        ],
        response_format=EngineerOutput,
        **extra,
    )
    output = completion.choices[0].message.parsed
    assert output is not None, "OpenAI returned no parsed EngineerOutput (refusal?)"
    return output


def engineer_node(state: OptimizerState) -> dict:
    """Produce the next PromptPair from the current pair + gap manifest."""
    config = state["config"]
    grade = state["grade"]
    assert grade is not None, "engineer_node requires a grade"

    manifest_text = "\n".join(
        f"- [{gap.severity}] {gap.gap}\n  evidence: {gap.evidence}\n"
        f"  direction: {gap.suggested_direction}"
        for gap in grade.manifest
    )
    user_message = (
        f"{_TARGET_SCHEMA}\n\n"
        f"# Current system_instruction\n{state['prompts'].system_instruction}\n\n"
        f"# Current user_prompt\n{state['prompts'].user_prompt}\n\n"
        f"# Gap manifest (overall score {grade.overall_score:.1f}/100)\n"
        f"{manifest_text}\n\n"
        "Rewrite both prompts to close these gaps. Return the full new prompts."
    )

    client, extra = agent_client(config)
    model = config.local_model or config.agent_model
    output = _request_rewrite(client, model, user_message, config.guides_text, extra)
    pair = output.as_pair()

    if not _passes_safety(pair):
        log.warning("Engineered prompts dropped safety framing — retrying once")
        output = _request_rewrite(
            client,
            model,
            user_message
            + "\n\nYour previous attempt DROPPED the safety framing (cosmetic-only "
            "scope, no-diagnosis rule, or unknown-for-low-confidence rule). That is "
            "a critical defect. Rewrite again with all three explicitly present.",
            config.guides_text,
            extra,
        )
        pair = output.as_pair()

    if not _passes_safety(pair):
        log.error(
            "Engineered prompts still missing safety framing after retry — "
            "keeping previous prompts for this iteration"
        )
        return {}

    log.info("Engineer rationale: %s", output.rationale)
    return {"prompts": pair}
