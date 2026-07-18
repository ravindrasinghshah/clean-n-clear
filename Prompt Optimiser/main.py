"""CLI entry point for the prompt optimizer.

Usage (from this folder, with .env holding GEMINI_API_KEY and OPENAI_API_KEY):

    python main.py --threshold 85 --criteria criteria.md --images test_images/ \
        --max-iter 10 --validation-max-iter 3 [--apply]

Runs the full LangGraph loop, prints the winning PromptPair with its flash and
pro scores, and with --apply patches the winner back into
lib/analysis/skinAnalysis.ts (diff shown, y/N confirmation required).

Local smoke-test mode is toggled via config.yaml (`local.enabled: true`), not a
CLI flag; while enabled, no API keys are needed. All prompt inputs — the seed
pair being optimized (`prompts.seed`) and the grader/engineer prompts — live in
config.yaml's `prompts:` section.
"""

from __future__ import annotations

import argparse
import difflib
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

import yaml
from dotenv import load_dotenv

from optimizer.graph import build_graph
from optimizer.nodes.executor import load_test_images
from optimizer.schemas import AgentPrompts, IterationRecord, PromptPair, RunConfig

BASE_DIR = Path(__file__).resolve().parent


def parse_args(config: dict) -> argparse.Namespace:
    """CLI per the spec; config.yaml supplies defaults for the optional flags."""
    defaults = config["defaults"]
    parser = argparse.ArgumentParser(description="Optimize the Gemini prompt pair.")
    parser.add_argument("--threshold", type=float, required=True,
                        help="Overall score (0-100) that counts as passing.")
    parser.add_argument("--criteria", required=True,
                        help="Path to the ideal-output criteria markdown file.")
    parser.add_argument("--images", default=config["paths"]["images_dir"],
                        help="Folder of test selfie images.")
    parser.add_argument("--max-iter", type=int, default=defaults["max_iterations"],
                        help="Max exploration iterations on flash.")
    parser.add_argument("--validation-max-iter", type=int,
                        default=defaults["validation_max_iterations"],
                        help="Max extra improve cycles during pro validation.")
    parser.add_argument("--apply", action="store_true",
                        help="Patch winning prompts into skinAnalysis.ts (with confirmation).")
    return parser.parse_args()


def build_run_config(args: argparse.Namespace, config: dict) -> RunConfig:
    """Resolve paths/files into the immutable RunConfig carried in graph state."""
    defaults = config["defaults"]
    criteria_path = (BASE_DIR / args.criteria).resolve()
    if not criteria_path.is_file():
        sys.exit(f"Criteria file not found: {criteria_path}")

    images_dir = (BASE_DIR / args.images).resolve()
    load_test_images(images_dir)  # fail fast with a clear message if empty/missing

    labels_path = images_dir / "labels.json"
    labels_text = labels_path.read_text(encoding="utf-8") if labels_path.is_file() else None
    if labels_text:
        logging.info("Ground-truth labels found — grader will use them for accuracy.")

    local_enabled = config["local"].get("enabled", False)
    guides_path = BASE_DIR / config["paths"]["guides"]
    return RunConfig(
        run_id=datetime.now().strftime("%Y%m%d-%H%M%S"),
        threshold=args.threshold,
        criteria_text=criteria_path.read_text(encoding="utf-8"),
        guides_text=guides_path.read_text(encoding="utf-8"),
        agent_prompts=AgentPrompts.model_validate(config["prompts"]),
        labels_text=labels_text,
        images_dir=str(images_dir),
        runs_dir=str(BASE_DIR / config["paths"]["runs_dir"]),
        max_iterations=args.max_iter,
        validation_max_iterations=args.validation_max_iter,
        plateau_patience=defaults["plateau_patience"],
        flash_model=config["models"]["executor_flash"],
        pro_model=config["models"]["executor_pro"],
        agent_model=config["models"]["agent"],
        concurrency=defaults["concurrency"],
        max_retries=defaults["max_retries"],
        pro_call_warn_limit=defaults["pro_call_warn_limit"],
        local_base_url=config["local"]["base_url"] if local_enabled else None,
        local_model=config["local"]["model"] if local_enabled else None,
    )


def pick_winner(history: list[IterationRecord]) -> tuple[IterationRecord, float | None]:
    """Winner = best validation-phase record (falling back to best overall if the
    run somehow ended without one). Also returns the best flash score for context."""
    by_score = lambda r: r.grade.overall_score
    validation = [r for r in history if r.phase == "validation"]
    exploration = [r for r in history if r.phase == "exploration"]
    winner = max(validation or history, key=by_score)
    flash_best = max(map(by_score, exploration), default=None)
    return winner, flash_best


def report_winner(winner: IterationRecord, flash_best: float | None, threshold: float) -> None:
    """Print the final PromptPair and its scores."""
    verdict = "PASSED" if winner.grade.overall_score >= threshold else "BELOW THRESHOLD"
    print("\n" + "=" * 72)
    print(f"WINNER ({verdict}) — iteration {winner.iteration} [{winner.phase}] "
          f"on {winner.model}")
    if flash_best is not None:
        print(f"Best flash score: {flash_best:.1f}")
    print(f"Pro score: {winner.grade.overall_score:.1f} (threshold {threshold:.1f})")
    print("-" * 72)
    print("system_instruction:\n" + winner.prompts.system_instruction)
    print("-" * 72)
    print("user_prompt:\n" + winner.prompts.user_prompt)
    print("=" * 72)


def _ts_string_literal(text: str) -> str:
    """Escape prompt text for insertion into a single-quoted TS string literal."""
    return (
        text.replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\r\n", "\n")
        .replace("\n", "\\n")
    )


def apply_prompts(winner: PromptPair, config: dict) -> None:
    """Patch the winning prompts into skinAnalysis.ts.

    Locates the CURRENT prompt strings (config.yaml `prompts.seed`) verbatim in
    the file and replaces them; aborts with a clear message if either is missing.
    Shows a unified diff and requires y/N confirmation before writing.
    """
    ts_path = (BASE_DIR / config["paths"]["skin_analysis_ts"]).resolve()
    seeds = PromptPair.model_validate(config["prompts"]["seed"])

    original = ts_path.read_text(encoding="utf-8")
    patched = original
    replacements = [
        ("system_instruction", seeds.system_instruction, winner.system_instruction),
        ("user_prompt", seeds.user_prompt, winner.user_prompt),
    ]
    for label, old, new in replacements:
        old_literal = _ts_string_literal(old)
        if old_literal not in patched:
            sys.exit(
                f"--apply aborted: current {label} not found verbatim in {ts_path}. "
                "The file has drifted from config.yaml's prompts.seed — update the "
                "seeds or patch manually."
            )
        patched = patched.replace(old_literal, _ts_string_literal(new))

    diff = difflib.unified_diff(
        original.splitlines(keepends=True),
        patched.splitlines(keepends=True),
        fromfile=str(ts_path),
        tofile=str(ts_path) + " (patched)",
    )
    print("".join(diff) or "(no changes — winner equals the seeds)")
    if patched == original:
        return

    answer = input("Apply these changes to skinAnalysis.ts? [y/N] ").strip().lower()
    if answer == "y":
        ts_path.write_text(patched, encoding="utf-8")
        print(f"Patched {ts_path}")
    else:
        print("Not applied.")


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )
    config = yaml.safe_load((BASE_DIR / "config.yaml").read_text(encoding="utf-8"))
    args = parse_args(config)

    load_dotenv(BASE_DIR / ".env")
    if config["local"].get("enabled", False):
        logging.info("LOCAL MODE (config.yaml local.enabled): all calls go to %s",
                     config["local"]["base_url"])
    else:
        for key in ("GEMINI_API_KEY", "OPENAI_API_KEY"):
            if not os.environ.get(key):
                sys.exit(f"Missing required environment variable: {key} (set it in .env)")
    run_config = build_run_config(args, config)

    seeds = PromptPair.model_validate(config["prompts"]["seed"])
    initial_state = {
        "iteration": -1,  # executor increments; seed baseline becomes iteration 0
        "validation_iteration": 0,
        "phase": "exploration",
        "prompts": seeds,
        "outputs": [],
        "grade": None,
        "prev_outputs": None,
        "prev_score": None,
        "best": None,
        "history": [],
        "config": run_config,
    }

    # Worst case ~5 node steps per iteration across both phases; generous margin.
    recursion_limit = 10 * (args.max_iter + args.validation_max_iter + 2)
    final_state = build_graph().invoke(
        initial_state, config={"recursion_limit": recursion_limit}
    )

    winner, flash_best = pick_winner(final_state["history"])
    report_winner(winner, flash_best, args.threshold)
    print(f"\nRun artifacts: runs/{run_config.run_id}.parquet and .jsonl")

    if args.apply:
        apply_prompts(winner.prompts, config)


if __name__ == "__main__":
    main()
