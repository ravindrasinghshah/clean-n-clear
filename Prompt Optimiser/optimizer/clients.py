"""OpenAI client factory for the grader/engineer agent nodes.

Default: the real OpenAI API (key from OPENAI_API_KEY). In local mode
(RunConfig.local_base_url set) it targets an OpenAI-compatible server such as
LM Studio instead, and adds reasoning_effort="none" — reasoning-tuned local
models otherwise burn their output on thinking tokens.
"""

from __future__ import annotations

from openai import OpenAI

from optimizer.schemas import RunConfig


def agent_client(config: RunConfig) -> tuple[OpenAI, dict]:
    """Return (client, extra kwargs to splat into chat.completions calls)."""
    if config.local_base_url:
        client = OpenAI(base_url=config.local_base_url, api_key="lm-studio")
        return client, {"extra_body": {"reasoning_effort": "none"}}
    return OpenAI(), {}
