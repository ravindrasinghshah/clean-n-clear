"""Prompt Engineer node: rewrite the PromptPair to close the graded gaps (OpenAI).

Inputs: the current PromptPair, the grader's gap manifest, the curated Gemini
prompting guide, the target schema, and the non-negotiable safety constraint.
Output: a new PromptPair (with rationale, kept in the log).

The safety framing is enforced twice: stated as a hard invariant in the
engineer's instructions, and heuristically checked on the result. A pair that
fails the check gets one corrective retry; if it still fails, the previous
prompts are kept (no-op iteration) rather than letting a critical defect
propagate — the plateau guard will end the loop if this repeats.

The engineer's system prompt, safety constraint, and target-schema text come
from config.yaml's `prompts` section (RunConfig.agent_prompts) — edit them
there, not here. engineer_system is a template with {safety} and {guides}
placeholders filled in below.
"""

from __future__ import annotations

import logging

from openai import OpenAI

from optimizer.clients import agent_client
from optimizer.schemas import EngineerOutput, OptimizerState, PromptPair

log = logging.getLogger("optimizer.engineer")


def _passes_safety(pair: PromptPair) -> bool:
    """Cheap heuristic guard on the safety invariant.

    Checks that the combined prompt text still mentions the cosmetic scope, the
    no-diagnosis rule, and the unknown-for-low-confidence rule. A real breach of
    framing would drop at least one of these tokens.
    """
    text = (pair.system_instruction + " " + pair.user_prompt).lower()
    return "cosmetic" in text and "diagnos" in text and "unknown" in text


def _request_rewrite(
    client: OpenAI, model: str, user_message: str, system_text: str, extra: dict
) -> EngineerOutput:
    """One structured-output rewrite call."""
    completion = client.chat.completions.parse(
        model=model,
        messages=[
            {"role": "system", "content": system_text},
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
    agent_prompts = config.agent_prompts
    system_text = agent_prompts.engineer_system.format(
        safety=agent_prompts.engineer_safety_constraint, guides=config.guides_text
    )
    user_message = (
        f"{agent_prompts.engineer_target_schema}\n\n"
        f"# Current system_instruction\n{state['prompts'].system_instruction}\n\n"
        f"# Current user_prompt\n{state['prompts'].user_prompt}\n\n"
        f"# Gap manifest (overall score {grade.overall_score:.1f}/100)\n"
        f"{manifest_text}\n\n"
        "Rewrite both prompts to close these gaps. Return the full new prompts."
    )

    client, extra = agent_client(config)
    model = config.local_model or config.agent_model
    output = _request_rewrite(client, model, user_message, system_text, extra)
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
            system_text,
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
