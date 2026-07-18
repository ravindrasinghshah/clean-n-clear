"""LangGraph wiring: executor → grader → recorder → router, two-tier flow.

Exploration runs on flash until the grader is satisfied, the iteration budget
is spent, or scores plateau; then the best prompts are promoted to a pro
validation pass. Validation gets a bounded number of additional improve cycles
(executor staying on pro) before the run ends. The winner reported by main.py
always comes from the tracked best/history, never simply the last iteration.
"""

from __future__ import annotations

import logging

from langgraph.graph import END, START, StateGraph

from optimizer.nodes.engineer import engineer_node
from optimizer.nodes.executor import executor_node
from optimizer.nodes.grader import grader_node
from optimizer.nodes.recorder import recorder_node
from optimizer.schemas import OptimizerState

log = logging.getLogger("optimizer.router")


def _plateaued(state: OptimizerState) -> bool:
    """True when the last `plateau_patience` exploration grades all failed to improve."""
    patience = state["config"].plateau_patience
    exploration = [r for r in state["history"] if r.phase == "exploration"]
    if len(exploration) < patience + 1:  # need a baseline plus `patience` follow-ups
        return False
    recent = exploration[-patience:]
    return all(r.grade.trend in ("degraded", "unchanged") for r in recent)


def route_after_recording(state: OptimizerState) -> str:
    """Conditional edge implementing the two-tier flow from the spec."""
    config = state["config"]
    grade = state["grade"]
    assert grade is not None

    if state["phase"] == "exploration":
        if not grade.manifest or grade.overall_score >= config.threshold:
            log.info("Exploration goal met — promoting to pro validation")
            return "promote"
        if state["iteration"] + 1 >= config.max_iterations:
            log.info("Exploration budget spent — promoting best prompts to validation")
            return "promote"
        if _plateaued(state):
            log.info("Plateau detected — promoting best prompts to validation")
            return "promote"
        return "engineer"

    # Validation phase (executor on pro).
    if grade.overall_score >= config.threshold:
        log.info("Validation passed at %.1f — done", grade.overall_score)
        return "end"
    if state["validation_iteration"] > config.validation_max_iterations:
        log.warning(
            "Validation budget spent, best still below threshold %.1f",
            config.threshold,
        )
        return "end"
    return "engineer"


def promote_node(state: OptimizerState) -> dict:
    """Switch to the validation phase using the best exploration prompts.

    Resets the grader's previous-iteration context (flash and pro outputs are
    not comparable) and emits the pro-phase cost-guard warning.
    """
    config = state["config"]
    best = state["best"]
    assert best is not None

    projected_calls = len(state["outputs"]) * (1 + config.validation_max_iterations)
    if projected_calls > config.pro_call_warn_limit:
        log.warning(
            "Cost guard: projected pro-phase calls (%d) exceed limit (%d)",
            projected_calls,
            config.pro_call_warn_limit,
        )

    log.info(
        "Entering validation with best prompts from iteration %d (score %.1f)",
        best.iteration,
        best.score,
    )
    return {
        "phase": "validation",
        "prompts": best.prompts,
        "prev_outputs": None,
        "prev_score": None,
    }


def build_graph():
    """Compile the optimizer state machine."""
    graph = StateGraph(OptimizerState)
    graph.add_node("executor", executor_node)
    graph.add_node("grader", grader_node)
    graph.add_node("recorder", recorder_node)
    graph.add_node("engineer", engineer_node)
    graph.add_node("promote", promote_node)

    graph.add_edge(START, "executor")
    graph.add_edge("executor", "grader")
    graph.add_edge("grader", "recorder")
    graph.add_conditional_edges(
        "recorder",
        route_after_recording,
        {"engineer": "engineer", "promote": "promote", "end": END},
    )
    graph.add_edge("engineer", "executor")
    graph.add_edge("promote", "executor")

    return graph.compile()
