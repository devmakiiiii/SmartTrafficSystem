"""
Machine Learning Module
=======================
Trains and runs congestion prediction models using scikit-learn.

Pipeline:
  1. Load CSV dataset
  2. Preprocess & feature engineer
  3. Train/test split (80/20)
  4. Train multiple models and compare
  5. Save best model with joblib
  6. Expose predict() function for API calls

Models compared:
  - Random Forest (primary – handles non-linear patterns well)
  - Decision Tree  (interpretable, fast)
  - Naive Bayes    (probabilistic, fast)
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Any, Optional

from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, accuracy_score

BASE_DIR    = Path(__file__).parent.parent.parent
DATASET_PATH = BASE_DIR / "datasets" / "traffic_dataset.csv"
MODEL_PATH   = BASE_DIR / "datasets" / "model.joblib"
SCALER_PATH  = BASE_DIR / "datasets" / "scaler.joblib"
METRICS_PATH = BASE_DIR / "datasets" / "metrics.json"

FEATURES = ["hour", "day_of_week", "vehicle_count", "weather",
            "is_holiday", "temperature", "density_pct"]
TARGET   = "congestion"
LABELS   = {0: "none", 1: "low", 2: "medium", 3: "high"}


# ─────────────────────────────────────────────────────────────
# FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add derived features that help the model learn patterns."""
    df = df.copy()

    # Cyclical encoding of hour (so 23 is "close" to 0)
    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)

    # Cyclical encoding of day of week
    df["dow_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 7)
    df["dow_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 7)

    # Peak hour flag
    df["is_peak"] = ((df["hour"] >= 7) & (df["hour"] <= 9) |
                     (df["hour"] >= 17) & (df["hour"] <= 19)).astype(int)

    # Is weekend
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)

    return df


# ─────────────────────────────────────────────────────────────
# TRAINING
# ─────────────────────────────────────────────────────────────

def train_models() -> Dict[str, Any]:
    """
    Load data, engineer features, train three models, evaluate, save best.
    Returns evaluation metrics for all models.
    """
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")

    df = pd.read_csv(DATASET_PATH)
    df = engineer_features(df)

    feat_cols = FEATURES + ["hour_sin","hour_cos","dow_sin","dow_cos","is_peak","is_weekend"]
    X = df[feat_cols].values
    y = df[TARGET].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler   = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    candidates = {
        "RandomForest": RandomForestClassifier(n_estimators=100, random_state=42),
        "DecisionTree": DecisionTreeClassifier(max_depth=8, random_state=42),
        "NaiveBayes":   GaussianNB(),
    }

    results = {}
    best_name, best_acc, best_model = None, 0.0, None

    for name, clf in candidates.items():
        clf.fit(X_train_s, y_train)
        y_pred = clf.predict(X_test_s)
        acc    = accuracy_score(y_test, y_pred)
        report = classification_report(y_test, y_pred, output_dict=True)
        results[name] = {"accuracy": round(acc, 4), "report": report}
        if acc > best_acc:
            best_acc, best_name, best_model = acc, name, clf

    # Save best model and scaler
    joblib.dump(best_model, MODEL_PATH)
    joblib.dump(scaler,     SCALER_PATH)
    joblib.dump(feat_cols,  BASE_DIR / "datasets" / "features.joblib")

    metrics = {
        "best_model": best_name,
        "best_accuracy": round(best_acc, 4),
        "models": results,
        "feature_cols": feat_cols,
    }
    METRICS_PATH.write_text(json.dumps(metrics, indent=2))
    return metrics


# ─────────────────────────────────────────────────────────────
# PREDICTION
# ─────────────────────────────────────────────────────────────

_model:  Optional[Any] = None
_scaler: Optional[Any] = None
_feat_cols = None

def _load_model():
    global _model, _scaler, _feat_cols
    if _model is None:
        if not MODEL_PATH.exists():
            train_models()
        _model    = joblib.load(MODEL_PATH)
        _scaler   = joblib.load(SCALER_PATH)
        _feat_cols = joblib.load(BASE_DIR / "datasets" / "features.joblib")


def predict_congestion(hour: int, day_of_week: int, vehicle_count: int,
                        weather: int = 0, is_holiday: int = 0,
                        temperature: float = 28.0) -> Dict[str, Any]:
    """
    Predict congestion level for given conditions.

    Parameters (matching dataset columns)
    ----------
    hour          : 0–23
    day_of_week   : 0=Monday … 6=Sunday
    vehicle_count : expected vehicles/hour
    weather       : 0=clear 1=rain 2=fog 3=storm
    is_holiday    : 0 or 1
    temperature   : degrees Celsius

    Returns
    -------
    dict with predicted label, probability, and explanation
    """
    _load_model()

    density_pct = min(100, (vehicle_count / 500) * 100)

    row = {
        "hour": hour, "day_of_week": day_of_week,
        "vehicle_count": vehicle_count, "weather": weather,
        "is_holiday": is_holiday, "temperature": temperature,
        "density_pct": density_pct,
    }

    # Engineer features
    df = pd.DataFrame([row])
    df = engineer_features(df)
    X  = df[_feat_cols].values
    Xs = _scaler.transform(X)

    pred    = int(_model.predict(Xs)[0])
    proba   = _model.predict_proba(Xs)[0].tolist()

    weather_map = {0:"clear", 1:"rain", 2:"fog", 3:"storm"}
    day_map     = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]

    return {
        "prediction":        pred,
        "label":             LABELS[pred],
        "probabilities":     {LABELS[i]: round(p, 3) for i, p in enumerate(proba)},
        "confidence":        round(max(proba), 3),
        "inputs": {
            "hour":          hour,
            "day":           day_map[day_of_week],
            "vehicle_count": vehicle_count,
            "weather":       weather_map.get(weather,"clear"),
            "density_pct":   round(density_pct, 1),
        },
        "explanation": (
            f"At {hour:02d}:00 on {day_map[day_of_week]} with {vehicle_count} vehicles "
            f"and {weather_map.get(weather,'clear')} weather → predicted congestion: "
            f"'{LABELS[pred]}' (confidence {max(proba):.0%})."
        ),
    }


def get_metrics() -> Dict[str, Any]:
    if METRICS_PATH.exists():
        return json.loads(METRICS_PATH.read_text())
    return train_models()
