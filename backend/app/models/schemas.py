"""
Pydantic Models
===============
Shared request and response schemas used across all API endpoints.
Pydantic validates incoming JSON and auto-generates OpenAPI/Swagger docs.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any


# ─────────────────────────────────────────────────────────────
# REQUEST MODELS
# ─────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    hour:          int   = Field(8,   ge=0,   le=23,  description="Hour of day (0–23)")
    day_of_week:   int   = Field(0,   ge=0,   le=6,   description="0=Monday … 6=Sunday")
    vehicle_count: int   = Field(200, ge=0,   le=500, description="Vehicles/hour at intersection")
    weather:       int   = Field(0,   ge=0,   le=3,   description="0=clear 1=rain 2=fog 3=storm")
    is_holiday:    int   = Field(0,   ge=0,   le=1,   description="1 if public holiday")
    temperature:   float = Field(28.0,ge=0.0, le=50.0,description="Temperature in °C")

    class Config:
        json_schema_extra = {
            "example": {
                "hour": 8, "day_of_week": 0,
                "vehicle_count": 350, "weather": 1,
                "is_holiday": 0, "temperature": 27.5,
            }
        }


class SignalOptimizeRequest(BaseModel):
    intersection_id: str   = Field("I1", description="Intersection ID from knowledge base")
    density:         float = Field(60.0, ge=0.0, le=100.0, description="Vehicle density 0–100%")
    weather:         str   = Field("clear", description="clear | rain | fog | storm")
    emergency:       bool  = Field(False, description="Emergency vehicle detected")
    is_peak:         bool  = Field(False, description="Current peak hour")
    accident:        bool  = Field(False, description="Accident on this road segment")


class EmergencyRequest(BaseModel):
    vehicle_type:      str = Field("ambulance", description="ambulance | fire_truck | police")
    from_intersection: str = Field("I1", description="Origin intersection ID")
    to_intersection:   str = Field("I6", description="Destination intersection ID")


class RouteRequest(BaseModel):
    start:     str  = Field("I1",    description="Start intersection ID")
    goal:      str  = Field("I6",    description="Goal intersection ID")
    algorithm: str  = Field("astar", description="astar | dijkstra | bfs")
    emergency: bool = Field(False,   description="Use emergency routing (no congestion penalty)")

    @validator("algorithm")
    def valid_algorithm(cls, v):
        if v not in ("astar", "dijkstra", "bfs"):
            raise ValueError("algorithm must be astar, dijkstra, or bfs")
        return v


class BayesRequest(BaseModel):
    rain:         bool = False
    peak_hour:    bool = False
    high_density: bool = False
    accident:     bool = False
    fog:          bool = False
    weekend:      bool = False
    sensor_error: bool = False


class SimulationRequest(BaseModel):
    duration:     int            = Field(60, ge=10, le=300, description="Simulated seconds (10–300)")
    emergency_at: Optional[float]= Field(None, ge=0,        description="Inject emergency at this time (s)")


class NetworkOptimizeRequest(BaseModel):
    weather:  str  = Field("clear", description="Current weather condition")
    is_peak:  bool = Field(False,   description="Is it peak hour?")


# ─────────────────────────────────────────────────────────────
# RESPONSE MODELS
# ─────────────────────────────────────────────────────────────

class IntersectionStatus(BaseModel):
    id:              str
    name:            str
    density:         float
    signal_phase:    str
    green_duration:  int
    actions:         List[str]
    fuzzy_severity:  str
    is_emergency:    bool
    neighbors:       List[str]
    los_grade:       Optional[str] = None
    throughput:      Optional[float] = None


class TrafficStatusResponse(BaseModel):
    status:        str
    timestamp:     str
    is_peak_hour:  bool
    intersections: List[IntersectionStatus]
    kb_summary:    Dict[str, Any]


class PredictResponse(BaseModel):
    status:       str
    prediction:   int
    label:        str
    probabilities: Dict[str, float]
    confidence:   float
    inputs:       Dict[str, Any]
    explanation:  str


class RouteResponse(BaseModel):
    status:      str
    primary:     Dict[str, Any]
    comparison:  Dict[str, Any]
    explanation: str


class ReasoningStep(BaseModel):
    rule_id:     str
    matched:     bool
    explanation: str
    action:      Optional[str] = None


class SignalOptimizeResponse(BaseModel):
    status:           str
    intersection:     str
    green_duration_s: int
    actions:          List[str]
    reasoning_trace:  List[ReasoningStep]
    explanation:      str
    p_congestion:     Optional[float] = None
    risk_level:       Optional[str]   = None
