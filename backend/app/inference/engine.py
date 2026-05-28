"""
Inference Engine
================
Implements FORWARD CHAINING and BACKWARD CHAINING to derive
conclusions from the knowledge base rules.

Forward chaining  → start from FACTS, fire rules, conclude actions.
Backward chaining → start from a GOAL, work backwards to check if
                    facts support it.

Every conclusion carries a full reasoning trace so the dashboard
can show WHY a decision was made (explainable AI).
"""

from typing import List, Dict, Any, Optional, Tuple
from app.knowledge_base.kb import PRODUCTION_RULES, Rule


# ─────────────────────────────────────────────────────────────
# DATA CLASSES
# ─────────────────────────────────────────────────────────────

class ReasoningStep:
    def __init__(self, rule_id: str, matched: bool, explanation: str, action: Optional[str] = None):
        self.rule_id = rule_id
        self.matched = matched
        self.explanation = explanation
        self.action = action

    def to_dict(self) -> dict:
        return {
            "rule_id":     self.rule_id,
            "matched":     self.matched,
            "explanation": self.explanation,
            "action":      self.action,
        }


class InferenceResult:
    def __init__(self, actions: List[str], steps: List[ReasoningStep], facts: dict):
        self.actions = actions
        self.steps = steps
        self.facts = facts

    def to_dict(self) -> dict:
        return {
            "actions":        self.actions,
            "reasoning_trace": [s.to_dict() for s in self.steps],
            "input_facts":    self.facts,
        }


# ─────────────────────────────────────────────────────────────
# FORWARD CHAINING ENGINE
# ─────────────────────────────────────────────────────────────

class ForwardChainingEngine:
    """
    Classic data-driven inference.

    Algorithm:
    1. Load all known facts (traffic density, weather, etc.)
    2. Scan every rule in the knowledge base.
    3. If a rule's condition matches the facts → fire it (add action to agenda).
    4. Continue until no new rules fire (fixed point).

    Complexity: O(rules × facts) per cycle — efficient for small rule sets.
    """

    def __init__(self, rules: List[Rule] = None):
        self.rules = rules or PRODUCTION_RULES

    def infer(self, facts: Dict[str, Any]) -> InferenceResult:
        actions: List[str] = []
        steps:   List[ReasoningStep] = []
        fired_rules = set()

        # One pass: check every rule
        for rule in self.rules:
            try:
                matched = bool(rule.condition(facts))
            except Exception:
                matched = False

            if matched and rule.id not in fired_rules:
                fired_rules.add(rule.id)
                actions.append(rule.action)
                steps.append(ReasoningStep(
                    rule_id=rule.id,
                    matched=True,
                    explanation=rule.explanation,
                    action=rule.action,
                ))
            else:
                steps.append(ReasoningStep(
                    rule_id=rule.id,
                    matched=False,
                    explanation=f"Rule {rule.id} condition NOT met → skipped.",
                ))

        if not actions:
            actions.append("no_action_required")

        return InferenceResult(actions=actions, steps=steps, facts=facts)


# ─────────────────────────────────────────────────────────────
# BACKWARD CHAINING ENGINE
# ─────────────────────────────────────────────────────────────

class BackwardChainingEngine:
    """
    Goal-driven inference.

    Algorithm:
    1. Start with a GOAL action (e.g. 'activate_emergency_priority').
    2. Find which rules can produce that action.
    3. Check if those rules' conditions are satisfied by current facts.
    4. Return True/False + explanation of why the goal is (not) achievable.

    Useful for: "CAN we activate emergency mode right now?" type queries.
    """

    def __init__(self, rules: List[Rule] = None):
        self.rules = rules or PRODUCTION_RULES

    def prove_goal(self, goal_action: str, facts: Dict[str, Any]) -> Tuple[bool, List[ReasoningStep]]:
        steps: List[ReasoningStep] = []

        # Find rules that produce the goal action
        candidate_rules = [r for r in self.rules if r.action == goal_action]

        if not candidate_rules:
            steps.append(ReasoningStep(
                rule_id="NONE",
                matched=False,
                explanation=f"No rule in knowledge base produces goal '{goal_action}'.",
            ))
            return False, steps

        for rule in candidate_rules:
            try:
                matched = bool(rule.condition(facts))
            except Exception:
                matched = False

            if matched:
                steps.append(ReasoningStep(
                    rule_id=rule.id,
                    matched=True,
                    explanation=f"Goal '{goal_action}' PROVED via rule {rule.id}: {rule.explanation}",
                    action=goal_action,
                ))
                return True, steps
            else:
                steps.append(ReasoningStep(
                    rule_id=rule.id,
                    matched=False,
                    explanation=f"Rule {rule.id} could produce goal but condition not met: {rule.description}",
                ))

        return False, steps


# ─────────────────────────────────────────────────────────────
# UNIFIED INFERENCE ENGINE (facade used by API layer)
# ─────────────────────────────────────────────────────────────

class InferenceEngine:
    """
    Public interface for the inference subsystem.
    Wraps both forward and backward chaining engines.
    """

    def __init__(self):
        self.forward  = ForwardChainingEngine()
        self.backward = BackwardChainingEngine()

    def evaluate_traffic(self, density: float, weather: str = "clear",
                         emergency: bool = False, is_peak: bool = False) -> InferenceResult:
        """
        Main entry point: given sensor readings, infer optimal actions.

        Parameters
        ----------
        density   : vehicle density 0–100 %
        weather   : "clear" | "rain" | "fog" | "storm"
        emergency : True if emergency vehicle detected nearby
        is_peak   : True if current hour is a known peak hour
        """
        facts = {
            "density":            density,
            "weather":            weather,
            "emergency_detected": emergency,
            "is_peak_hour":       is_peak,
        }
        return self.forward.infer(facts)

    def can_activate_emergency(self, facts: dict) -> Tuple[bool, List[ReasoningStep]]:
        """Backward-chain: check if emergency mode is justifiable."""
        return self.backward.prove_goal("activate_emergency_priority", facts)

    def get_signal_timing(self, density: float) -> int:
        """Quick helper: return recommended green-light duration in seconds."""
        if density > 75:
            return 60
        elif density > 40:
            return 30
        else:
            return 20


# Module-level singleton
engine = InferenceEngine()
