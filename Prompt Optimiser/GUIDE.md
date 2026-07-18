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

Put a few real selfies (`.jpg`/`.png`/`.webp`) in `test_images/`.

**Strongly recommended:** add `test_images/labels.json` with ground truth, keyed
by filename. Every field is optional — only what you label gets scored:

```json
{
  "selfie1.jpg": { "skinType": "oily", "faceType": "round", "concerns": ["acne-prone", "congestion"] },
  "selfie2.jpg": { "skinType": "dry" }
}
```

When labels exist, a deterministic accuracy report (exact match for
`skinType`/`faceType`, Jaccard overlap for `concerns`) is computed in code each
iteration and handed to the grader as authoritative — accuracy scoring no longer
depends on the judge's opinion. Without labels, the grader can still judge
plausibility against the photos, but not correctness.

## Running

```powershell
python main.py --threshold 85 --criteria criteria.md
```

The **`local.enabled` key in `config.yaml` is the only switch** between the two
modes — there is no CLI flag for it. The command line stays the same either way.

| Mode | `config.yaml` | Models | Keys |
|---|---|---|---|
| **Local smoke test** | `local.enabled: true` | LM Studio server from `config.yaml` `local:` block | none |
| **Deployment** | `local.enabled: false` | `gemini-2.5-flash`/`-pro` + `gpt-4o` | `.env` required |

```yaml
local:
  enabled: false                      # true = route every call to the local server
  base_url: http://localhost:1234/v1
  model: qwen/qwen3.5-9b
```

Common flags: `--images test_images/`, `--max-iter 10`, `--validation-max-iter 3`,
`--apply` (patch winning prompts into `skinAnalysis.ts` after a y/N diff confirmation).

> **Local mode is for verifying the machinery only** — a small local model on
> stand-in images produces meaningless scores. Never run `--apply` while
> `local.enabled: true`, and remember to set it back to `false` before a real run.

## config.yaml reference

Everything the optimizer consumes flows from `config.yaml`. Section by section:

### `models:` — which model does which job

| Key | Job | Notes |
|---|---|---|
| `executor_flash` | Runs the candidate prompts on every test image during **exploration** (the cheap tuning loop) | Should match or be cheaper than the app's production model |
| `executor_pro` | Re-runs the best prompts during **validation** (the expensive confirmation pass) | Use the strongest Gemini you'd consider shipping against |
| `agent` | Both the **grader** (scores outputs, needs vision since it sees photos) and the **engineer** (rewrites prompts) | Must be an OpenAI model with vision + structured outputs (e.g. `gpt-4o`) |

### `defaults:` — loop tuning knobs (CLI flags override the first two)

| Key | Meaning | When to change |
|---|---|---|
| `max_iterations` | Cap on exploration (flash) iterations before the best pair is promoted anyway | Raise if runs keep ending at the cap while still improving; CLI `--max-iter` overrides |
| `validation_max_iterations` | Extra rewrite cycles allowed on pro if the promoted pair scores below threshold | Keep small — pro calls are the expensive ones; CLI `--validation-max-iter` overrides |
| `plateau_patience` | Consecutive non-improving iterations before exploration gives up and promotes the best so far | Raise to push through noisy score dips, lower to save calls |
| `concurrency` | Parallel executor calls per iteration (thread pool size) | Lower if you hit Gemini rate limits |
| `max_retries` | Per-image retry attempts (exponential backoff) before the failure is recorded as data | Raise on a flaky connection |
| `pro_call_warn_limit` | If projected pro-phase calls (images × validation cycles) exceed this, a cost warning is logged before validation starts | Set to whatever pro-call count would make you wince |

### `local:` — smoke-test mode

| Key | Meaning |
|---|---|
| `enabled` | `true` routes **every** call (executor + grader + engineer) to the local server; `false` uses real Gemini + OpenAI. The only mode switch — see Running above |
| `base_url` | OpenAI-compatible endpoint (e.g. LM Studio's `http://localhost:1234/v1`) |
| `model` | Model id to request from that server — must accept images, since both the executor and grader send photos |

### `paths:` — where inputs and outputs live (relative to this folder)

| Key | Points at |
|---|---|
| `images_dir` | Test selfie folder (CLI `--images` overrides) |
| `runs_dir` | Where per-iteration parquet/jsonl artifacts are written |
| `guides` | The Gemini best-practices markdown given to the engineer |
| `skin_analysis_ts` | The app file `--apply` patches winning prompts into |

### `prompts:` — every prompt the run uses

| Key | Role |
|---|---|
| `seed.system_instruction` / `seed.user_prompt` | The iteration-0 pair being optimized — **must match `skinAnalysis.ts` verbatim** or `--apply` aborts (see Maintaining) |
| `grader_system` | The grader's instructions: strictness rules, photo grounding, how to treat the deterministic accuracy report |
| `grader_target_schema` | Schema/enum description shown to the grader |
| `engineer_system` | The engineer's instructions — a template; keep the `{safety}` and `{guides}` placeholders and avoid other literal `{ }` braces |
| `engineer_safety_constraint` | The non-negotiable safety invariant substituted into `{safety}` |
| `engineer_target_schema` | The fixed JSON contract shown to the engineer |

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
- *Grader is blind to the prompt* — it never sees the prompt text, so it can't be
  gamed by prompt wording. It DOES see the test photos, so it judges whether each
  output matches what is actually visible, not just whether it is well-formed.
- *Accuracy is computed, not judged* — with `labels.json` present, per-image
  accuracy is calculated in code and given to the grader as authoritative.
- *Safety framing is enforced* in the Engineer node (cosmetic-only, no diagnosis,
  `unknown` for low confidence) with a post-rewrite guard + one retry.
- *Failures are data* — schema/transport errors are recorded per image, never crash the loop.
- *Crash-safe* — every iteration is written to `runs/` immediately.

## Files

| File | Function | Used by |
|---|---|---|
| `main.py` | CLI entry: parses flags, builds `RunConfig`, runs the graph, prints the winner, handles `--apply` | you (entry point) |
| `config.yaml` | The single place all inputs flow from — every key documented in the config.yaml reference above | `main.py` |
| `criteria.md` | Ideal-output criteria the grader scores against (edit to steer optimization) | Grader node |
| `guides/gemini-prompting.md` | Static Gemini best-practices reference | Engineer node |
| `.env` / `.env.example` | `GEMINI_API_KEY`, `OPENAI_API_KEY` (deployment mode) | `main.py` |
| `optimizer/schemas.py` | All Pydantic models + `OptimizerState` (the shared contract) | every node |
| `optimizer/graph.py` | Wires nodes together; the two-tier router + promote logic | `main.py` |
| `optimizer/clients.py` | OpenAI client factory; swaps to local server when `local.enabled` is true | grader, engineer |
| `optimizer/nodes/executor.py` | Runs prompts against every image (Gemini or local); parses/validates results | graph |
| `optimizer/nodes/grader.py` | GPT-4o structured grading against criteria — sees the test photos, computes deterministic label accuracy in code; tracks best score | graph |
| `optimizer/nodes/engineer.py` | GPT-4o prompt rewriting to close gaps; enforces safety framing | graph |
| `optimizer/nodes/recorder.py` | Persists each iteration to `runs/<id>.parquet` + `.jsonl` | graph |
| `runs/` | Per-run output: one parquet row + one jsonl line per iteration | you (review results) |
| `test_images/` | Your input selfies (+ recommended `labels.json` ground truth, format in Setup above) | Executor + Grader nodes |

## Maintaining

- **Change what "good" means** → edit `criteria.md` (no code change).
- **Change models or thresholds** → edit `config.yaml` or pass CLI flags.
- **Change the grader/engineer prompts** → edit the `prompts:` section in
  `config.yaml` (no code change). `engineer_system` is a template: keep the
  `{safety}` and `{guides}` placeholders (filled at runtime with
  `engineer_safety_constraint` and the Gemini guide) and avoid other literal
  `{ }` braces in it.
- **Switch local/deployment mode** → flip `local.enabled` in `config.yaml`.
- **Output schema changed** in the app → update `SkinAnalysisResult` and the enum
  `Literal`s in `optimizer/schemas.py` to keep the contract in sync with
  `../lib/types/skincare.ts`.
- **Change the seed prompts** (the pair being optimized) → edit `prompts.seed`
  in `config.yaml`. These must match the current strings in `skinAnalysis.ts`
  verbatim: `--apply` finds them in the TS file by exact text and aborts cleanly
  if they have drifted, so update `prompts.seed` whenever you edit the app
  prompts by hand.
- **Review a run** → open `runs/<id>.jsonl` (human-readable) or load the parquet in pandas.
