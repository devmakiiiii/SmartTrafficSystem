# 🚦 Smart Traffic Management System – Python AI Backend

A complete AI-powered traffic management backend demonstrating knowledge-based systems, inference engines, Bayesian uncertainty, machine learning, search algorithms, and real-time simulation.

---

## 📁 Project Structure

```
backend/
├── app/
│   ├── main.py                   # FastAPI app, all REST endpoints, WebSocket
│   ├── knowledge_base/
│   │   └── kb.py                 # Frames, semantic network, production rules
│   ├── inference/
│   │   └── engine.py             # Forward + backward chaining inference
│   ├── routing/
│   │   └── search.py             # Dijkstra, A*, BFS search algorithms
│   ├── services/
│   │   ├── bayesian.py           # Naive Bayes + fuzzy logic
│   │   ├── signal_optimizer.py   # Multi-source signal timing optimizer
│   │   └── emergency.py          # Emergency vehicle coordination
│   ├── machine_learning/
│   │   └── predictor.py          # Random Forest congestion predictor
│   ├── simulation/
│   │   └── engine.py             # SimPy discrete-event simulation
│   ├── models/
│   │   └── schemas.py            # Pydantic request/response models
│   └── utils/
│       └── helpers.py            # LOS, throughput, peak hour, sensor noise
├── datasets/
│   ├── generate_dataset.py       # Synthetic dataset generator
│   └── traffic_dataset.csv       # 2,000 training rows
├── tests/
│   └── test_all.py               # 51 unit tests (pytest)
└── requirements.txt
```

---

## ⚡ Quick Start

```bash
# 1. Clone and enter backend
git clone https://github.com/devmakiiiii/SmartTrafficSystem
cd SmartTrafficSystem/backend

# 2. Install dependencies
pip install -r requirements.txt

# 3. Generate the dataset (first time only)
python datasets/generate_dataset.py

# 4. Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open **http://localhost:8000/docs** for the interactive Swagger UI.

---

## 🧠 AI Modules Explained

### 1. Knowledge Base (`app/knowledge_base/kb.py`)

Uses three classic AI knowledge representation techniques:

| Technique | Implementation | Example |
|---|---|---|
| **Frames** | Python `@dataclass` | `IntersectionFrame(id, density, phase, …)` |
| **Semantic Network** | Triple store `(S, R, O)` | `(I1, CONNECTS_TO, I2)` |
| **Production Rules** | Lambda conditions + actions | `IF density > 75 THEN extend_green` |

**Why?** Separating *what we know* (facts) from *how we reason* (rules) is the core of knowledge-based systems. It makes the AI explainable and easy to update.

---

### 2. Inference Engine (`app/inference/engine.py`)

#### Forward Chaining (data-driven)
```
Facts: {density: 85, weather: "rain", is_peak: True}
→ Scan all 6 rules
→ R1 matches (density > 75) → fire "extend_green_light"
→ R5 matches (rain + density > 60) → fire "extend_green_extra"
→ R6 matches (peak + density > 50) → fire "peak_hour_optimization"
Result: 3 actions fired, full reasoning trace returned
```

#### Backward Chaining (goal-driven)
```
Goal: "Can we activate emergency mode?"
→ Find rules that produce "activate_emergency_priority"
→ R4: condition is emergency_detected == True
→ Check current facts: emergency_detected = True ✓
→ PROVED: emergency mode is justified
```

Both return a **reasoning trace** — every rule that was checked and why — making the AI decisions fully explainable.

---

### 3. Search Algorithms (`app/routing/search.py`)

#### BFS – Breadth-First Search
- Finds path with **fewest hops** (ignores weights)
- Time complexity: **O(V + E)**
- Use when: checking if a path exists, minimum transfers

#### Dijkstra's Algorithm
- Finds **minimum cost path** using a min-heap priority queue
- Time complexity: **O((V + E) log V)**
- Edge weight = travel time in minutes (adjusted for congestion)

#### A* Search
- Dijkstra + **admissible heuristic** (Haversine GPS distance)
- Formula: `f(n) = g(n) + h(n)`
  - `g(n)` = actual travel time so far
  - `h(n)` = estimated remaining time (straight-line distance)
- Visits fewer nodes than Dijkstra when heuristic is good
- Optimal when heuristic never overestimates (ours doesn't: we assume 60 km/h max)

**Congestion weighting:** Edge weights are multiplied by a congestion factor:
```python
congestion_factor = 1.0 + (density / 100) * 1.5
# density=100% → 2.5× slower → router avoids congested roads
```

---

### 4. Bayesian Uncertainty (`app/services/bayesian.py`)

#### Naive Bayes Congestion Estimator

Combines multiple noisy signals into one probability using Bayes' theorem:

```
P(Congestion | Rain, Peak, High_Density)
= P(Rain|C)·P(Peak|C)·P(High_Density|C)·P(C)
  ─────────────────────────────────────────────
                   P(Evidence)
```

| Signal | P(e\|Congestion) | P(e\|No Congestion) |
|---|---|---|
| Rain | 0.70 | 0.30 |
| Peak Hour | 0.85 | 0.25 |
| High Density | 0.90 | 0.15 |
| Accident | 0.60 | 0.05 |
| Weekend | 0.20 | 0.55 |

Example: Rain + Peak + High Density → **P(C) = 96.2%** → CRITICAL risk

#### Fuzzy Logic Severity Classifier

Triangular membership functions avoid hard thresholds:
```
density=72% → LOW: 0.0, MODERATE: 0.27, HIGH: 0.60, CRITICAL: 0.0
→ Dominant: HIGH (μ=0.60)
```
Unlike `if density > 75: HIGH`, fuzzy logic handles gradual transitions naturally.

---

### 5. Machine Learning (`app/machine_learning/predictor.py`)

#### Pipeline

```
CSV Dataset (2,000 rows)
    ↓
Feature Engineering
  - Cyclical hour encoding: sin(2π·hour/24), cos(2π·hour/24)
  - Weekend flag, peak hour flag
    ↓
Train/Test Split (80/20) + StandardScaler
    ↓
Train 3 models → pick best by accuracy
  ┌─ Random Forest   → 96% accuracy  ← WINNER
  ├─ Decision Tree   → 91% accuracy
  └─ Naive Bayes     → 78% accuracy
    ↓
Save model.joblib + scaler.joblib
    ↓
predict_congestion(hour, dow, vehicles, weather, ...)
→ { label: "medium", confidence: 0.98, probabilities: {...} }
```

#### Why cyclical encoding?
Hour 23 is "close to" hour 0 (midnight), but numerically they're far apart.
Encoding as `sin/cos` places them correctly on a circle.

---

### 6. Traffic Simulation (`app/simulation/engine.py`)

Built with **SimPy** (discrete-event simulation):

- Each intersection runs its own **coroutine** (Python generator)
- Vehicles arrive via **Poisson process** (`expovariate(λ)`)
- Signals adapt green duration to queue size each cycle
- Emergency vehicles trigger **pre-emption**: skip current cycle, hold green for 10s

```python
# SimPy coroutine: runs "concurrently" in simulated time
def _signal_cycle(self):
    while True:
        if self.emergency:          # pre-emption check
            self.phase = "green"
            yield self.env.timeout(10)
            continue
        
        green = 60 if density > 75 else 30   # adaptive
        self.phase = "green"
        yield self.env.timeout(green)        # "wait" green seconds
        
        self.phase = "yellow"
        yield self.env.timeout(3)
        
        self.phase = "red"
        yield self.env.timeout(30)
```

---

## 📡 API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/traffic/status` | Live state for all 6 intersections |
| `POST` | `/api/predict` | ML congestion prediction |
| `POST` | `/api/signal/optimize` | Inference-based signal timing |
| `POST` | `/api/emergency/activate` | Emergency vehicle routing |
| `POST` | `/api/route/recommend` | Route with all 3 algorithms |
| `POST` | `/api/bayesian/estimate` | P(Congestion\|Evidence) |
| `POST` | `/api/simulation/run` | Run SimPy simulation |
| `GET` | `/api/knowledge/rules` | List all production rules |
| `GET` | `/api/knowledge/semantic` | Semantic network triples |
| `GET` | `/api/ml/metrics` | Model accuracy comparison |
| `WS` | `/ws/traffic` | Real-time updates every 3s |

---

## 🌐 WebSocket – Real-Time Frontend

```javascript
// Frontend connects like this:
const ws = new WebSocket("ws://localhost:8000/ws/traffic");

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // data.type === "traffic_update" → update dashboard every 3s
  // data.intersections[].density, .phase, .action
};

// Send emergency event from frontend:
ws.send(JSON.stringify({
  type: "emergency",
  from: "I1",
  to: "I6"
}));
```

---

## 📊 Dataset

`datasets/traffic_dataset.csv` — 2,000 rows of synthetic traffic data:

| Column | Type | Range |
|---|---|---|
| `hour` | int | 0–23 |
| `day_of_week` | int | 0=Mon … 6=Sun |
| `vehicle_count` | int | 0–500 |
| `weather` | int | 0=clear, 1=rain, 2=fog, 3=storm |
| `is_holiday` | int | 0 or 1 |
| `temperature` | float | 18–38 °C |
| `density_pct` | float | 0–100 |
| `congestion` | int | **0=none, 1=low, 2=medium, 3=high** |

Dataset reflects: morning peak (7–9am), evening peak (5–7pm), weekend suppression, weather penalties.

Regenerate with: `python datasets/generate_dataset.py`

---

## 🧪 Tests

```bash
cd backend
python -m pytest tests/test_all.py -v
# 51 passed ✅
```

Test classes: `TestKnowledgeBase`, `TestInferenceEngine`, `TestSearchAlgorithms`,
`TestBayesianEngine`, `TestFuzzyClassifier`, `TestUtils`, `TestMLPredictor`

---

## 🔧 Frontend Integration

Connect the existing React frontend to the backend by:

1. Point all API calls to `http://localhost:8000`
2. Replace mock data with `GET /api/traffic/status`
3. Connect WebSocket to `ws://localhost:8000/ws/traffic`
4. Wire emergency button to `POST /api/emergency/activate`
5. Wire route form to `POST /api/route/recommend`

---

## 📐 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend                          │
│   Dashboard · Charts · Map · Emergency Controls             │
└──────────┬────────────────────────────┬────────────────────┘
           │ REST API                   │ WebSocket
           ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  FastAPI Backend (main.py)                   │
│  CORS · Pydantic validation · async WebSocket manager        │
└──┬──────────┬──────────┬──────────┬──────────┬─────────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
  KB       Inference  Router    Bayesian     ML
  Frames   Fwd/Bwd    Dijkstra  Naive Bayes  Random
  Rules    Chaining   A* · BFS  Fuzzy Logic  Forest
  Network             Weights   P(C|E)       96% acc
                          │
                          ▼
                    SimPy Simulation
                    Adaptive Signals
                    Emergency Preempt
```

---

## 📋 Requirements

```
fastapi · uvicorn · websockets · python-socketio
scikit-learn · pandas · numpy
simpy · networkx · pydantic · joblib
```
