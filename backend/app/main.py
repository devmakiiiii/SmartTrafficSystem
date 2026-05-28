"""
FastAPI Main Application
========================
Exposes all REST API endpoints and a WebSocket for real-time updates.

Run with:
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

API docs at:
  http://localhost:8000/docs   (Swagger UI)
  http://localhost:8000/redoc
"""

import asyncio
import random
from datetime import datetime
from typing import Optional, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Internal modules ──────────────────────────────────────────
from app.knowledge_base.kb import kb
from app.inference.engine import engine
from app.routing.search import router as traffic_router
from app.services.bayesian import bayes_engine, fuzzy_classifier
from app.machine_learning.predictor import predict_congestion, get_metrics, train_models
from app.simulation.engine import run_simulation


# ─────────────────────────────────────────────────────────────
# APP SETUP
# ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="Smart Traffic Management System – AI Backend",
    description="AI-powered traffic management with inference, ML, and real-time simulation.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────
# REQUEST / RESPONSE MODELS
# ─────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    hour:          int   = 8
    day_of_week:   int   = 0
    vehicle_count: int   = 200
    weather:       int   = 0   # 0=clear 1=rain 2=fog 3=storm
    is_holiday:    int   = 0
    temperature:   float = 28.0

class SignalOptimizeRequest(BaseModel):
    intersection_id: str
    density:         float
    weather:         str  = "clear"
    emergency:       bool = False
    is_peak:         bool = False

class EmergencyRequest(BaseModel):
    vehicle_type:      str = "ambulance"
    from_intersection: str = "I1"
    to_intersection:   str = "I6"

class RouteRequest(BaseModel):
    start:     str  = "I1"
    goal:      str  = "I6"
    algorithm: str  = "astar"   # astar | dijkstra | bfs
    emergency: bool = False

class BayesRequest(BaseModel):
    rain:         bool = False
    peak_hour:    bool = False
    high_density: bool = False
    accident:     bool = False
    fog:          bool = False
    weekend:      bool = False

class SimulationRequest(BaseModel):
    duration:     int            = 60
    emergency_at: Optional[float] = None


# ─────────────────────────────────────────────────────────────
# WEBSOCKET MANAGER
# ─────────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)

    async def broadcast(self, data: dict):
        for ws in list(self.active):
            try:
                await ws.send_json(data)
            except Exception:
                self.active.remove(ws)

ws_manager = ConnectionManager()


# Background task: push live traffic data every 3 seconds
async def broadcast_traffic_loop():
    while True:
        await asyncio.sleep(3)
        if not ws_manager.active:
            continue
        payload = _generate_live_snapshot()
        await ws_manager.broadcast(payload)


@app.on_event("startup")
async def startup():
    asyncio.create_task(broadcast_traffic_loop())
    try:
        get_metrics()
    except Exception:
        pass


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

# Weather code → string (for inference engine)
_WEATHER_STR = {0: "clear", 1: "rain", 2: "fog", 3: "storm"}


def _ml_density(hour: int, day_of_week: int, weather: int,
                is_holiday: int, temperature: float) -> float:
    """
    Derive a realistic vehicle count from the current time/weather context
    using the same distribution as traffic_dataset.csv, then add small noise.
    Falls back to random if the ML predictor is unavailable.
    """
    # Realistic base vehicle count — mirrors generate_traffic_dataset.py logic
    if hour in [7, 8, 9, 17, 18, 19]:
        base = random.randint(200, 400)
    elif 0 <= hour <= 5:
        base = random.randint(0, 50)
    elif hour in [6, 10, 11, 12, 13, 14, 15, 16]:
        base = random.randint(80, 200)
    else:
        base = random.randint(50, 150)

    if is_holiday:
        base = int(base * 0.4)
    if day_of_week in [5, 6]:           # weekend
        base = int(base * 0.85)

    weather_mult = {0: 1.0, 1: 1.3, 2: 1.2, 3: 1.5}
    vehicle_count = max(0, int(base * weather_mult[weather]) + random.randint(-20, 20))

    # Convert to density with small sensor noise
    density = vehicle_count / 5.0 + random.gauss(0, 2.0)
    return round(float(max(0.0, min(100.0, density))), 1), vehicle_count


def _generate_live_snapshot() -> dict:
    now         = datetime.now()
    hour        = now.hour
    day_of_week = now.weekday()          # 0=Mon … 6=Sun
    is_peak     = (7 <= hour <= 9) or (17 <= hour <= 19)
    is_holiday  = 0                      # extend later with a calendar lookup
    temperature = round(random.uniform(24.0, 34.0), 1)   # PH daytime range

    # Pick a random weather condition weighted realistically
    weather_code = random.choices([0, 1, 2, 3], weights=[70, 15, 10, 5])[0]
    weather_str  = _WEATHER_STR[weather_code]

    intersections = []
    for iid, inter in kb.intersections.items():

        # ── Skip randomising if emergency is active — keep density stable ──
        if inter.is_emergency_active:
            density      = inter.current_density or 60.0
            vehicle_count = int(density * 4)
            status        = "error"
            phase         = "green"
        else:
            # ── ML-informed density ──────────────────────────────────────
            density, vehicle_count = _ml_density(
                hour, day_of_week, weather_code, is_holiday, temperature
            )
            kb.update_density(iid, density)

            if density > 70:
                status = "error"
                phase  = "green"
            elif density > 45:
                status = "warning"
                phase  = "green"
            else:
                status = "operational"
                phase  = "red"

        result = engine.evaluate_traffic(
            density,
            weather=weather_str,
            emergency=inter.is_emergency_active,
            is_peak=is_peak,
        )

        intersections.append({
            "id":           iid,
            "name":         inter.name,
            "density":      round(density, 1),      # 0–100; frontend normalises to 0–1
            "phase":        phase,
            "action":       result.actions[0] if result.actions else "normal",
            "vehicle_count": vehicle_count,
            "status":       status,
            "lat":          inter.latitude,
            "lng":          inter.longitude,
            "is_emergency": inter.is_emergency_active,   # ✅ frontend reads this
            "weather":      weather_str,
        })

    return {
        "type":          "traffic_update",
        "timestamp":     now.isoformat(),
        "intersections": intersections,
        "is_peak":       is_peak,
        "weather":       weather_str,
        "temperature":   temperature,
    }


# ─────────────────────────────────────────────────────────────
# REST ENDPOINTS
# ─────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Smart Traffic Management System – AI Backend", "status": "running"}


@app.get("/api/traffic/status")
def traffic_status():
    """
    GET /api/traffic/status
    Returns live traffic state for all intersections.
    Applies inference engine to each intersection.
    """
    hour    = datetime.now().hour
    is_peak = 7 <= hour <= 9 or 17 <= hour <= 19
    result  = []

    for iid, inter in kb.intersections.items():
        density = inter.current_density or random.uniform(20, 80)
        inf     = engine.evaluate_traffic(density, is_peak=is_peak)
        fuzzy   = fuzzy_classifier.classify(density)
        result.append({
            "id":             iid,
            "name":           inter.name,
            "density":        round(density, 1),
            "signal_phase":   inter.signal_phase,
            "green_duration": engine.get_signal_timing(density),
            "actions":        inf.actions,
            "fuzzy_severity": fuzzy["dominant"],
            "is_emergency":   inter.is_emergency_active,
            "neighbors":      inter.connected_to,
        })

    return {
        "status":      "ok",
        "timestamp":   datetime.now().isoformat(),
        "is_peak_hour": is_peak,
        "intersections": result,
        "kb_summary":  kb.summary(),
    }


@app.post("/api/predict")
def predict(req: PredictRequest):
    """
    POST /api/predict
    ML-based congestion prediction for given conditions.
    """
    try:
        result = predict_congestion(
            hour=req.hour,
            day_of_week=req.day_of_week,
            vehicle_count=req.vehicle_count,
            weather=req.weather,
            is_holiday=req.is_holiday,
            temperature=req.temperature,
        )
        return {"status": "ok", **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/signal/optimize")
def optimize_signal(req: SignalOptimizeRequest):
    """
    POST /api/signal/optimize
    Run inference engine on a specific intersection and return optimal signal timing.
    """
    result = engine.evaluate_traffic(
        density=req.density,
        weather=req.weather,
        emergency=req.emergency,
        is_peak=req.is_peak,
    )
    timing = engine.get_signal_timing(req.density)

    # Update KB
    inter = kb.get_intersection(req.intersection_id)
    if inter:
        inter.green_duration      = timing
        inter.is_emergency_active = req.emergency

    return {
        "status":           "ok",
        "intersection":     req.intersection_id,
        "green_duration_s": timing,
        "actions":          result.actions,
        "reasoning_trace":  result.to_dict()["reasoning_trace"],
        "explanation":      f"Inference engine fired {len([s for s in result.steps if s.matched])} rules.",
    }


async def _auto_clear_emergency(path: list, delay_s: int = 60):
    """Auto-clears emergency mode after delay_s seconds and notifies all clients."""
    await asyncio.sleep(delay_s)
    cleared = []
    for iid in path:
        inter = kb.get_intersection(iid)
        if inter and inter.is_emergency_active:
            inter.is_emergency_active = False
            inter.signal_phase        = "red"
            cleared.append(iid)
    if cleared:
        await ws_manager.broadcast({
            "type":             "emergency_cleared",
            "intersection_ids": cleared,
        })


@app.post("/api/emergency/activate")
async def activate_emergency(req: EmergencyRequest):
    """
    POST /api/emergency/activate
    Activates emergency vehicle routing: clears path, pre-empts signals.
    Auto-reverts after 60 seconds.
    """
    route = traffic_router.find_route(
        start=req.from_intersection,
        goal=req.to_intersection,
        algorithm="astar",
        emergency=True,
    )

    activated = []
    path = route.get("path", [])
    for iid in path:
        inter = kb.get_intersection(iid)
        if inter:
            inter.is_emergency_active = True
            inter.signal_phase        = "green"
            activated.append(inter.name)

    facts = {"emergency_detected": True, "density": 60}
    proved, chain = engine.can_activate_emergency(facts)

    # Broadcast activation immediately to all WS clients
    asyncio.create_task(
        ws_manager.broadcast({
            "type":            "emergency_activated",
            "intersection_id": req.from_intersection,
            "route":           path,
        })
    )

    # ✅ Auto-clear emergency after 60 seconds
    asyncio.create_task(_auto_clear_emergency(path, delay_s=60))

    return {
        "status":                 "activated",
        "vehicle_type":           req.vehicle_type,
        "route":                  route,
        "signals_cleared":        activated,
        "backward_chain_proved":  proved,
        "reasoning":              [s.to_dict() for s in chain],
    }


@app.post("/api/route/recommend")
def recommend_route(req: RouteRequest):
    """
    POST /api/route/recommend
    Returns optimal route using Dijkstra or A* with congestion-weighted edges.
    Also runs all three algorithms for comparison.
    """
    primary = traffic_router.find_route(
        start=req.start, goal=req.goal,
        algorithm=req.algorithm, emergency=req.emergency,
    )

    comparison = {}
    for algo in ["astar", "dijkstra", "bfs"]:
        r = traffic_router.find_route(req.start, req.goal, algo, req.emergency)
        comparison[algo] = {
            "path":         r.get("path", []),
            "path_names":   r.get("path_names", []),
            "cost_minutes": r.get("cost_minutes", r.get("hops", -1)),
        }

    return {
        "status":     "ok",
        "primary":    primary,
        "comparison": comparison,
        "explanation": (
            f"Route from {req.start} to {req.goal} computed via {req.algorithm.upper()}. "
            f"Emergency={req.emergency}. Congestion penalties "
            f"{'disabled' if req.emergency else 'applied'}."
        ),
    }


@app.post("/api/bayesian/estimate")
def bayesian_estimate(req: BayesRequest):
    """
    POST /api/bayesian/estimate
    Computes Bayesian congestion probability from evidence signals.
    """
    evidence = {
        "rain":         req.rain,
        "peak_hour":    req.peak_hour,
        "high_density": req.high_density,
        "accident":     req.accident,
        "fog":          req.fog,
        "weekend":      req.weekend,
    }
    result = bayes_engine.estimate_congestion(evidence)
    return {"status": "ok", **result.to_dict()}


@app.post("/api/simulation/run")
def run_sim(req: SimulationRequest):
    """
    POST /api/simulation/run
    Executes the discrete-event traffic simulation.
    """
    result = run_simulation(
        duration=min(req.duration, 300),
        emergency_at=req.emergency_at,
    )
    return {"status": "ok", **result}


@app.get("/api/knowledge/rules")
def get_rules():
    """GET /api/knowledge/rules – list all production rules in the KB."""
    return {
        "rules": [
            {
                "id":          r.id,
                "description": r.description,
                "action":      r.action,
                "explanation": r.explanation,
            }
            for r in kb.rules
        ]
    }


@app.get("/api/knowledge/semantic")
def get_semantic():
    """GET /api/knowledge/semantic – return the semantic network triples."""
    return {
        "triples": [
            {"subject": s, "relation": r, "object": o}
            for s, r, o in kb.semantic_net.all_triples()
        ]
    }


@app.get("/api/ml/metrics")
def ml_metrics():
    """GET /api/ml/metrics – model accuracy and comparison."""
    return get_metrics()


@app.post("/api/ml/train")
def retrain():
    """POST /api/ml/train – retrain the ML model (use after updating dataset)."""
    metrics = train_models()
    return {"status": "trained", **metrics}


# ─────────────────────────────────────────────────────────────
# WEBSOCKET
# ─────────────────────────────────────────────────────────────

@app.websocket("/ws/traffic")
async def traffic_ws(websocket: WebSocket):
    """
    WebSocket endpoint.
    Frontend connects here to receive real-time traffic updates every 3 s.
    Client can also send {"type":"emergency","from":"I1","to":"I6"} to trigger events.
    """
    await ws_manager.connect(websocket)
    try:
        # Send initial snapshot immediately on connect
        await websocket.send_json(_generate_live_snapshot())
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "emergency":
                req  = EmergencyRequest(
                    from_intersection=data.get("from", "I1"),
                    to_intersection=data.get("to", "I6"),
                )
                resp = await activate_emergency(req)
                await websocket.send_json({"type": "emergency_response", **resp})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)