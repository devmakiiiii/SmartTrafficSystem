"""
Search Algorithms Module
========================
Implements intelligent routing using:

1. Dijkstra's Algorithm  – guaranteed shortest path (by weight)
2. A* Search             – faster with a heuristic (estimates remaining cost)
3. BFS                   – unweighted shortest hop count

These are used to:
- Recommend fastest routes between intersections
- Route emergency vehicles with signal pre-emption
- Dynamically re-route around congested roads

Time complexity:
  Dijkstra : O((V + E) log V)   with a priority queue
  A*       : O(E) best-case     when heuristic is perfect
  BFS      : O(V + E)
"""

import heapq
import math
from typing import Dict, List, Optional, Tuple, Any
from app.knowledge_base.kb import kb


# ─────────────────────────────────────────────────────────────
# HELPER TYPES
# ─────────────────────────────────────────────────────────────

PathResult = Dict[str, Any]   # { path, cost, algorithm, steps }


# ─────────────────────────────────────────────────────────────
# BFS  (Breadth-First Search)
# ─────────────────────────────────────────────────────────────

def bfs(graph: Dict[str, List[str]], start: str, goal: str) -> PathResult:
    """
    Find the path with the FEWEST hops (ignores edge weights).

    Algorithm:
    - Use a queue (FIFO). Enqueue start.
    - Dequeue a node → if goal, reconstruct path.
    - Enqueue unvisited neighbors.

    Good for: checking connectivity, minimal-transfer routing.
    """
    if start == goal:
        return {"path": [start], "hops": 0, "algorithm": "BFS", "steps": []}

    visited = {start}
    queue   = [(start, [start])]
    steps   = []

    while queue:
        node, path = queue.pop(0)
        steps.append(f"BFS visiting: {node}")

        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                new_path = path + [neighbor]
                if neighbor == goal:
                    return {
                        "path":      new_path,
                        "hops":      len(new_path) - 1,
                        "algorithm": "BFS",
                        "steps":     steps,
                    }
                visited.add(neighbor)
                queue.append((neighbor, new_path))

    return {"path": [], "hops": -1, "algorithm": "BFS", "steps": steps, "error": "No path found"}


# ─────────────────────────────────────────────────────────────
# DIJKSTRA'S ALGORITHM
# ─────────────────────────────────────────────────────────────

def dijkstra(weights: Dict[tuple, float], graph: Dict[str, List[str]],
             start: str, goal: str) -> PathResult:
    """
    Find the MINIMUM COST path using a min-heap priority queue.

    Algorithm:
    1. dist[start] = 0; all others = ∞
    2. Push (0, start) to priority queue.
    3. Pop lowest-cost node.
    4. For each neighbor: if dist[node] + edge_weight < dist[neighbor],
       update dist[neighbor] and push to queue.
    5. Stop when goal is popped.

    Edge weight = travel time in minutes (from RoadFrame).
    High-density roads have reduced current_speed → higher travel time → higher weight.
    """
    dist     = {node: float("inf") for node in graph}
    prev     = {}
    dist[start] = 0.0
    pq       = [(0.0, start)]   # (cost, node)
    visited  = set()
    steps    = []

    while pq:
        cost, node = heapq.heappop(pq)

        if node in visited:
            continue
        visited.add(node)
        steps.append(f"Dijkstra: visiting {node} (cost={cost:.2f} min)")

        if node == goal:
            break

        for neighbor in graph.get(node, []):
            edge_w = weights.get((node, neighbor), 1.0)
            new_cost = cost + edge_w
            if new_cost < dist[neighbor]:
                dist[neighbor] = new_cost
                prev[neighbor] = node
                heapq.heappush(pq, (new_cost, neighbor))

    # Reconstruct path
    if dist[goal] == float("inf"):
        return {"path": [], "cost_minutes": -1, "algorithm": "Dijkstra", "steps": steps, "error": "No path"}

    path = []
    cur  = goal
    while cur:
        path.append(cur)
        cur = prev.get(cur)
    path.reverse()

    return {
        "path":          path,
        "cost_minutes":  round(dist[goal], 2),
        "algorithm":     "Dijkstra",
        "steps":         steps,
    }


# ─────────────────────────────────────────────────────────────
# A* SEARCH
# ─────────────────────────────────────────────────────────────

def _haversine_heuristic(node_id: str, goal_id: str) -> float:
    """
    Haversine distance between two intersections as the heuristic h(n).
    Returns minutes (assumes 60 km/h average → 1 km = 1 min).
    This is ADMISSIBLE (never overestimates) because road speed ≤ 60 km/h.
    """
    n = kb.intersections.get(node_id)
    g = kb.intersections.get(goal_id)
    if not n or not g:
        return 0.0

    R    = 6371.0  # Earth radius km
    lat1 = math.radians(n.latitude)
    lat2 = math.radians(g.latitude)
    dlat = math.radians(g.latitude  - n.latitude)
    dlon = math.radians(g.longitude - n.longitude)

    a   = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    km  = R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return km   # 1 km ≈ 1 min at 60 km/h


def astar(weights: Dict[tuple, float], graph: Dict[str, List[str]],
          start: str, goal: str) -> PathResult:
    """
    A* = Dijkstra + admissible heuristic.

    f(n) = g(n) + h(n)
      g(n) = actual cost from start to n
      h(n) = estimated cost from n to goal (Haversine)

    A* explores fewer nodes than Dijkstra when h is good.
    Guaranteed optimal when h is admissible (never over-estimates).
    """
    g_cost   = {node: float("inf") for node in graph}
    g_cost[start] = 0.0
    prev     = {}
    pq       = [(0.0 + _haversine_heuristic(start, goal), 0.0, start)]
    visited  = set()
    steps    = []

    while pq:
        f, g, node = heapq.heappop(pq)

        if node in visited:
            continue
        visited.add(node)
        h = _haversine_heuristic(node, goal)
        steps.append(f"A*: visit {node}  g={g:.2f}  h={h:.2f}  f={f:.2f}")

        if node == goal:
            break

        for neighbor in graph.get(node, []):
            edge_w   = weights.get((node, neighbor), 1.0)
            new_g    = g + edge_w
            if new_g < g_cost[neighbor]:
                g_cost[neighbor] = new_g
                prev[neighbor]   = node
                f_val = new_g + _haversine_heuristic(neighbor, goal)
                heapq.heappush(pq, (f_val, new_g, neighbor))

    if g_cost[goal] == float("inf"):
        return {"path": [], "cost_minutes": -1, "algorithm": "A*", "steps": steps, "error": "No path"}

    path = []
    cur  = goal
    while cur:
        path.append(cur)
        cur = prev.get(cur)
    path.reverse()

    return {
        "path":          path,
        "cost_minutes":  round(g_cost[goal], 2),
        "algorithm":     "A*",
        "steps":         steps,
    }


# ─────────────────────────────────────────────────────────────
# ROUTER – public interface used by the API
# ─────────────────────────────────────────────────────────────

class TrafficRouter:
    """
    Selects and runs the best search algorithm for a routing request.
    Also adjusts edge weights by current traffic density
    (high density → slower speed → higher cost).
    """

    def find_route(self, start: str, goal: str,
                   algorithm: str = "astar",
                   emergency: bool = False) -> PathResult:
        graph   = kb.get_road_graph()
        weights = self._build_weights(emergency)

        algo = algorithm.lower()
        if algo == "dijkstra":
            result = dijkstra(weights, graph, start, goal)
        elif algo == "bfs":
            result = bfs(graph, start, goal)
        else:
            result = astar(weights, graph, start, goal)

        # Annotate intersection names
        result["path_names"] = [
            kb.intersections[n].name for n in result.get("path", []) if n in kb.intersections
        ]
        result["is_emergency"] = emergency
        return result

    def _build_weights(self, emergency: bool) -> Dict[tuple, float]:
        """
        Build edge weights from road data.
        Emergency vehicles bypass congestion penalties.
        """
        weights = {}
        for road in kb.roads.values():
            if road.is_blocked and not emergency:
                w = 999.0   # effectively impassable
            else:
                density = (
                    kb.intersections[road.from_intersection].current_density
                    if road.from_intersection in kb.intersections else 0
                )
                # Congestion factor: density 0→1.0x, density 100→2.5x slowdown
                congestion = 1.0 + (density / 100) * 1.5
                base_time  = road.travel_time_minutes()
                w = base_time * (1.0 if emergency else congestion)

            weights[(road.from_intersection, road.to_intersection)] = w
            weights[(road.to_intersection, road.from_intersection)] = w
        return weights


# Module-level singleton
router = TrafficRouter()
