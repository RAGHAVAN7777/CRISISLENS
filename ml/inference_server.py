"""
Multi-Model FastAPI inference server for:
1. BiTemporal Damage Severity Classifier (Rayford295/BiTemporal-StreetView-Damage) -> POST /predict
2. MEDIC Disaster Type Classifier (QCRI/MEDIC) -> POST /predict-disaster-type
"""

import io
import json
import os
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# ── Paths ───────────────────────────────────────────────────────────────────────
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
DAMAGE_CHECKPOINT = os.path.join(MODEL_DIR, "damage_classifier.pth")
MEDIC_CHECKPOINT = os.path.join(MODEL_DIR, "disaster_type_classifier.pth")

# ── Model 1: Damage Severity Setup ──────────────────────────────────────────────
DAMAGE_LABEL_NAMES = ["no_damage", "mild", "moderate", "severe"]
DAMAGE_NUM_CLASSES = 4

DAMAGE_TO_HAZARD = {
    "no_damage": {
        "hazard": "NONE",
        "severity": "LOW",
        "evidence": ["No visible structural damage detected", "Street condition appears normal"],
    },
    "mild": {
        "hazard": "STRUCTURAL DAMAGE",
        "severity": "LOW",
        "evidence": ["Minor visible damage detected", "Small debris or surface damage", "Limited facade damage"],
    },
    "moderate": {
        "hazard": "STRUCTURAL DAMAGE",
        "severity": "HIGH",
        "evidence": ["Clearly visible structural damage", "Environmental damage evident", "Moderate building impact"],
    },
    "severe": {
        "hazard": "STRUCTURAL DAMAGE",
        "severity": "CRITICAL",
        "evidence": ["Extensive or catastrophic damage", "Near-complete structural destruction", "Severe post-disaster impact"],
    },
}

DAMAGE_IMG_SIZE = (256, 512)
damage_transform = transforms.Compose([
    transforms.Resize(DAMAGE_IMG_SIZE),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

# ── Model 2: MEDIC Disaster Type Setup ──────────────────────────────────────────
MEDIC_LABEL_NAMES = [
    "earthquake",
    "flood",
    "hurricane",
    "fire",
    "landslide",
    "not_disaster",
    "other_disaster",
]
MEDIC_NUM_CLASSES = 7

MEDIC_HAZARD_MAP = {
    "earthquake": "EARTHQUAKE",
    "flood": "FLOOD",
    "hurricane": "HURRICANE / CYCLONE",
    "fire": "FIRE / WILDFIRE",
    "landslide": "LANDSLIDE / DEBRIS",
    "not_disaster": "NOT DISASTER",
    "other_disaster": "OTHER DISASTER",
}

MEDIC_IMG_SIZE = (224, 224)
medic_transform = transforms.Compose([
    transforms.Resize(MEDIC_IMG_SIZE),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

# ── Device & Model Loading ──────────────────────────────────────────────────────
device_str = (
    "mps" if torch.backends.mps.is_available()
    else "cuda" if torch.cuda.is_available()
    else "cpu"
)

damage_model = None
DAMAGE_MODEL_LOADED = False

medic_model = None
MEDIC_MODEL_LOADED = False

def load_models():
    global damage_model, DAMAGE_MODEL_LOADED, medic_model, MEDIC_MODEL_LOADED
    
    # 1. Load Damage Model
    if os.path.exists(DAMAGE_CHECKPOINT):
        try:
            m1 = models.mobilenet_v2(weights=None)
            m1.classifier = nn.Sequential(
                nn.Dropout(0.3),
                nn.Linear(m1.last_channel, DAMAGE_NUM_CLASSES),
            )
            m1.load_state_dict(torch.load(DAMAGE_CHECKPOINT, map_location=device_str))
            m1.eval()
            m1 = m1.to(device_str)
            damage_model = m1
            DAMAGE_MODEL_LOADED = True
            print(f"[OK] Loaded BiTemporal Damage model from {DAMAGE_CHECKPOINT}")
        except Exception as e:
            print(f"[WARN] Failed to load damage model: {e}")
    
    # 2. Load MEDIC Disaster Type Model
    if os.path.exists(MEDIC_CHECKPOINT):
        try:
            m2 = models.mobilenet_v2(weights=None)
            m2.classifier = nn.Sequential(
                nn.Dropout(0.3),
                nn.Linear(m2.last_channel, MEDIC_NUM_CLASSES),
            )
            m2.load_state_dict(torch.load(MEDIC_CHECKPOINT, map_location=device_str))
            m2.eval()
            m2 = m2.to(device_str)
            medic_model = m2
            MEDIC_MODEL_LOADED = True
            print(f"[OK] Loaded MEDIC Disaster Type model from {MEDIC_CHECKPOINT}")
        except Exception as e:
            print(f"[WARN] Failed to load MEDIC model: {e}")

load_models()

# ── FastAPI App ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Disaster Intelligence Vision API",
    description="Dual Vision Pipeline: MEDIC Disaster Type Classification + BiTemporal Damage Severity",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    # Attempt reload if checkpoints appeared
    if not DAMAGE_MODEL_LOADED or not MEDIC_MODEL_LOADED:
        load_models()
    return {
        "status": "ok",
        "device": device_str,
        "damage_model": {
            "loaded": DAMAGE_MODEL_LOADED,
            "checkpoint": DAMAGE_CHECKPOINT if DAMAGE_MODEL_LOADED else None,
            "classes": DAMAGE_LABEL_NAMES,
        },
        "medic_model": {
            "loaded": MEDIC_MODEL_LOADED,
            "checkpoint": MEDIC_CHECKPOINT if MEDIC_MODEL_LOADED else None,
            "classes": MEDIC_LABEL_NAMES,
        },
    }

# ── Endpoint 1: BiTemporal Damage Severity ──────────────────────────────────────
@app.post("/predict")
async def predict_damage(image: UploadFile = File(...)):
    """
    Classify structural damage severity from image using BiTemporal-StreetView-Damage model.
    """
    try:
        contents = await image.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    global DAMAGE_MODEL_LOADED, damage_model
    if not DAMAGE_MODEL_LOADED:
        load_models()

    if not DAMAGE_MODEL_LOADED or damage_model is None:
        return _fallback_damage_predict(img)

    tensor = damage_transform(img).unsqueeze(0).to(device_str)
    with torch.no_grad():
        logits = damage_model(tensor)
        probs = F.softmax(logits, dim=1).squeeze().cpu().tolist()

    pred_idx = int(torch.argmax(torch.tensor(probs)))
    pred_label = DAMAGE_LABEL_NAMES[pred_idx]
    confidence = round(probs[pred_idx] * 100, 1)
    mapping = DAMAGE_TO_HAZARD[pred_label]

    return {
        "hazard": mapping["hazard"],
        "severity": mapping["severity"],
        "confidence": confidence,
        "evidence": mapping["evidence"],
        "damage_class": pred_label,
        "raw_probs": {
            DAMAGE_LABEL_NAMES[i]: round(probs[i] * 100, 1)
            for i in range(DAMAGE_NUM_CLASSES)
        },
        "model": "BiTemporal-StreetView-Damage (MobileNetV2)",
        "mode": "real_ml_inference",
    }

# ── Endpoint 2: MEDIC Disaster Type Classifier ──────────────────────────────────
@app.post("/predict-disaster-type")
async def predict_disaster_type(image: UploadFile = File(...)):
    """
    Classify disaster type (Earthquake, Flood, Fire, Hurricane, Landslide, etc.) using MEDIC model.
    """
    try:
        contents = await image.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    global MEDIC_MODEL_LOADED, medic_model
    if not MEDIC_MODEL_LOADED:
        load_models()

    if not MEDIC_MODEL_LOADED or medic_model is None:
        return _fallback_medic_predict(img)

    tensor = medic_transform(img).unsqueeze(0).to(device_str)
    with torch.no_grad():
        logits = medic_model(tensor)
        probs = F.softmax(logits, dim=1).squeeze().cpu().tolist()

    pred_idx = int(torch.argmax(torch.tensor(probs)))
    pred_label = MEDIC_LABEL_NAMES[pred_idx]
    confidence = round(probs[pred_idx] * 100, 1)
    hazard_title = MEDIC_HAZARD_MAP.get(pred_label, pred_label.upper())

    prob_dict = {
        MEDIC_LABEL_NAMES[i]: round(probs[i] * 100, 1)
        for i in range(MEDIC_NUM_CLASSES)
    }

    return {
        "model": "QCRI MEDIC Multi-Disaster Classifier (MobileNetV2)",
        "hazard": hazard_title,
        "disaster_type": pred_label,
        "confidence": confidence,
        "probabilities": prob_dict,
        "mode": "real_ml_inference",
    }

# ── Endpoint 3: Disaster Time Machine ML Forecast ──────────────────────────────
from pydantic import BaseModel
from typing import Optional, List

class ForecastRequest(BaseModel):
    latitude: float
    longitude: float
    timestamp: Optional[str] = None
    rainfall_mm: Optional[float] = None
    citizen_report_count: Optional[int] = 0
    is_volunteer_verified: Optional[bool] = False
    hazard_type: Optional[str] = "Flood"

try:
    import sys
    sys.path.append(os.path.join(os.path.dirname(__file__), "time_machine"))
    from predict import TimeMachinePredictor
    tm_predictor = TimeMachinePredictor()
    TM_PREDICTOR_LOADED = True
except Exception as e:
    print(f"Warning: Could not initialize TimeMachinePredictor: {e}")
    tm_predictor = None
    TM_PREDICTOR_LOADED = False

@app.post("/forecast")
async def post_forecast(req: ForecastRequest):
    """
    Real PyTorch GRU multi-horizon risk forecast endpoint.
    Accepts latitude, longitude, optional live telemetry or incident signals.
    """
    global tm_predictor, TM_PREDICTOR_LOADED
    if not TM_PREDICTOR_LOADED or tm_predictor is None:
        try:
            from predict import TimeMachinePredictor
            tm_predictor = TimeMachinePredictor()
            TM_PREDICTOR_LOADED = True
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Time Machine forecasting model unavailable: {e}")

    try:
        res = tm_predictor.predict_risk(
            latitude=req.latitude,
            longitude=req.longitude,
            live_rainfall_mm=req.rainfall_mm,
            citizen_report_count=req.citizen_report_count or 0,
            is_volunteer_verified=bool(req.is_volunteer_verified),
            hazard_type=req.hazard_type or "Flood"
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {e}")

@app.get("/forecast-metrics")
async def get_forecast_metrics():
    """
    Return measured test set evaluation metrics for the Time Machine GRU model.
    """
    metrics_path = os.path.join(os.path.dirname(__file__), "time_machine/data/evaluation_metrics.json")
    if os.path.exists(metrics_path):
        with open(metrics_path) as f:
            return json.load(f)
    return {"status": "Metrics not yet generated"}


def _fallback_damage_predict(img: Image.Image) -> dict:
    import numpy as np
    arr = np.array(img.resize((128, 64))).astype(float)
    score = (1 - (arr.mean() / 255.0)) * 0.5 + (arr.std() / 255.0) * 0.5
    label = "no_damage" if score < 0.25 else "mild" if score < 0.38 else "moderate" if score < 0.50 else "severe"
    mapping = DAMAGE_TO_HAZARD[label]
    return {
        "hazard": mapping["hazard"],
        "severity": mapping["severity"],
        "confidence": round(min(40 + score * 60, 75), 1),
        "evidence": mapping["evidence"] + ["DEMO FALLBACK: Model checkpoint loading"],
        "damage_class": label,
        "raw_probs": {l: 0.0 for l in DAMAGE_LABEL_NAMES},
        "model": "Damage Severity Heuristic (Demo Fallback)",
        "mode": "demo_fallback",
    }

def _fallback_medic_predict(img: Image.Image) -> dict:
    import numpy as np
    arr = np.array(img.resize((128, 128))).astype(float)
    r, g, b = arr[:, :, 0].mean(), arr[:, :, 1].mean(), arr[:, :, 2].mean()
    
    if r > g * 1.3 and r > b * 1.3:
        label = "fire"
    elif b > r * 1.1:
        label = "flood"
    else:
        label = "earthquake"
        
    return {
        "model": "MEDIC Heuristic (Demo Fallback)",
        "hazard": MEDIC_HAZARD_MAP[label],
        "disaster_type": label,
        "confidence": 68.0,
        "probabilities": {name: (68.0 if name == label else 5.3) for name in MEDIC_LABEL_NAMES},
        "mode": "demo_fallback",
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
