# Build Spec: Prompt Optimizer Agent (Python + LangGraph)

Hand this document to the building agent as-is. It contains all architecture decisions; do not re-litigate them — ask only about genuine gaps.

## Objective

Build a closed-loop prompt-optimization tool in Python that iteratively improves the two Gemini prompts used in `lib/analysis/skinAnalysis.ts` (a Next.js skincare-analysis app in this repo). The loop: run prompt against test images on Gemini → grade the outputs → rewrite the prompt to close graded gaps → repeat until quality threshold is met.

## Decided architecture (do not change)

- **Orchestration**: LangGraph state machine.
- **Target model (executor)**: two-tier — `gemini-2.5-flash` during exploration iterations, `gemini-2.5-pro` for final validation (details below). SDK: `google-genai`.
- **Agent models (grader + prompt engineer)**: OpenAI `gpt-4o` with structured outputs (Pydantic). SDK: `openai`.
- **Test data**: user-supplied selfie images in `test_images/` (assume the folder exists; fail with a clear message if empty).
- **Persistence**: pandas DataFrame, persisted to `runs/<run_id>.parquet` + human-readable JSONL after every iteration (crash-safe).
- **Both prompts optimized jointly** as one `PromptPair` (system_instruction + user_prompt) — they function as a unit; not two independent loops.
- **Prompting guides**: static curated file `guides/gemini-prompting.md` (assemble once from Google's Gemini prompting best-practices docs; no live web fetch inside the loop).

## Seed prompts (iteration 0 — extract verbatim)

From `lib/analysis/skinAnalysis.ts`:

- **system_instruction** (line 48):
  `You are a cosmetic skincare assistant for a US MVP. Analyze visible cosmetic skin attributes only. Do not diagnose medical conditions. Use unknown for low confidence.`
- **user_prompt** (line 53):
  `Return JSON with skinType, faceType, concerns array, confidence 0-1, notes array, safetyFlags array. Allowed skinType: oily,dry,combination,normal,sensitive,unknown. Allowed faceType: oval,round,square,heart,oblong,unknown. Allowed concerns: acne-prone,redness,dark-spots,texture,fine-lines,dehydration,irritation,congestion.`

Store these in `seed_prompts.json`.

## Target output schema (mirror of `lib/types/skincare.ts` — the contract being optimized for)

```python
SkinType = Literal["oily","dry","combination","normal","sensitive","unknown"]
FaceType = Literal["oval","round","square","heart","oblong","unknown"]
SkinConcern = Literal["acne-prone","redness","dark-spots","texture","fine-lines","dehydration","irritation","congestion"]

class SkinAnalysisResult(BaseModel):
    skinType: SkinType
    faceType: FaceType
    concerns: list[SkinConcern]
    confidence: float  # 0-1
    notes: list[str]
    safetyFlags: list[str]
```

Any Gemini output that fails to validate against this model is a measurable failure the grader must see (record the validation error, don't crash).

## HARD CONSTRAINT — safety framing

The optimized prompts MUST preserve: cosmetic-guidance-only positioning, no medical diagnosis, "use unknown for low confidence", US-market scope. The Prompt Engineer node's instructions must state this as a non-negotiable invariant. If an engineered prompt drops this framing, that is a critical defect.

## LangGraph state

```python
class OptimizerState(TypedDict):
    iteration: int
    phase: Literal["exploration", "validation"]
    prompts: PromptPair                  # system_instruction + user_prompt
    outputs: list[ImageResult]           # per test image: parsed result | validation error, raw text, latency
    grade: GradeReport | None
    best: BestRecord                     # best score seen + its PromptPair + which phase/model produced it
    history: list[IterationRecord]
    config: RunConfig                    # threshold, criteria text, max_iter, paths, model ids
```

## Nodes

### 1. Executor
- Runs current `PromptPair` against EVERY image in `test_images/`, concurrently, with retry/backoff.
- Model chosen by `state.phase`: exploration → `gemini-2.5-flash`; validation → `gemini-2.5-pro`.
- Request mirrors the production call in `skinAnalysis.ts`: system_instruction part, user text part + inline_data image part, `response_mime_type="application/json"`, `temperature=0`.
- Parses/validates each response against `SkinAnalysisResult`; records failures as data.

### 2. Grader (OpenAI, structured output)
- Sees ONLY: the ideal-output criteria, the target schema/enums, this iteration's outputs, and the previous iteration's outputs + score. It must NOT see the prompt (it grades results, not intent).
- Output model:

```python
class GapItem(BaseModel):
    gap: str
    severity: Literal["critical","major","minor"]
    evidence: str                        # which image/output demonstrates it
    suggested_direction: str

class GradeReport(BaseModel):
    per_criterion_scores: dict[str, float]
    overall_score: float                 # 0-100
    manifest: list[GapItem]              # empty ⇒ stop signal
    trend: Literal["improved","degraded","unchanged","first_run"]
    trend_rationale: str
```

### 3. Prompt Engineer (OpenAI, structured output)
- Inputs: current `PromptPair`, `GradeReport.manifest`, contents of `guides/gemini-prompting.md`, the target schema, the safety hard-constraint.
- Output: new `PromptPair`. Must keep the JSON schema/enum requirements intact and the safety framing verbatim in spirit.

### 4. Recorder
- Appends full iteration record (iteration, phase, model, prompts, outputs, score, manifest, trend, timestamp) to the DataFrame; writes parquet + JSONL every cycle.

### 5. Router (conditional edges) — two-tier flow
- **Exploration phase** (executor = flash). After grading:
  - If `manifest == []` OR `overall_score >= threshold` → set `phase = "validation"`, set `prompts = best.prompts`, go to Executor (pro run).
  - Else if `iteration >= max_iterations` OR 3 consecutive non-improving iterations (plateau guard) → set `phase = "validation"` with `best.prompts`, go to Executor.
  - Else → Prompt Engineer → Executor.
- **Validation phase** (executor = pro, one full pass over all images, then grade):
  - If pro `overall_score >= threshold` → END. Winner = these prompts.
  - Else → allow up to `validation_max_iterations` (default 3) additional improve cycles with the executor staying on **pro** (the flash-tuned prompt needs pro-specific refinement). If still below threshold → END, return best pro-phase result, clearly flagged as below threshold.
- Loop ALWAYS returns the best prompts (tracked in `best`), never simply the last.

## CLI (`main.py`)

```
python main.py \
  --threshold 85 \
  --criteria criteria.md \
  --images test_images/ \
  --max-iter 10 \
  --validation-max-iter 3 \
  [--apply]     # off by default: patch winning prompts back into lib/analysis/skinAnalysis.ts lines 48/53
```

- `--threshold` and `--criteria` are required inputs per the original requirements (score threshold and ideal-output criteria are parameters).
- `--apply` edits the two string literals in the TS file; print a diff and require a y/N confirmation before writing.

## Project layout

```
prompt-optimizer/                  # sibling folder to the Next.js app, own Python env
├── pyproject.toml                 # langgraph, openai, google-genai, pandas, pydantic, pyarrow
├── config.yaml                    # model ids, defaults for CLI params
├── criteria.md                    # starter ideal-output criteria (user will edit)
├── guides/gemini-prompting.md     # curated Gemini prompting best practices
├── seed_prompts.json
├── test_images/                   # user-supplied (gitignore contents)
├── optimizer/
│   ├── schemas.py                 # all Pydantic models above
│   ├── nodes/executor.py, grader.py, engineer.py, recorder.py
│   └── graph.py                   # LangGraph wiring incl. two-phase router
├── runs/                          # gitignored
└── main.py
```

Env vars: `GEMINI_API_KEY`, `OPENAI_API_KEY` (read from `.env` via python-dotenv; provide `.env.example`).

## Starter `criteria.md` (author this; user will refine)

Cover at minimum: schema/enum validity on every image; confidence calibration (low confidence ⇒ `unknown`, not a guess); concerns supported by visible evidence in notes; notes are plain-language and specific; safetyFlags always include no-diagnosis framing; no medical/diagnostic language anywhere; consistent output across the image set.

## Build order & acceptance

1. Schemas + config + seed prompt extraction.
2. Executor standalone: baseline (iteration 0) run of seed prompts on flash against test images → valid `ImageResult`s.
3. Grader standalone: grade the baseline; manifest must be non-trivial and evidence-backed.
4. Engineer standalone: one manual improve cycle; verify schema/safety invariants survive.
5. Graph wiring + recorder + router; full autonomous run end-to-end on flash, then pro validation.
6. CLI + `--apply`.

Acceptance: a full run from `python main.py --threshold 85 --criteria criteria.md --images test_images/` completes autonomously, produces `runs/<id>.parquet` with one row per iteration (including the pro validation rows), prints the winning PromptPair and its flash + pro scores, and `--apply` correctly patches `skinAnalysis.ts`.

## Notes for the builder

- "Gemini 3.5" in any earlier discussion was a misnomer — the models are `gemini-2.5-flash` and `gemini-2.5-pro`.
- Keep temperature 0 on the executor for reproducibility; variance signal comes from the multi-image set.
- No ground-truth labels exist for the test images (grader judges schema adherence, plausibility, note quality, safety framing). If labels appear later (`test_images/labels.json`), add accuracy to the criteria — design the grader input to optionally accept them.
- Cost guard: log per-iteration token/call counts; warn if projected pro-phase calls exceed 50.
