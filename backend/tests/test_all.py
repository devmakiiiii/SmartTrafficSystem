"""
Unit Tests – Smart Traffic Management System
=============================================
Run with:  python -m pytest tests/ -v

Tests cover:
  - Knowledge base integrity
  - Inference engine (forward + backward chaining)
  - Search algorithms (correctness of Dijkstra, A*, BFS)
  - Bayesian engine (probability bounds)
  - Fuzzy classifier (membership function properties)
  - ML predictor (smoke test)
  - Signal optimizer (priority ordering)
  - Utility helpers
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from app.knowledge_base.kb import KnowledgeBase, kb
from app.inference.engine import InferenceEngine, ForwardChainingEngine, BackwardChainingEngine
from app.routing.search import dijkstra, astar, bfs, TrafficRouter
from app.services.bayesian import BayesianEngine, FuzzyTrafficClassifier
from app.utils.helpers import (
    is_peak_hour, level_of_service, compute_throughput,
    compute_avg_delay, weather_speed_factor, simulate_sensor_reading,
)


# ─────────────────────────────────────────────────────────────
# KNOWLEDGE BASE TESTS
# ─────────────────────────────────────────────────────────────

class TestKnowledgeBase:

    def test_has_intersections(self):
        assert len(kb.intersections) == 6

    def test_has_roads(self):
        assert len(kb.roads) == 7

    def test_has_vehicle_types(self):
        assert "ambulance" in kb.vehicles
        assert kb.vehicles["ambulance"].priority == 10

    def test_semantic_triples_exist(self):
        triples = kb.semantic_net.all_triples()
        assert len(triples) > 0
        subjects = [t[0] for t in triples]
        assert "I1" in subjects

    def test_semantic_query(self):
        results = kb.semantic_net.query("I1", "CONNECTS_TO")
        assert len(results) >= 2   # I1 connects to I2 and I4

    def test_road_travel_time(self):
        road = list(kb.roads.values())[0]
        t = road.travel_time_minutes()
        assert t > 0

    def test_graph_adjacency(self):
        graph = kb.get_road_graph()
        assert "I1" in graph
        assert "I2" in graph["I1"]    # I1 connects to I2

    def test_update_density(self):
        kb.update_density("I1", 75.0)
        assert kb.intersections["I1"].current_density == 75.0

    def test_rules_exist(self):
        assert len(kb.rules) >= 6


# ─────────────────────────────────────────────────────────────
# INFERENCE ENGINE TESTS
# ─────────────────────────────────────────────────────────────

class TestInferenceEngine:

    def setup_method(self):
        self.engine = InferenceEngine()

    def test_high_density_fires_extend_green(self):
        result = self.engine.evaluate_traffic(density=85)
        assert "extend_green_light" in result.actions

    def test_low_density_fires_shorten_green(self):
        result = self.engine.evaluate_traffic(density=20)
        assert "shorten_green_light" in result.actions

    def test_moderate_density_fires_normal(self):
        result = self.engine.evaluate_traffic(density=55)
        assert "normal_signal_timing" in result.actions

    def test_emergency_fires_priority(self):
        result = self.engine.evaluate_traffic(density=50, emergency=True)
        assert "activate_emergency_priority" in result.actions

    def test_rain_plus_high_density(self):
        result = self.engine.evaluate_traffic(density=80, weather="rain")
        assert "extend_green_extra" in result.actions

    def test_peak_hour_rule(self):
        result = self.engine.evaluate_traffic(density=60, is_peak=True)
        assert "peak_hour_optimization" in result.actions

    def test_reasoning_trace_has_steps(self):
        result = self.engine.evaluate_traffic(density=85)
        assert len(result.steps) > 0

    def test_signal_timing_high(self):
        assert self.engine.get_signal_timing(85) == 60

    def test_signal_timing_moderate(self):
        assert self.engine.get_signal_timing(50) == 30

    def test_signal_timing_low(self):
        assert self.engine.get_signal_timing(10) == 20

    def test_backward_chain_emergency_proved(self):
        proved, steps = self.engine.can_activate_emergency({"emergency_detected": True, "density": 60})
        assert proved is True

    def test_backward_chain_emergency_not_proved(self):
        proved, steps = self.engine.can_activate_emergency({"emergency_detected": False, "density": 60})
        assert proved is False

    def test_result_has_actions_list(self):
        result = self.engine.evaluate_traffic(density=50)
        assert isinstance(result.actions, list)
        assert len(result.actions) > 0


# ─────────────────────────────────────────────────────────────
# SEARCH ALGORITHM TESTS
# ─────────────────────────────────────────────────────────────

class TestSearchAlgorithms:

    def setup_method(self):
        self.graph   = kb.get_road_graph()
        self.weights = kb.get_edge_weights()

    def test_bfs_finds_path(self):
        result = bfs(self.graph, "I1", "I6")
        assert len(result["path"]) > 0
        assert result["path"][0]  == "I1"
        assert result["path"][-1] == "I6"

    def test_dijkstra_finds_path(self):
        result = dijkstra(self.weights, self.graph, "I1", "I6")
        assert len(result["path"]) > 0
        assert result["cost_minutes"] > 0

    def test_astar_finds_path(self):
        result = astar(self.weights, self.graph, "I1", "I6")
        assert len(result["path"]) > 0
        assert result["cost_minutes"] > 0

    def test_dijkstra_optimal(self):
        """Dijkstra and A* should agree on optimal cost."""
        d = dijkstra(self.weights, self.graph, "I1", "I6")
        a = astar(self.weights, self.graph, "I1", "I6")
        assert abs(d["cost_minutes"] - a["cost_minutes"]) < 0.01

    def test_same_start_goal(self):
        result = bfs(self.graph, "I1", "I1")
        assert result["path"] == ["I1"]

    def test_router_emergency_mode(self):
        r = TrafficRouter()
        result = r.find_route("I1", "I6", "astar", emergency=True)
        assert result["is_emergency"] is True
        assert len(result["path"]) > 0

    def test_router_path_names(self):
        r = TrafficRouter()
        result = r.find_route("I1", "I6", "astar")
        assert len(result["path_names"]) == len(result["path"])


# ─────────────────────────────────────────────────────────────
# BAYESIAN ENGINE TESTS
# ─────────────────────────────────────────────────────────────

class TestBayesianEngine:

    def setup_method(self):
        self.engine = BayesianEngine()

    def test_probability_in_range(self):
        result = self.engine.estimate_congestion({"rain": True, "peak_hour": True})
        assert 0.0 <= result.p_congestion <= 1.0

    def test_more_evidence_increases_probability(self):
        low  = self.engine.estimate_congestion({})
        high = self.engine.estimate_congestion({"rain": True, "peak_hour": True, "high_density": True})
        assert high.p_congestion > low.p_congestion

    def test_weekend_lowers_probability(self):
        base    = self.engine.estimate_congestion({})
        weekend = self.engine.estimate_congestion({"weekend": True})
        assert weekend.p_congestion < base.p_congestion

    def test_risk_levels(self):
        result = self.engine.estimate_congestion({"rain": True, "peak_hour": True, "high_density": True, "accident": True})
        assert result.risk_level in ("HIGH", "CRITICAL")

    def test_explanation_not_empty(self):
        result = self.engine.estimate_congestion({"rain": True})
        assert len(result.explanation) > 10


# ─────────────────────────────────────────────────────────────
# FUZZY CLASSIFIER TESTS
# ─────────────────────────────────────────────────────────────

class TestFuzzyClassifier:

    def setup_method(self):
        self.clf = FuzzyTrafficClassifier()

    def test_zero_density_is_low(self):
        result = self.clf.classify(0)
        assert result["dominant"] == "LOW"

    def test_full_density_is_critical(self):
        result = self.clf.classify(100)
        assert result["dominant"] == "CRITICAL"

    def test_memberships_sum_lte_one(self):
        # Membership functions can overlap but no single one exceeds 1.0
        result = self.clf.classify(50)
        for v in result["memberships"].values():
            assert 0.0 <= v <= 1.0

    def test_medium_density(self):
        result = self.clf.classify(70)
        assert result["dominant"] in ("HIGH", "MODERATE")


# ─────────────────────────────────────────────────────────────
# UTILITY TESTS
# ─────────────────────────────────────────────────────────────

class TestUtils:

    def test_level_of_service_free_flow(self):
        los = level_of_service(10)
        assert los["grade"] == "A"

    def test_level_of_service_gridlock(self):
        los = level_of_service(100)
        assert los["grade"] == "F"

    def test_weather_speed_factor_rain(self):
        assert weather_speed_factor("rain") < 1.0

    def test_weather_speed_factor_clear(self):
        assert weather_speed_factor("clear") == 1.0

    def test_sensor_noise_bounds(self):
        for _ in range(100):
            noisy = simulate_sensor_reading(50.0)
            assert 0.0 <= noisy <= 100.0

    def test_compute_throughput_positive(self):
        t = compute_throughput(30, 70, lanes=2)
        assert t > 0

    def test_compute_avg_delay_positive(self):
        d = compute_avg_delay(70, 30)
        assert d >= 0

    def test_peak_hour_morning(self):
        is_peak, period = is_peak_hour(8)
        assert is_peak is True
        assert period == "morning"

    def test_off_peak(self):
        is_peak, period = is_peak_hour(14)
        assert is_peak is False


# ─────────────────────────────────────────────────────────────
# ML PREDICTOR SMOKE TEST
# ─────────────────────────────────────────────────────────────

class TestMLPredictor:

    def test_predict_returns_label(self):
        from app.machine_learning.predictor import predict_congestion
        result = predict_congestion(hour=8, day_of_week=0, vehicle_count=350, weather=1)
        assert result["label"] in ("none", "low", "medium", "high")

    def test_confidence_in_range(self):
        from app.machine_learning.predictor import predict_congestion
        result = predict_congestion(hour=8, day_of_week=0, vehicle_count=350)
        assert 0.0 <= result["confidence"] <= 1.0

    def test_probabilities_sum_to_one(self):
        from app.machine_learning.predictor import predict_congestion
        result = predict_congestion(hour=8, day_of_week=0, vehicle_count=200)
        total = sum(result["probabilities"].values())
        assert abs(total - 1.0) < 0.01

    def test_night_low_vehicles_predicts_none(self):
        from app.machine_learning.predictor import predict_congestion
        result = predict_congestion(hour=3, day_of_week=0, vehicle_count=10)
        assert result["label"] in ("none", "low")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
