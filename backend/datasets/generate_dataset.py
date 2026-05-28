"""
generate_traffic_dataset.py
===========================
Generates a realistic 5,000-row traffic dataset for the
Smart Traffic Management System ML model.

Usage:
    python generate_traffic_dataset.py

Output:
    traffic_dataset.csv  (in the same folder)

Then retrain the model:
    POST http://localhost:8000/api/ml/train
"""

import pandas as pd
import numpy as np
import random
import os

# Fixed seed — reproducible results for thesis documentation
random.seed(42)
np.random.seed(42)

TOTAL_ROWS = 5000

rows = []

for _ in range(TOTAL_ROWS):
    # ── Time features ─────────────────────────────────────────
    hour        = random.randint(0, 23)
    day_of_week = random.randint(0, 6)   # 0=Mon … 6=Sun
    is_holiday  = 1 if random.random() < 0.05 else 0

    # ── Weather (0=clear 1=rain 2=fog 3=storm) ────────────────
    weather = random.choices([0, 1, 2, 3], weights=[70, 15, 10, 5])[0]

    # ── Temperature (Philippine climate: 18–38 °C) ────────────
    temp = round(random.uniform(18.0, 38.0), 1)

    # ── Base vehicle count by hour ────────────────────────────
    if hour in [7, 8, 9, 17, 18, 19]:          # morning + evening peak
        base_vehicles = random.randint(200, 400)
    elif 0 <= hour <= 5:                         # deep night — very low
        base_vehicles = random.randint(0, 50)
    elif hour in [6, 10, 11, 12, 13, 14, 15, 16]:  # daytime shoulder
        base_vehicles = random.randint(80, 200)
    else:                                        # late evening
        base_vehicles = random.randint(50, 150)

    # ── Modifiers ─────────────────────────────────────────────
    # Holidays cut traffic by ~60 %
    if is_holiday:
        base_vehicles = int(base_vehicles * 0.4)

    # Weekends cut traffic by ~15 %
    if day_of_week in [5, 6]:
        base_vehicles = int(base_vehicles * 0.85)

    # Bad weather increases perceived congestion (slower speeds)
    weather_multiplier = {0: 1.0, 1: 1.3, 2: 1.2, 3: 1.5}
    vehicle_count = int(base_vehicles * weather_multiplier[weather])

    # Small random jitter ±20 vehicles
    vehicle_count = max(0, vehicle_count + random.randint(-20, 20))

    # ── Density with realistic sensor noise ───────────────────
    density = vehicle_count / 5.0 + np.random.normal(0, 3.0)
    density = round(float(np.clip(density, 0, 100)), 1)

    # ── Congestion label ──────────────────────────────────────
    # 0 = free flow  (<45 %)
    # 1 = moderate   (45–69 %)
    # 2 = heavy      (≥70 %)
    if density >= 70:
        congestion = 2
    elif density >= 45:
        congestion = 1
    else:
        congestion = 0

    rows.append([
        hour,
        day_of_week,
        vehicle_count,
        weather,
        is_holiday,
        temp,
        density,
        congestion,
    ])

# ── Build DataFrame ───────────────────────────────────────────
df = pd.DataFrame(rows, columns=[
    "hour",
    "day_of_week",
    "vehicle_count",
    "weather",
    "is_holiday",
    "temperature",
    "density_pct",
    "congestion",
])

# ── Save ──────────────────────────────────────────────────────
out_path = os.path.join(os.path.dirname(__file__), "traffic_dataset.csv")
df.to_csv(out_path, index=False)

# ── Summary ───────────────────────────────────────────────────
print("=" * 50)
print("  traffic_dataset.csv generated successfully!")
print("=" * 50)
print(f"\n  Total rows      : {len(df):,}")
print(f"  Output path     : {out_path}")

print("\n  Congestion distribution:")
dist = df["congestion"].value_counts().sort_index()
labels = {0: "free flow", 1: "moderate", 2: "heavy"}
for lvl, count in dist.items():
    pct = count / len(df) * 100
    print(f"    {lvl} ({labels[lvl]:<10}): {count:>5} rows  ({pct:.1f}%)")

print("\n  Vehicle count averages:")
peak = df[df["hour"].isin([7, 8, 9, 17, 18, 19])]["vehicle_count"].mean()
off  = df[~df["hour"].isin([7, 8, 9, 17, 18, 19])]["vehicle_count"].mean()
print(f"    Peak hours   : {peak:.0f} vehicles")
print(f"    Off-peak     : {off:.0f} vehicles")

print("\n  Weather breakdown:")
wlabels = {0: "clear", 1: "rain", 2: "fog", 3: "storm"}
for w, cnt in df["weather"].value_counts().sort_index().items():
    print(f"    {w} ({wlabels[w]:<6}): {cnt:>5} rows")

print(f"\n  Holiday rows    : {df['is_holiday'].sum()}")
print(f"  Weekend rows    : {(df['day_of_week'] >= 5).sum()}")
print("\n  Next step: POST http://localhost:8000/api/ml/train")
print("=" * 50)