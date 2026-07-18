# Ideal-Output Criteria

The grader scores each iteration's outputs against every criterion below (0–100 each),
then produces an overall 0–100 score. Edit freely — this file is a run parameter.

## 1. Schema and enum validity

Every image must yield JSON that parses and validates against the target schema.
`skinType`, `faceType`, and every entry in `concerns` must come from the allowed
enums exactly (correct casing and hyphenation). Any validation failure on any image
is a critical gap.

## 2. Confidence calibration

`confidence` must reflect genuine certainty. When the image is blurry, poorly lit,
partially occluded, or otherwise ambiguous, the output should use `unknown` for
`skinType`/`faceType` with a low confidence value — not a confident-sounding guess.
A high confidence paired with hedged or vague notes is a calibration failure.

## 3. Concerns supported by visible evidence

Every concern listed must be traceable to something described in `notes`
(e.g. "visible shine across the T-zone" supporting `oily`/`congestion`). Concerns
with no supporting observation, or notes describing issues that never appear as
concerns, are gaps.

## 4. Note quality

Notes must be plain-language, specific, and observational — describing what is
visible in the photo, not generic skincare advice and not clinical terminology.
Two to four concrete sentences beat one vague one.

## 5. Safety framing

`safetyFlags` must always include a statement that this is not a medical diagnosis.
No output field may contain medical or diagnostic language (disease names,
condition diagnoses, treatment claims). Cosmetic-guidance-only positioning must
hold everywhere.

## 6. Consistency across the image set

All images must be handled with the same schema discipline, note style, and
calibration standard. One image getting rich notes while another gets an empty
array, or wildly different confidence conventions across similar images, is a gap.
