"""Executor node: run the current PromptPair against every test image on Gemini.

Mirrors the production call in lib/analysis/skinAnalysis.ts: system_instruction
part, user text part + inline image part, JSON response mime type, temperature 0.
Images run concurrently; every per-image failure mode (transport error after
retries, JSON parse failure, schema validation failure) is recorded as data on
the ImageResult rather than raised, so the grader can see it.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import random
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from google import genai
from google.genai import types
from openai import OpenAI
from pydantic import ValidationError

from optimizer.schemas import ImageResult, OptimizerState, PromptPair, SkinObservation

log = logging.getLogger("optimizer.executor")

_MIME_BY_SUFFIX = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def load_test_images(images_dir: str | Path) -> list[tuple[str, bytes, str]]:
    """Load all supported images from the folder as (name, bytes, mime) tuples.

    Sorted by filename for deterministic ordering. Raises SystemExit with a
    clear message when the folder is missing or holds no usable images.
    """
    folder = Path(images_dir)
    if not folder.is_dir():
        raise SystemExit(f"Test image folder not found: {folder}")

    images = []
    for path in sorted(folder.iterdir()):
        mime = _MIME_BY_SUFFIX.get(path.suffix.lower())
        if mime is None:
            continue
        images.append((path.name, path.read_bytes(), mime))

    if not images:
        raise SystemExit(
            f"No test images found in {folder}. "
            "Add .jpg/.png/.webp selfies there before running."
        )
    return images


def _call_gemini(
    client: genai.Client,
    model: str,
    prompts: PromptPair,
    image_bytes: bytes,
    mime: str,
) -> tuple[str, int, int]:
    """One Gemini call. Returns (response text, prompt tokens, output tokens)."""
    response = client.models.generate_content(
        model=model,
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompts.user_prompt),
                    types.Part.from_bytes(data=image_bytes, mime_type=mime),
                ],
            )
        ],
        config=types.GenerateContentConfig(
            system_instruction=prompts.system_instruction,
            temperature=0.0,
            response_mime_type="application/json",
        ),
    )
    usage = response.usage_metadata
    prompt_tokens = getattr(usage, "prompt_token_count", 0) or 0
    output_tokens = getattr(usage, "candidates_token_count", 0) or 0
    return response.text or "", prompt_tokens, output_tokens


def _call_local(
    client: OpenAI,
    model: str,
    prompts: PromptPair,
    image_bytes: bytes,
    mime: str,
) -> tuple[str, int, int]:
    """Local-mode stand-in for the Gemini call (OpenAI-compatible server).

    Uses a permissive json_schema (LM Studio rejects json_object) so the server
    guarantees JSON without enum-forcing — mirroring Gemini's JSON mime type,
    which keeps schema/enum mistakes visible to the grader.
    """
    data_url = f"data:{mime};base64,{base64.b64encode(image_bytes).decode()}"
    response = client.chat.completions.create(
        model=model,
        temperature=0.0,
        response_format={
            "type": "json_schema",
            "json_schema": {"name": "loose_json", "schema": {"type": "object"}},
        },
        extra_body={"reasoning_effort": "none"},
        messages=[
            {"role": "system", "content": prompts.system_instruction},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompts.user_prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
    )
    message = response.choices[0].message
    # Some local templates misfile output as reasoning; fall back to it if so.
    text = message.content or getattr(message, "reasoning_content", "") or ""
    usage = response.usage
    prompt_tokens = (usage.prompt_tokens if usage else 0) or 0
    output_tokens = (usage.completion_tokens if usage else 0) or 0
    return text, prompt_tokens, output_tokens


def _run_one_image(
    client: genai.Client | OpenAI,
    model: str,
    prompts: PromptPair,
    name: str,
    image_bytes: bytes,
    mime: str,
    max_retries: int,
) -> ImageResult:
    """Run one image with retry/backoff; never raises — failures become data."""
    start = time.monotonic()
    last_error = ""
    call = _call_local if isinstance(client, OpenAI) else _call_gemini
    for attempt in range(max_retries):
        try:
            raw, prompt_tokens, output_tokens = call(
                client, model, prompts, image_bytes, mime
            )
            break
        except Exception as exc:  # transport/API errors — retry with backoff
            last_error = f"{type(exc).__name__}: {exc}"
            if attempt < max_retries - 1:
                time.sleep(2**attempt + random.uniform(0, 0.5))
    else:
        return ImageResult(
            image_name=name,
            error=f"Gemini call failed after {max_retries} attempts: {last_error}",
            latency_s=time.monotonic() - start,
        )

    latency = time.monotonic() - start
    result = ImageResult(
        image_name=name,
        raw_text=raw,
        latency_s=latency,
        prompt_tokens=prompt_tokens,
        output_tokens=output_tokens,
    )
    try:
        result.parsed = SkinObservation.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValidationError) as exc:
        result.validation_error = str(exc)
    return result


def executor_node(state: OptimizerState) -> dict:
    """Run the current PromptPair against every test image concurrently.

    Advances the iteration counters: ``iteration`` on every run,
    ``validation_iteration`` only during the validation phase.
    """
    config = state["config"]
    phase = state["phase"]
    model = config.executor_model(phase)
    prompts = state["prompts"]
    iteration = state["iteration"] + 1

    images = load_test_images(config.images_dir)
    log.info(
        "Iteration %d [%s] running %d images on %s",
        iteration,
        phase,
        len(images),
        model,
    )

    if config.local_base_url:
        client: genai.Client | OpenAI = OpenAI(
            base_url=config.local_base_url, api_key="lm-studio"
        )
    else:
        client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    with ThreadPoolExecutor(max_workers=config.concurrency) as pool:
        outputs = list(
            pool.map(
                lambda img: _run_one_image(
                    client, model, prompts, img[0], img[1], img[2], config.max_retries
                ),
                images,
            )
        )

    failures = sum(1 for o in outputs if o.parsed is None)
    if failures:
        log.warning("%d/%d images did not produce a valid result", failures, len(outputs))

    update: dict = {"outputs": outputs, "iteration": iteration}
    if phase == "validation":
        update["validation_iteration"] = state["validation_iteration"] + 1
    return update
