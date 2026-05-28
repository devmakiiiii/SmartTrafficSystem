"""
Knowledge Base Module
=====================
Implements knowledge representation using:
- Frames (structured entity definitions)
- Semantic network (relationships between entities)
- Production rules (IF-THEN logic)

This is the "memory" of the AI system. It stores facts about
the world (roads, intersections, vehicles, signals) and the
rules used to reason about them.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any


# ─────────────────────────────────────────────────────────────
# FRAMES  (structured knowledge about entities)
# A "frame" is like a class/record that bundles an entity's
# attributes and default values together.
# ─────────────────────────────────────────────────────────────

@dataclass
class IntersectionFrame:
    """Frame representing one road intersection."""
    id: str
    name: str
    latitude: float
    longitude: float
    num_lanes: int = 2
    has_sensors: bool = True
    connected_to: List[str] = field(default_factory=list)   # adjacent intersection IDs
    current_density: float = 0.0        # 0–100 %
    signal_phase: str = "green"         # green | yellow | red
    green_duration: int = 30            # seconds
    is_emergency_active: bool = False


@dataclass
class VehicleFrame:
    """Frame representing a vehicle type."""
    type: str           # car | bus | truck | ambulance | fire_truck
    avg_speed_kmh: float
    avg_length_m: float
    priority: int       # 1 = normal, 10 = emergency


@dataclass
class RoadFrame:
    """Frame representing a road segment between two intersections."""
    id: str
    from_intersection: str
    to_intersection: str
    distance_km: float
    speed_limit_kmh: float
    num_lanes: int = 2
    is_blocked: bool = False
    current_speed_kmh: Optional[float] = None  # None = no data yet

    def travel_time_minutes(self) -> float:
        """Estimated travel time based on current speed."""
        speed = self.current_speed_kmh or self.speed_limit_kmh
        return (self.distance_km / speed) * 60


# ─────────────────────────────────────────────────────────────
# SEMANTIC NETWORK
# A graph of entities and their named relationships.
# e.g. Intersection A --[CONNECTS_TO]--> Intersection B
# ─────────────────────────────────────────────────────────────

class SemanticNetwork:
    """Stores (subject, relation, object) triples."""

    def __init__(self):
        self._triples: List[tuple] = []

    def add(self, subject: str, relation: str, obj: str):
        self._triples.append((subject, relation, obj))

    def query(self, subject: str = None, relation: str = None) -> List[tuple]:
        result = []
        for s, r, o in self._triples:
            if (subject is None or s == subject) and (relation is None or r == relation):
                result.append((s, r, o))
        return result

    def all_triples(self) -> List[tuple]:
        return list(self._triples)


# ─────────────────────────────────────────────────────────────
# PRODUCTION RULES
# Classic AI rule format: IF <condition> THEN <action>
# Each rule also carries an explanation string so the system
# can tell the user WHY it made a decision (explainability).
# ─────────────────────────────────────────────────────────────

@dataclass
class Rule:
    id: str
    description: str
    condition: Any      # callable: (facts: dict) -> bool
    action: str         # what to do
    explanation: str    # human-readable reasoning

PRODUCTION_RULES: List[Rule] = [
    Rule(
        id="R1",
        description="High density → extend green",
        condition=lambda f: f.get("density", 0) > 75,
        action="extend_green_light",
        explanation="Traffic density exceeds 75 % → extending green signal to 60 s to clear queue."
    ),
    Rule(
        id="R2",
        description="Moderate density → normal timing",
        condition=lambda f: 40 <= f.get("density", 0) <= 75,
        action="normal_signal_timing",
        explanation="Density is moderate (40–75 %) → keeping standard 30 s green cycle."
    ),
    Rule(
        id="R3",
        description="Low density → shorten green",
        condition=lambda f: f.get("density", 0) < 40,
        action="shorten_green_light",
        explanation="Low density (< 40 %) → reducing green to 20 s to improve cycle efficiency."
    ),
    Rule(
        id="R4",
        description="Emergency vehicle → priority signal",
        condition=lambda f: f.get("emergency_detected", False),
        action="activate_emergency_priority",
        explanation="Emergency vehicle detected → all signals on route set to green immediately."
    ),
    Rule(
        id="R5",
        description="Rain + high density → extend green further",
        condition=lambda f: f.get("weather") == "rain" and f.get("density", 0) > 60,
        action="extend_green_extra",
        explanation="Rainy weather + high density → extending green 80 s (wet roads slow braking)."
    ),
    Rule(
        id="R6",
        description="Peak hour → pre-emptive signal extension",
        condition=lambda f: f.get("is_peak_hour", False) and f.get("density", 0) > 50,
        action="peak_hour_optimization",
        explanation="Peak hour detected + density > 50 % → enabling adaptive signal coordination."
    ),
]


# ─────────────────────────────────────────────────────────────
# KNOWLEDGE BASE SINGLETON
# Central store for all frames and the semantic network.
# ─────────────────────────────────────────────────────────────

class KnowledgeBase:
    def __init__(self):
        self.intersections: Dict[str, IntersectionFrame] = {}
        self.roads: Dict[str, RoadFrame] = {}
        self.vehicles: Dict[str, VehicleFrame] = {}
        self.semantic_net = SemanticNetwork()
        self.rules = PRODUCTION_RULES
        self._seed_defaults()

    # ── Seed with default city data ──────────────────────────

    def _seed_defaults(self):
        # Vehicle types
        for v in [
            VehicleFrame("car",        50,  4.5, 1),
            VehicleFrame("bus",        40, 12.0, 2),
            VehicleFrame("truck",      35, 18.0, 2),
            VehicleFrame("ambulance",  80,  6.0, 10),
            VehicleFrame("fire_truck", 70,  9.0, 10),
        ]:
            self.vehicles[v.type] = v

        # City intersections (5-node grid)
        intersections = [
            IntersectionFrame("I1", "Main & 1st",    14.8601, 120.9800, connected_to=["I2","I4"]),
            IntersectionFrame("I2", "Main & 2nd",    14.8610, 120.9820, connected_to=["I1","I3","I5"]),
            IntersectionFrame("I3", "Main & 3rd",    14.8620, 120.9840, connected_to=["I2","I6"]),
            IntersectionFrame("I4", "Park & 1st",    14.8580, 120.9800, connected_to=["I1","I5"]),
            IntersectionFrame("I5", "Park & 2nd",    14.8590, 120.9820, connected_to=["I2","I4","I6"]),
            IntersectionFrame("I6", "Park & 3rd",    14.8600, 120.9840, connected_to=["I3","I5"]),
        ]
        for i in intersections:
            self.intersections[i.id] = i

        # Road segments
        roads = [
            RoadFrame("R1-2", "I1","I2", 0.5, 60),
            RoadFrame("R2-3", "I2","I3", 0.5, 60),
            RoadFrame("R1-4", "I1","I4", 0.4, 50),
            RoadFrame("R2-5", "I2","I5", 0.4, 50),
            RoadFrame("R3-6", "I3","I6", 0.4, 50),
            RoadFrame("R4-5", "I4","I5", 0.5, 60),
            RoadFrame("R5-6", "I5","I6", 0.5, 60),
        ]
        for r in roads:
            self.roads[r.id] = r

        # Semantic network relationships
        for intersection in intersections:
            for neighbor in intersection.connected_to:
                self.semantic_net.add(intersection.id, "CONNECTS_TO", neighbor)
            self.semantic_net.add(intersection.id, "IS_A", "Intersection")

        self.semantic_net.add("ambulance",   "IS_A", "EmergencyVehicle")
        self.semantic_net.add("fire_truck",  "IS_A", "EmergencyVehicle")
        self.semantic_net.add("EmergencyVehicle", "HAS_PRIORITY", "SignalPreemption")

    # ── Public accessors ─────────────────────────────────────

    def get_intersection(self, id: str) -> Optional[IntersectionFrame]:
        return self.intersections.get(id)

    def update_density(self, intersection_id: str, density: float):
        if intersection_id in self.intersections:
            self.intersections[intersection_id].current_density = density

    def get_road_graph(self) -> Dict[str, List[str]]:
        """Adjacency list for search algorithms."""
        graph = {k: [] for k in self.intersections}
        for r in self.roads.values():
            if not r.is_blocked:
                graph[r.from_intersection].append(r.to_intersection)
                graph[r.to_intersection].append(r.from_intersection)
        return graph

    def get_edge_weights(self) -> Dict[tuple, float]:
        """Edge weights as travel time in minutes (for Dijkstra / A*)."""
        weights = {}
        for r in self.roads.values():
            t = r.travel_time_minutes()
            weights[(r.from_intersection, r.to_intersection)] = t
            weights[(r.to_intersection, r.from_intersection)] = t
        return weights

    def summary(self) -> dict:
        return {
            "intersections": len(self.intersections),
            "roads": len(self.roads),
            "vehicles": len(self.vehicles),
            "rules": len(self.rules),
            "semantic_triples": len(self.semantic_net.all_triples()),
        }


# Module-level singleton
kb = KnowledgeBase()
