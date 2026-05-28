"""
Bayesian Uncertainty Module
===========================
Handles uncertain, noisy, or incomplete traffic information using:

1. Bayesian Inference    – P(Congestion | Evidence) via Bayes' theorem
2. Fuzzy Logic           – linguistic classification of traffic severity

BAYES' THEOREM:
  P(C | E) = P(E | C) × P(C) / P(E)

Where:
  C = Congestion event
  E = Evidence (rain, high density reading, time of day, etc.)

Example:
  P(Congestion | Rain) = P(Rain | Congestion) × P(Congestion) / P(Rain)

We model several independent evidence signals and combine them
using the Naive Bayes assumption (conditionally independent given C).
"""

from dataclasses import dataclass
from typing import Dict, List, Any


# ─────────────────────────────────────────────────────────────
# PRIOR AND LIKELIHOOD TABLES
# These would normally be learned from historical data.
# Here they are hand-calibrated from domain knowledge.
# ─────────────────────────────────────────────────────────────

# P(Congestion) — base rate across all hours
P_CONGESTION = 0.35

# P(Evidence | Congestion)  vs  P(Evidence | No Congestion)
# Each entry: (P(e|C), P(e|¬C))
LIKELIHOODS: Dict[str, tuple] = {
    "rain":        (0.70, 0.30),   # rain more likely when congested
    "peak_hour":   (0.85, 0.25),
    "high_density":(0.90, 0.15),
    "accident":    (0.60, 0.05),
    "sensor_error":(0.10, 0.10),   # sensor errors don't correlate with congestion
    "weekend":     (0.20, 0.55),   # weekends less congested
    "fog":         (0.50, 0.20),
}


# ─────────────────────────────────────────────────────────────
# NAIVE BAYES CONGESTION ESTIMATOR
# ─────────────────────────────────────────────────────────────

@dataclass
class BayesResult:
    p_congestion: float             # posterior probability of congestion
    evidence_used: List[str]        # which signals were active
    explanation: str
    risk_level: str                 # "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

    def to_dict(self) -> dict:
        return {
            "p_congestion":  round(self.p_congestion, 4),
            "evidence_used": self.evidence_used,
            "explanation":   self.explanation,
            "risk_level":    self.risk_level,
        }


class BayesianEngine:
    """
    Naive Bayes classifier for traffic congestion probability.

    Assumes evidence signals are conditionally independent given C.
    This lets us multiply individual likelihoods:

    P(C | e1, e2, …, en) ∝ P(C) × ∏ P(ei | C)

    Both P(C|E) and P(¬C|E) are computed, then normalised to sum to 1.
    """

    def estimate_congestion(self, evidence: Dict[str, bool]) -> BayesResult:
        """
        Parameters
        ----------
        evidence : dict mapping signal name → True/False
                   e.g. {"rain": True, "peak_hour": False, "accident": True}

        Returns
        -------
        BayesResult with posterior probability and explanation.
        """
        # Start with priors
        p_c    = P_CONGESTION
        p_nc   = 1 - P_CONGESTION

        active = []

        for signal, is_active in evidence.items():
            if signal not in LIKELIHOODS:
                continue
            p_e_given_c, p_e_given_nc = LIKELIHOODS[signal]

            if is_active:
                p_c  *= p_e_given_c
                p_nc *= p_e_given_nc
                active.append(signal)
            else:
                # Use complement likelihoods
                p_c  *= (1 - p_e_given_c)
                p_nc *= (1 - p_e_given_nc)

        # Normalise
        total = p_c + p_nc
        if total == 0:
            posterior = P_CONGESTION
        else:
            posterior = p_c / total

        risk = self._risk_level(posterior)
        explanation = self._explain(posterior, active, risk)

        return BayesResult(
            p_congestion=posterior,
            evidence_used=active,
            explanation=explanation,
            risk_level=risk,
        )

    @staticmethod
    def _risk_level(p: float) -> str:
        if p < 0.30:   return "LOW"
        if p < 0.55:   return "MEDIUM"
        if p < 0.75:   return "HIGH"
        return "CRITICAL"

    @staticmethod
    def _explain(p: float, evidence: List[str], risk: str) -> str:
        ev_str = ", ".join(evidence) if evidence else "no active signals"
        return (
            f"Bayesian posterior P(Congestion | evidence) = {p:.1%}. "
            f"Active signals: [{ev_str}]. "
            f"Risk level: {risk}. "
            f"{'Recommend signal extension and alternate routing.' if p > 0.55 else 'Normal operations.'}"
        )


# ─────────────────────────────────────────────────────────────
# FUZZY LOGIC  –  linguistic traffic severity
# ─────────────────────────────────────────────────────────────

class FuzzyTrafficClassifier:
    """
    Maps a crisp density value (0–100) to a fuzzy linguistic label
    using triangular membership functions.

    Membership functions:
      LOW      : peaks at 0,  zero by 40
      MODERATE : peaks at 50, zero at 20 and 80
      HIGH     : peaks at 80, zero by 60
      CRITICAL : peaks at 100, zero by 85
    """

    LABELS = ["LOW", "MODERATE", "HIGH", "CRITICAL"]

    def classify(self, density: float) -> Dict[str, Any]:
        memberships = {
            "LOW":      self._trimf(density,  0,   0,  40),
            "MODERATE": self._trimf(density, 20,  50,  80),
            "HIGH":     self._trimf(density, 60,  80, 100),
            "CRITICAL": self._trimf(density, 85, 100, 100),
        }
        dominant = max(memberships, key=memberships.get)
        return {
            "density":      density,
            "memberships":  {k: round(v, 3) for k, v in memberships.items()},
            "dominant":     dominant,
            "explanation":  f"Density {density}% maps most strongly to '{dominant}' "
                            f"(μ={memberships[dominant]:.2f}). "
                            f"Fuzzy boundaries allow gradual transitions between severity levels.",
        }

    @staticmethod
    def _trimf(x: float, a: float, b: float, c: float) -> float:
        """Triangular membership function: 0 at a and c, peak 1 at b.
        When b == c (right-shoulder), return 1.0 at the peak/endpoint."""
        if x < a or x > c:
            return 0.0
        if b == c and x == c:   # right-shoulder: peak at endpoint
            return 1.0
        if a == b and x == a:   # left-shoulder: peak at start
            return 1.0
        if x <= b:
            return (x - a) / (b - a) if b != a else 1.0
        return (c - x) / (c - b) if c != b else 1.0


# Module-level singletons
bayes_engine    = BayesianEngine()
fuzzy_classifier = FuzzyTrafficClassifier()
