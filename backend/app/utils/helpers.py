"""
Utility Functions
=================
Shared helpers used across the backend:
  - Peak hour detection
  - Weather condition encoding / decoding
  - Traffic analytics (throughput, delay, LOS)
  - Sensor noise simulation
  - Formatting helpers
"""

import random
import math
from datetime import datetime
from typing import Dict, Any, List, Tuple

# ─────────────────────────────────────────────────────────────
# PEAK HOUR DETECTION
# ─────────────────────────────────────────────────────────────

PEAK_HOURS = {
    "morning": (7, 9),    # 07:00–09:00
    "lunch":   (12, 13),  # 12:00–13:00
    "evening": (17, 19),  # 17:00–19:00
}

def is_peak_hour(hour: int = None) -> Tuple[bool, str]:
    """
    Returns (is_peak, period_name).
    period_name is "morning" | "lunch" | "evening" | "off_peak".
    """
    if hour is None:
        hour = datetime.now().hour
    for period, (start, end) in PEAK_HOURS.items():
        if start <= hour <= end:
            return True, period
    return False, "off_peak"


# ─────────────────────────────────────────────────────────────
# WEATHER ENCODING
# ─────────────────────────────────────────────────────────────

WEATHER_MAP = {
    0: "clear",
    1: "rain",
    2: "fog",
    3: "storm",
}

WEATHER_SPEED_FACTOR = {
    "clear": 1.00,
    "rain":  0.75,
    "fog":   0.80,
    "storm": 0.55,
}

def weather_to_int(weather: str) -> int:
    inv = {v: k for k, v in WEATHER_MAP.items()}
    return inv.get(weather.lower(), 0)

def weather_speed_factor(weather: str) -> float:
    """How much weather reduces average driving speed (1.0 = no reduction)."""
    return WEATHER_SPEED_FACTOR.get(weather.lower(), 1.0)


# ─────────────────────────────────────────────────────────────
# LEVEL OF SERVICE (LOS)
# Highway Capacity Manual classification
# ─────────────────────────────────────────────────────────────

LOS_THRESHOLDS = [
    (20,  "A", "Free flow – no delays"),
    (40,  "B", "Reasonable freedom – minor delays"),
    (60,  "C", "Stable flow – noticeable delays"),
    (75,  "D", "Approaching unstable – significant delays"),
    (90,  "E", "Unstable flow – heavy delays"),
    (100, "F", "Forced/breakdown – gridlock"),
]

def level_of_service(density_pct: float) -> Dict[str, str]:
    """Return LOS grade and description for a given density."""
    for threshold, grade, desc in LOS_THRESHOLDS:
        if density_pct <= threshold:
            return {"grade": grade, "description": desc, "density": density_pct}
    return {"grade": "F", "description": "Forced/breakdown – gridlock", "density": density_pct}


# ─────────────────────────────────────────────────────────────
# SENSOR SIMULATION (adds realistic noise)
# ─────────────────────────────────────────────────────────────

def simulate_sensor_reading(true_density: float, error_rate: float = 0.05) -> float:
    """
    Add Gaussian noise to simulate imperfect sensor readings.
    5% of readings are 'faulty' (large outlier).
    """
    if random.random() < error_rate:
        # Faulty reading: random noise ±30
        return max(0.0, min(100.0, true_density + random.uniform(-30, 30)))
    # Normal Gaussian noise ±3
    return max(0.0, min(100.0, true_density + random.gauss(0, 3)))


def simulate_vehicle_arrival(base_rate: float, is_peak: bool, weather: str) -> int:
    """
    Simulate Poisson vehicle arrivals per minute.
    Returns integer vehicle count.
    """
    rate = base_rate
    if is_peak:
        rate *= 2.0
    rate *= weather_speed_factor(weather)
    # Poisson: mean = rate, var = rate
    return max(0, int(random.gauss(rate, math.sqrt(rate))))


# ─────────────────────────────────────────────────────────────
# TRAFFIC ANALYTICS
# ─────────────────────────────────────────────────────────────

def compute_throughput(green_duration: int, density_pct: float, lanes: int = 2) -> float:
    """
    Estimate vehicles that can pass through per cycle (vehicles/hour).
    Saturation flow: ~1800 veh/lane/hour at green.
    """
    saturation_flow = 1800 * lanes  # veh/hour per approach
    # Effective green ratio
    cycle = green_duration + 3 + 30   # green + yellow + red
    green_ratio = green_duration / cycle
    capacity = saturation_flow * green_ratio
    # Actual throughput limited by demand
    demand = density_pct / 100 * saturation_flow
    return round(min(capacity, demand), 1)


def compute_avg_delay(density_pct: float, green_duration: int) -> float:
    """
    Webster's formula approximation for average control delay (seconds/vehicle).
    """
    c = green_duration + 3 + 30          # cycle length
    g = green_duration
    x = min(0.99, density_pct / 100)     # degree of saturation (capped)
    # Uniform delay component
    d1 = (c * (1 - g/c)**2) / (2 * (1 - x * g/c))
    # Overflow delay component (simplified)
    d2 = 900 * 0.25 * (x - 1 + math.sqrt((x-1)**2 + (8*x)/(1800*g/c)))
    return round(d1 + max(0, d2), 1)


# ─────────────────────────────────────────────────────────────
# FORMATTING
# ─────────────────────────────────────────────────────────────

def format_duration(seconds: int) -> str:
    if seconds < 60:
        return f"{seconds}s"
    m, s = divmod(seconds, 60)
    return f"{m}m {s}s" if s else f"{m}m"

def format_density(pct: float) -> str:
    if pct < 25:   return f"{pct:.0f}% (light)"
    if pct < 50:   return f"{pct:.0f}% (moderate)"
    if pct < 75:   return f"{pct:.0f}% (heavy)"
    return f"{pct:.0f}% (congested)"
