"""Pydantic models and the LangGraph state shared across all optimizer nodes.

The models mirror the spec exactly, with one deliberate deviation:
``GradeReport.per_criterion_scores`` is a list of ``CriterionScore`` rather than
a ``dict[str, float]``, because OpenAI structured outputs reject JSON schemas
with ``additionalProperties`` (which any Pydantic dict field produces). The
``scores_dict()`` helper restores the dict view for reporting.
"""

from __future__ import annotations

from typing import Literal, TypedDict

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Target output contract — observation-only. Gemini emits ONLY visible cosmetic
# observations; a separate program turns these into routines/products. The app
# TypeScript (lib/types/skincare.ts) has not yet been migrated to this shape.
# ---------------------------------------------------------------------------

SkinType = Literal["oily", "dry", "combination", "normal", "sensitive", "unknown"]
FaceType = Literal["oval", "round", "square", "heart", "oblong", "unknown"]
Attribute = Literal[
    "acne-prone",
    "redness",
    "dark-spots",
    "texture",
    "fine-lines",
    "dehydration",
    "irritation",
    "congestion",
]
Region = Literal[
    "forehead", "nose", "cheeks", "chin", "perioral", "undereye", "jawline", "overall"
]
Prominence = Literal["mild", "moderate", "prominent"]
Oiliness = Literal["low", "balanced", "high-tzone", "high-overall", "unknown"]
Hydration = Literal["low", "adequate", "unknown"]
SensitivitySignals = Literal["none", "mild", "notable", "unknown"]


class Observation(BaseModel):
    """One visible cosmetic attribute, grounded in what the photo shows."""

    attribute: Attribute
    prominence: Prominence
    regions: list[Region]
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: str


class Surface(BaseModel):
    """Observational surface axes that sharpen downstream product choices."""

    oiliness: Oiliness
    hydration: Hydration
    sensitivitySignals: SensitivitySignals


class ReferToProfessional(BaseModel):
    """Flag (never a diagnosis) that something is better assessed in person."""

    recommended: bool
    reason: str


class ImageQuality(BaseModel):
    """The model's own read on whether the selfie is usable."""

    usable: bool
    issues: list[str]


class SkinObservation(BaseModel):
    """The JSON contract Gemini must satisfy — the thing being optimized for.

    Observations only: no routine, product, or treatment advice, and no medical
    diagnosis. ``observations`` is ordered most-prominent first.
    """

    skinType: SkinType
    faceType: FaceType
    confidence: float = Field(ge=0.0, le=1.0)
    observations: list[Observation]
    surface: Surface
    notes: list[str]
    referToProfessional: ReferToProfessional
    imageQuality: ImageQuality
    safetyFlags: list[str]


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------


class PromptPair(BaseModel):
    """The two Gemini prompts optimized jointly as one unit."""

    system_instruction: str
    user_prompt: str


# ---------------------------------------------------------------------------
# Executor results
# ---------------------------------------------------------------------------


class ImageResult(BaseModel):
    """Outcome of running the current PromptPair against one test image.

    Exactly one of ``parsed`` / ``validation_error`` / ``error`` describes the
    outcome: a validated result, a response that failed schema validation, or a
    transport failure after all retries.
    """

    image_name: str
    raw_text: str = ""
    parsed: SkinObservation | None = None
    validation_error: str | None = None
    error: str | None = None
    latency_s: float = 0.0
    prompt_tokens: int = 0
    output_tokens: int = 0


# ---------------------------------------------------------------------------
# Grader output (OpenAI structured output)
# ---------------------------------------------------------------------------


class CriterionScore(BaseModel):
    """Score for a single criterion from criteria.md (0-100)."""

    criterion: str
    score: float


class GapItem(BaseModel):
    """One concrete, evidence-backed gap between outputs and the criteria."""

    gap: str
    severity: Literal["critical", "major", "minor"]
    evidence: str  # which image/output demonstrates it
    suggested_direction: str


class GradeReport(BaseModel):
    """Grader verdict for one iteration. An empty manifest is the stop signal."""

    per_criterion_scores: list[CriterionScore]
    overall_score: float  # 0-100
    manifest: list[GapItem]
    trend: Literal["improved", "degraded", "unchanged", "first_run"]
    trend_rationale: str

    def scores_dict(self) -> dict[str, float]:
        """Return per-criterion scores as the spec's dict[str, float] view."""
        return {item.criterion: item.score for item in self.per_criterion_scores}


# ---------------------------------------------------------------------------
# Prompt Engineer output (OpenAI structured output)
# ---------------------------------------------------------------------------


class EngineerOutput(BaseModel):
    """New prompt pair plus the engineer's reasoning (kept for the record)."""

    rationale: str
    system_instruction: str
    user_prompt: str

    def as_pair(self) -> PromptPair:
        return PromptPair(
            system_instruction=self.system_instruction,
            user_prompt=self.user_prompt,
        )


# ---------------------------------------------------------------------------
# Run bookkeeping
# ---------------------------------------------------------------------------


class BestRecord(BaseModel):
    """Best score seen so far and the prompts/phase that produced it."""

    score: float = -1.0
    prompts: PromptPair
    phase: str = ""
    iteration: int = -1


class IterationRecord(BaseModel):
    """Everything worth persisting about one executor+grader cycle."""

    iteration: int
    phase: str
    model: str
    prompts: PromptPair
    outputs: list[ImageResult]
    grade: GradeReport
    timestamp: str


class AgentPrompts(BaseModel):
    """Grader/engineer prompt texts, loaded from config.yaml's `prompts` section.

    engineer_system is a template with {safety} and {guides} placeholders filled
    at call time (safety = engineer_safety_constraint, guides = the Gemini guide).
    """

    grader_system: str
    grader_target_schema: str
    engineer_system: str
    engineer_safety_constraint: str
    engineer_target_schema: str


class RunConfig(BaseModel):
    """Immutable run parameters resolved once in main.py."""

    run_id: str
    threshold: float
    criteria_text: str
    guides_text: str
    agent_prompts: AgentPrompts
    labels_text: str | None = None  # optional test_images/labels.json contents
    images_dir: str
    runs_dir: str
    max_iterations: int
    validation_max_iterations: int
    plateau_patience: int = 3
    flash_model: str = "gemini-2.5-flash"
    pro_model: str = "gemini-2.5-pro"
    agent_model: str = "gpt-4o"
    concurrency: int = 4
    max_retries: int = 3
    pro_call_warn_limit: int = 50
    # Local smoke-test mode: when set, every call (executor + agents) goes to
    # this OpenAI-compatible server/model instead of real Gemini/OpenAI.
    local_base_url: str | None = None
    local_model: str | None = None

    def executor_model(self, phase: str) -> str:
        """Model id for the given phase: flash for exploration, pro for validation.

        In local mode both phases run on the one local model (the two-tier flow
        is still exercised end-to-end, just without a real flash/pro split).
        """
        if self.local_model:
            return self.local_model
        return self.flash_model if phase == "exploration" else self.pro_model


# ---------------------------------------------------------------------------
# LangGraph state
# ---------------------------------------------------------------------------


class OptimizerState(TypedDict):
    """Full graph state. ``iteration`` counts executor runs, starting at 0 for
    the seed baseline; ``validation_iteration`` counts pro-phase runs only."""

    iteration: int
    validation_iteration: int
    phase: Literal["exploration", "validation"]
    prompts: PromptPair
    outputs: list[ImageResult]
    grade: GradeReport | None
    prev_outputs: list[ImageResult] | None  # previous cycle, shown to the grader
    prev_score: float | None
    best: BestRecord | None
    history: list[IterationRecord]
    config: RunConfig
