# Gemini Prompting Best Practices (curated)

Curated from Google's Gemini prompting guidance for the Prompt Engineer node.
Static file — never fetched live inside the loop.

## Core instruction design

- **Be specific and explicit.** State exactly what to analyze, what to output, and
  what to ignore. Gemini follows precise instructions better than implied intent.
- **Give the model a role.** A short persona in the system instruction ("You are a
  cosmetic skincare assistant…") anchors tone and scope.
- **Prefer positive instructions over prohibitions.** "Describe only visible,
  cosmetic surface attributes" works better than a list of don'ts — but keep
  explicit prohibitions for hard safety rules (no medical diagnosis).
- **Give the model an out.** Explicitly permit `unknown` / low confidence when
  evidence is weak; this reduces hallucinated confident answers.
- **Break the task into steps.** Numbered instructions ("1. Assess image quality.
  2. Identify skin type. 3. …") outperform one dense paragraph.
- **Use delimiters and structure.** Markdown headings, numbered lists, or XML-ish
  tags separate instructions, definitions, and constraints cleanly.

## Structured (JSON) output

- Set `response_mime_type: application/json` AND spell out the exact JSON shape in
  the prompt: every key, its type, and its allowed values.
- Enumerate allowed enum values verbatim, comma-separated, and say "use exactly one
  of these values; never invent new values."
- Describe each field's semantics in one line (what `confidence` measures, what
  belongs in `notes` vs `safetyFlags`), not just its type.
- Ask for JSON only — no markdown fences, no commentary before or after.

## Vision / image prompts

- For single-image prompts, placing the image before the text tends to work
  slightly better; either way, refer to the image explicitly ("the photo above").
- Tell the model which visual attributes to examine (shine, texture, pores,
  redness, flaking) rather than asking generically "analyze this face".
- Instruct how to handle poor-quality input: blur, low light, filters, makeup,
  partial faces — say explicitly what the fallback behavior is.

## Determinism and calibration

- `temperature: 0` for reproducible extraction-style tasks (the executor already
  does this — do not rely on sampling variety).
- Anchor confidence: define what ranges mean (e.g. ≥0.8 clear evidence, 0.5–0.8
  partial, <0.5 use `unknown`), otherwise the model picks arbitrary values.

## Common failure modes to engineer against

- Enum drift: outputs like "Oily" or "acne prone" that fail exact-match validation.
  Fix by restating enums verbatim and demanding exact casing.
- Empty or generic `notes`: demand a minimum number of specific, image-grounded
  observations.
- Missing safety framing: require the no-diagnosis statement in `safetyFlags` on
  every response, not just when something looks concerning.
- Overconfident guesses on bad images: pair the `unknown` rule with a concrete
  image-quality checklist.
