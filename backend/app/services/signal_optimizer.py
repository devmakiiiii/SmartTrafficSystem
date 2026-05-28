"""
Signal Optimization Service
============================
Coordinates inference engine, Bayesian estimates, and ML predictions
to produce the best possible signal timing for each intersection.

This is the "decision layer" that sits between raw AI outputs and the
API. It combines multiple signals and resolves conflicts between them.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Any
from datetime import datetime

from app.inference.engine import engine, InferenceResult
from app.services.bayesian import bayes_engine, fuzzy_classifier
from app.knowledge_base.kb import kb


# ─────────────────────────────────────────────────────────────
# SIGNAL PLAN
# ─────────────────────────────────────────────────────────────

@dataclass
class SignalPlan:
    """Complete signal timing plan for one intersection."""
    intersection_id:  str
    green_duration:   int       # seconds
    yellow_duration:  int = 3
    red_duration:     int = 30
    cycle_length:     int = 0   # computed
    actions:          List[str] = None
    risk_level:       str = "LOW"
    p_congestion:     float = 0.0
    explanation:      str = ""

    def __post_init__(self):
        self.cycle_length = self.green_duration + self.yellow_duration + self.red_duration
        if self.actions is None:
            self.actions = []

    def to_dict(self) -> dict:
        return {
            "intersection_id":  self.intersection_id,
            "green_duration":   self.green_duration,
            "yellow_duration":  self.yellow_duration,
            "red_duration":     self.red_duration,
            "cycle_length":     self.cycle_length,
            "actions":          self.actions,
            "risk_level":       self.risk_level,
            "p_congestion":     round(self.p_congestion, 3),
            "explanation":      self.explanation,
        }


# ─────────────────────────────────────────────────────────────
# OPTIMIZER
# ─────────────────────────────────────────────────────────────

class SignalOptimizer:
    """
    Multi-source signal optimizer.

    Priority order (highest wins on conflict):
      1. Emergency override   → always 60s green on route
      2. Inference engine     → rule-based timing
      3. Bayesian risk        → scales up if P(C) is HIGH/CRITICAL
      4. Fuzzy classification → fine-tunes duration
    """

    def optimize_intersection(
        self,
        intersection_id: str,
        density: float,
        weather: str = "clear",
        emergency: bool = False,
        is_peak: bool = False,
        accident: bool = False,
    ) -> SignalPlan:

        # ── 1. Emergency override ───────────────────────────
        if emergency:
            inter = kb.get_intersection(intersection_id)
            if inter:
                inter.is_emergency_active = True
                inter.signal_phase = "green"
            return SignalPlan(
                intersection_id=intersection_id,
                green_duration=60,
                actions=["activate_emergency_priority"],
                risk_level="CRITICAL",
                p_congestion=1.0,
                explanation=(
                    "EMERGENCY OVERRIDE: 60s green, all conflicting phases cleared. "
                    "Emergency vehicle has right-of-way."
                ),
            )

        # ── 2. Inference engine ─────────────────────────────
        inf_result: InferenceResult = engine.evaluate_traffic(
            density=density, weather=weather,
            emergency=False, is_peak=is_peak,
        )
        base_green = engine.get_signal_timing(density)

        # ── 3. Bayesian risk ────────────────────────────────
        evidence = {
            "rain":         weather == "rain",
            "fog":          weather in ("fog", "storm"),
            "peak_hour":    is_peak,
            "high_density": density > 75,
            "accident":     accident,
            "weekend":      datetime.now().weekday() >= 5,
        }
        bayes_result = bayes_engine.estimate_congestion(evidence)
        p_c   = bayes_result.p_congestion
        risk  = bayes_result.risk_level

        # Scale green duration by Bayesian risk
        if risk == "CRITICAL":
            green = min(90, base_green + 30)
        elif risk == "HIGH":
            green = min(70, base_green + 15)
        elif risk == "MEDIUM":
            green = min(50, base_green + 5)
        else:
            green = base_green

        # ── 4. Fuzzy fine-tune ──────────────────────────────
        fuzzy = fuzzy_classifier.classify(density)
        if fuzzy["dominant"] == "CRITICAL" and green < 80:
            green = 80
        elif fuzzy["dominant"] == "HIGH" and green < 50:
            green = 50

        # ── Update KB ───────────────────────────────────────
        inter = kb.get_intersection(intersection_id)
        if inter:
            inter.green_duration = green
            inter.current_density = density

        plan = SignalPlan(
            intersection_id=intersection_id,
            green_duration=green,
            actions=inf_result.actions,
            risk_level=risk,
            p_congestion=p_c,
            explanation=(
                f"Density={density:.0f}% | Inference: {', '.join(inf_result.actions)} | "
                f"Bayesian P(C)={p_c:.1%} ({risk}) | Fuzzy: {fuzzy['dominant']} | "
                f"Final green: {green}s"
            ),
        )
        return plan

    def optimize_network(
        self,
        weather: str = "clear",
        is_peak: bool = False,
    ) -> Dict[str, Any]:
        """Optimize all intersections simultaneously."""
        plans = {}
        for iid, inter in kb.intersections.items():
            plan = self.optimize_intersection(
                intersection_id=iid,
                density=inter.current_density,
                weather=weather,
                is_peak=is_peak,
            )
            plans[iid] = plan.to_dict()
        return {
            "timestamp": datetime.now().isoformat(),
            "weather":   weather,
            "is_peak":   is_peak,
            "plans":     plans,
        }


# Module-level singleton
optimizer = SignalOptimizer()
