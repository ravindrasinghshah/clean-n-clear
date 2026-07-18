# Prompt Optimizer — Guide

Closed-loop tool that iteratively improves the two Gemini prompts used by the
skincare app in [../lib/analysis/skinAnalysis.ts](../lib/analysis/skinAnalysis.ts).
It runs a prompt against test selfies, grades the outputs, rewrites the prompt to
close the graded gaps, and repeats until a score threshold is met.

## Setup

```powershell
python -m venv .venv
.venv\Scripts\pip install -e .
copy .env.example .env      # fill in GEMINI_API_KEY and OPENAI_API_KEY (deployment only)
```

Put a few real selfies (`.jpg`/`.png`/`.webp`) in `test_images/`. Optionally add
`test_images/labels.json` (ground-truth) — the grader uses it for accuracy if present.

## Running

The **`--local` flag is the only switch** between the two modes. Add it or omit it.

| Mode | Command | Models | Keys |
|---|---|---|---|
| **Local smoke test** | `python main.py --threshold 85 --criteria criteria.md --local` | LM Studio server from `config.yaml` `local:` block | none |
| **Deployment** | `python main.py --threshold 85 --criteria criteria.md` | `gemini-2.5-flash`/`-pro` + `gpt-4o` | `.env` required |

Common flags: `--images test_images/`, `--max-iter 10`, `--validation-max-iter 3`,
`--apply` (patch winning prompts into `skinAnalysis.ts` after a y/N diff confirmation).

> **Local mode is for verifying the machinery only** — a small local model on
> stand-in images produces meaningless scores. Never run `--apply` after `--local`.

To change which local server/model `--local` targets, edit `config.yaml`:

```yaml
local:
  base_url: http://localhost:1234/v1
  model: qwen/qwen3.5-9b
```

## Architecture

Two-tier LangGraph state machine. Exploration tunes the prompt cheaply on
**flash**; the best pair is promoted to a **pro** validation pass.

```
                    ┌──────────────────────────────────────────┐
                    │                                           │
   START ──▶ Executor ──▶ Grader ──▶ Recorder ──▶ Router ──┐   │
            (Gemini)     (GPT-4o)    (parquet     (decide)  │   │
             runs all    scores vs   + jsonl)               │   │
             images      criteria                           │   │
                ▲                                           │   │
                │              ┌── engineer ──▶ Engineer ───┘   │  rewrite prompts,
                │              │   (rewrite)    (GPT-4o) ───────┘  loop back
                └──────────────┤
                               ├── promote ──▶ (switch to pro, best prompts) ─▶ Executor
                               │
                               └── end ──▶ END (report winner)
```

**Flow logic** (`optimizer/graph.py` router):
- **Exploration** (flash): loop Executor→Grader→Engineer until score ≥ threshold or
  empty gap manifest (→ promote), or `max-iter`/3-iteration plateau hit (→ promote best).
- **Validation** (pro): re-run best prompts on pro. If ≥ threshold → END. Else up to
  `validation-max-iter` more rewrite cycles on pro, then END with best result.
- The winner is always the best-scoring pair tracked in state, never just the last.

**Design invariants:**
- *Grader is blind to the prompt* — it grades outputs only, so it can't be gamed by
  prompt wording.
- *Safety framing is enforced* in the Engineer node (cosmetic-only, no diagnosis,
  `unknown` for low confidence) with a post-rewrite guard + one retry.
- *Failures are data* — schema/transport errors are recorded per image, never crash the loop.
- *Crash-safe* — every iteration is written to `runs/` immediately.

## Files

| File | Function | Used by |
|---|---|---|
| `main.py` | CLI entry: parses flags, builds `RunConfig`, runs the graph, prints the winner, handles `--apply` | you (entry point) |
| `config.yaml` | Model ids, defaults, and the `local:` server block | `main.py` |
| `criteria.md` | Ideal-output criteria the grader scores against (edit to steer optimization) | Grader node |
| `seed_prompts.json` | Iteration-0 prompts, extracted verbatim from `skinAnalysis.ts` | `main.py`, `--apply` |
| `guides/gemini-prompting.md` | Static Gemini best-practices reference | Engineer node |
| `.env` / `.env.example` | `GEMINI_API_KEY`, `OPENAI_API_KEY` (deployment mode) | `main.py` |
| `optimizer/schemas.py` | All Pydantic models + `OptimizerState` (the shared contract) | every node |
| `optimizer/graph.py` | Wires nodes together; the two-tier router + promote logic | `main.py` |
| `optimizer/clients.py` | OpenAI client factory; swaps to local server in `--local` mode | grader, engineer |
| `optimizer/nodes/executor.py` | Runs prompts against every image (Gemini or local); parses/validates results | graph |
| `optimizer/nodes/grader.py` | GPT-4o structured grading against criteria; tracks best score | graph |
| `optimizer/nodes/engineer.py` | GPT-4o prompt rewriting to close gaps; enforces safety framing | graph |
| `optimizer/nodes/recorder.py` | Persists each iteration to `runs/<id>.parquet` + `.jsonl` | graph |
| `runs/` | Per-run output: one parquet row + one jsonl line per iteration | you (review results) |
| `test_images/` | Your input selfies (+ optional `labels.json`) | Executor node |

## Maintaining

- **Change what "good" means** → edit `criteria.md` (no code change).
- **Change models or thresholds** → edit `config.yaml` or pass CLI flags.
- **Output schema changed** in the app → update `SkinAnalysisResult` and the enum
  `Literal`s in `optimizer/schemas.py` to keep the contract in sync with
  `../lib/types/skincare.ts`.
- **Seed prompts drifted** → `--apply` matches the current strings from
  `seed_prompts.json` verbatim in the TS file and aborts cleanly if they no longer
  match; update `seed_prompts.json` if you edit the app prompts by hand.
- **Review a run** → open `runs/<id>.jsonl` (human-readable) or load the parquet in pandas.
