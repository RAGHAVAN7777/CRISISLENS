# BiTemporal-StreetView-Damage ML Pipeline

This directory contains the machine learning pipeline for the Disaster Intelligence Network prototype. It trains a lightweight MobileNetV2 damage-severity classifier on the Hugging Face dataset `Rayford295/BiTemporal-StreetView-Damage`.

## Prerequisites

```bash
pip3 install datasets pillow numpy torch torchvision scikit-learn huggingface_hub fastapi uvicorn python-multipart
```

## Workflow

### 1. Download & Inspect Dataset
```bash
python3 inspect_dataset.py
```
This script downloads the raw dataset zip file from Hugging Face and extracts it. It handles the workaround for the dataset's corrupt class label metadata.

### 2. Prepare Dataset
```bash
python3 prepare_dataset.py
```
Converts the raw images into a clean 512x256 format (preserving the bi-temporal left/right ratio) and generates train, validation, and test CSV manifests in `processed/`.

### 3. Train Model
```bash
python3 train.py
```
Trains a MobileNetV2 model using transfer learning. 
- Phase 1: Freezes backbone and trains the classifier head.
- Phase 2: Unfreezes the top layers and fine-tunes.
Saves the best model checkpoint to `models/damage_classifier.pth` and metrics to `models/metrics.json`.

*Note: The model file is not checked into Git due to size.*

### 4. Inference Server
```bash
python3 inference_server.py
```
Starts a FastAPI server on `http://localhost:8000`. 
Exposes a `POST /predict` endpoint that accepts an image upload and returns hazard, severity, confidence, and visual evidence.
If the trained model checkpoint is not found, the server automatically falls back to a deterministic heuristic mode so the prototype demo always works.
