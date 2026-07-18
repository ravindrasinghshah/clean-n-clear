# Prompt Optimizer

Closed-loop optimizer for the two Gemini prompts in
[lib/analysis/skinAnalysis.ts](../lib/analysis/skinAnalysis.ts). A LangGraph
state machine runs the current prompt pair against every selfie in
`test_images/` on Gemini, grades the outputs with GPT-4o against `criteria.md`,
rewrites the prompts to close the graded gaps, and repeats — exploring on
`gemini-2.5-flash`, then validating the best pair on `gemini-2.5-pro`.

See `prompt-optimizer-spec.md` for the full architecture.

## Setup (Windows / PowerShell)

```powershell
python -m venv .venv
.venv\Scripts\pip install -e .
copy .env.example .env   # then fill in GEMINI_API_KEY and OPENAI_API_KEY
```

Drop a handful of test selfies (`.jpg`/`.png`/`.webp`) into `test_images/`.
Optionally add `test_images/labels.json` with ground-truth labels — the grader
will use them for accuracy if present.

## Run

```powershell
.venv\Scripts\python main.py --threshold 85 --criteria criteria.md
```

Optional flags: `--images test_images/`, `--max-iter 10`,
`--validation-max-iter 3`, and `--apply` to patch the winning prompts back into
`skinAnalysis.ts` (shows a diff, asks y/N before writing).

Every iteration is persisted crash-safe to `runs/<run_id>.parquet` (one row per
iteration) and `runs/<run_id>.jsonl` (full records, human-readable).

## Layout

| Path | Purpose |
| --- | --- |
| `main.py` | CLI, run setup, winner report, `--apply` patcher |
| `optimizer/schemas.py` | All Pydantic models + LangGraph state |
| `optimizer/graph.py` | Graph wiring and the two-tier router |
| `optimizer/nodes/executor.py` | Concurrent Gemini runs over the image set |
| `optimizer/nodes/grader.py` | GPT-4o structured grading (never sees prompts) |
| `optimizer/nodes/engineer.py` | GPT-4o prompt rewriting + safety guard |
| `optimizer/nodes/recorder.py` | Parquet + JSONL persistence per iteration |
| `criteria.md` | Ideal-output criteria (edit to steer grading) |
| `guides/gemini-prompting.md` | Static Gemini best-practices for the engineer |
| `seed_prompts.json` | Iteration-0 prompts, extracted verbatim from the app |
