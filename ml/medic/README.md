# QCRI/MEDIC Disaster Type Classifier Pipeline

This module implements the second vision model for the **Disaster Intelligence Network** prototype, specifically focusing on **Disaster Type Classification** using the [QCRI/MEDIC](https://huggingface.co/datasets/QCRI/MEDIC) dataset.

---

## Model Responsibilities in Our Architecture

Our dual-model vision architecture separates concerns cleanly:

| Model | Dataset | Responsibility | Output Classes |
|---|---|---|---|
| **Disaster Type Classifier** | `QCRI/MEDIC` | Identifies the physical type of disaster | `earthquake`, `flood`, `hurricane`, `fire`, `landslide`, `not_disaster`, `other_disaster` |
| **Damage Severity Classifier** | `Rayford295/BiTemporal-StreetView-Damage` | Evaluates structural damage severity | `no_damage`, `mild`, `moderate`, `severe` |

---

## Dataset Structure

- **Total Dataset Size**: 71,198 images
- **Splits**:
  - `train`: 49,353 images
  - `dev`: 6,157 images
  - `test`: 15,688 images
- **Target Task**: `disaster_types` (7 classes)
  - `0`: `earthquake`
  - `1`: `flood`
  - `2`: `hurricane`
  - `3`: `fire`
  - `4`: `landslide`
  - `5`: `not_disaster`
  - `6`: `other_disaster`

---

## Pipeline Execution

### 1. Dataset Inspection
```bash
python3 ml/medic/inspect_dataset.py
```

### 2. Data Preparation
```bash
python3 ml/medic/prepare_dataset.py
```
Extracts a stratified, balanced dataset across all 7 disaster types, resizing to 224x224 and generating `train.csv`, `val.csv`, and `test.csv`.

### 3. Model Training
```bash
python3 ml/medic/train.py
```
Trains a `MobileNetV2` backbone with transfer learning:
- Phase 1: Classifier head training (frozen backbone)
- Phase 2: Top backbone layer fine-tuning
- Weighted loss sampling to balance rare classes
- Saves checkpoint to `ml/models/disaster_type_classifier.pth`

### 4. Evaluation
```bash
python3 ml/medic/evaluate.py
```
Evaluates on the unseen test set, generating precision, recall, macro F1, and confusion matrix saved to `ml/results/`.

### 5. Multi-Model Inference API
```bash
python3 ml/inference_server.py
```
Exposes:
- `POST /predict-disaster-type` (MEDIC model)
- `POST /predict` (BiTemporal Damage Severity model)
- `GET /health` (Model health and status)
