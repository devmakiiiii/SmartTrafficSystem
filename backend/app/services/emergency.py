"""
Emergency Vehicle Coordination Service
=======================================
Handles the full lifecycle of an emergency vehicle event:

  1. Detect emergency vehicle (sensor input)
  2. Identify optimal route (A* search)
  3. Pre-empt traffic signals along the route
  4. Broadcast priority alerts via WebSocket
  5. Clear emergency state after vehicle passes

This module coordinates across KB, inference engine, and router.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime

from app.routing.search import router as traffic_router
from app.knowledge_base.kb import kb


@dataclass
class EmergencyEvent:
    """Represents one active emergency vehicle event."""
    event_id:       str
    vehicle_type:   str
    from_id:        str
    to_id:          str
    route:          List[str]          = field(default_factory=list)
    route_names:    List[str]          = field(default_factory=list)
    signals_cleared: List[str]         = field(default_factory=list)
    est_travel_min: float              = 0.0
    created_at:     str                = ""
    status:         str                = "active"   # active | cleared

    def to_dict(self) -> dict:
        return {
            "event_id":        self.event_id,
            "vehicle_type":    self.vehicle_type,
            "route":           self.route,
            "route_names":     self.route_names,
            "signals_cleared": self.signals_cleared,
            "est_travel_min":  self.est_travel_min,
            "created_at":      self.created_at,
            "status":          self.status,
        }


class EmergencyCoordinator:
    """
    Coordinates signal preemption for emergency vehicles.

    Algorithm:
    1. Route the vehicle via A* with emergency=True
       (congestion penalties disabled, blocked roads bypassed)
    2. For every intersection on the route:
       - Set is_emergency_active = True
       - Set signal_phase = "green"
    3. Return the event for WebSocket broadcast
    """

    _id_counter = 0

    def _next_id(self) -> str:
        EmergencyCoordinator._id_counter += 1
        return f"EVT-{EmergencyCoordinator._id_counter:04d}"

    def activate(
        self,
        vehicle_type: str,
        from_id: str,
        to_id: str,
    ) -> EmergencyEvent:
        route_result = traffic_router.find_route(
            start=from_id, goal=to_id,
            algorithm="astar", emergency=True,
        )

        path  = route_result.get("path", [])
        names = route_result.get("path_names", [])
        cost  = route_result.get("cost_minutes", 0.0)

        cleared = []
        for iid in path:
            inter = kb.get_intersection(iid)
            if inter:
                inter.is_emergency_active = True
                inter.signal_phase = "green"
                inter.green_duration = 60
                cleared.append(inter.name)

        event = EmergencyEvent(
            event_id=self._next_id(),
            vehicle_type=vehicle_type,
            from_id=from_id,
            to_id=to_id,
            route=path,
            route_names=names,
            signals_cleared=cleared,
            est_travel_min=round(cost, 2),
            created_at=datetime.now().isoformat(),
        )
        return event

    def clear(self, event: EmergencyEvent):
        """Reset all intersections on the route after vehicle passes."""
        for iid in event.route:
            inter = kb.get_intersection(iid)
            if inter:
                inter.is_emergency_active = False
                inter.signal_phase = "green"   # resume normal cycle
        event.status = "cleared"


# Module-level singleton
coordinator = EmergencyCoordinator()
