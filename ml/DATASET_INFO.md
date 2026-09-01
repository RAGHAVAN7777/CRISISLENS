# BiTemporal-StreetView-Damage Dataset — Inspection Report

## Dataset Overview

| Field | Value |
|---|---|
| **Name** | BiTemporal-StreetView-Damage |
| **HuggingFace Repository** | `Rayford295/BiTemporal-StreetView-Damage` |
| **License** | CC BY-NC 4.0 (Non-commercial research only) |
| **Author** | Yang, Yifan (2026) |
| **Source Paper** | *Hyperlocal disaster damage assessment using bi-temporal street-view imagery and pre-trained vision models*, Computers, Environment and Urban Systems, Vol. 121, 2025 |

---

## Actual File Structure (from zip)

The HuggingFace dataset loader is **broken** (the repo metadata references a git commit SHA as a class label). The actual data lives in one file:

```
final_label_image.zip
└── final_label_image/
    ├── folder_0/      555 PNG images   → Mild damage
    ├── folder_1/     1088 PNG images   → Moderate damage
    ├── folder_2/      606 PNG images   → Severe damage
    └── no_damage/    2558 PNG images   → No damage (pre-disaster baseline)
```

**Total images: 4,807**

---

## Image Format

| Property | Value |
|---|---|
| **Dimensions** | 1024 × 512 pixels (side-by-side bi-temporal pair) |
| **Mode** | RGB PNG |
| **Left half (0–512px)** | Pre-disaster street view |
| **Right half (512–1024px)** | Post-disaster street view |
| **Year convention** | `_2024` suffix = post-disaster; `_2023` suffix = pre-disaster baseline (no_damage) |

The 1024×512 format encodes **before (left) + after (right)** in a single image file.

---

## Label Structure

| Folder | Label ID | Severity | Count | % of dataset |
|---|---|---|---|---|
| `no_damage` | 0 | **No Damage** | 2558 | 53.2% |
| `folder_0` | 1 | **Mild** | 555 | 11.5% |
| `folder_1` | 2 | **Moderate** | 1088 | 22.6% |
| `folder_2` | 3 | **Severe** | 606 | 12.6% |

**Class imbalance**: No-damage class is 4.6× larger than Mild and nearly equal to all damage classes combined. Weighted sampling or loss weighting required.

---

## Disaster Type Coverage

> ⚠️ The dataset focuses on **hurricane-related street-level damage**. It does NOT directly provide labels for Flood / Fire / Chemical Spill categories.

The damage severity (Mild/Moderate/Severe/None) maps to **structural damage perception** from a street viewpoint — consistent with our `STRUCTURAL DAMAGE` hazard category.

---

## How This Dataset Relates to Our Project

### What it CAN do (honest scope)
- Train a **4-class damage severity classifier**: No Damage → Mild → Moderate → Severe
- Power the `/judge` page's `DamageClassifier` component of `VisionService`
- Augment the `STRUCTURAL DAMAGE` hazard detection pipeline with a real trained model instead of heuristics
- Provide severity-confidence scores that feed into `AIReasoningService`

### What it CANNOT do (honest limitations)
- Does NOT distinguish Flood vs. Fire vs. Chemical Spill
- Does NOT provide pixel-level segmentation
- Trained on hurricane damage; may not generalize perfectly to other disaster types

### Architecture that keeps it honest

```
VisionService
    ├── DamageClassifier (THIS MODEL)
    │     → outputs: No Damage / Mild / Moderate / Severe
    │     → maps to: severity (LOW / MEDIUM / HIGH / CRITICAL)
    │     → when hazard = STRUCTURAL DAMAGE
    │
    ├── GroqVisionClassifier (existing Groq API)
    │     → handles: FLOOD, FIRE, ROAD BLOCKAGE, FALLEN OBJECT
    │     → fallback when DamageClassifier is not definitive
    │
    └── FallbackDemoClassifier
          → deterministic heuristics for demo reliability
```

---

## ML Strategy

**Transfer learning with MobileNetV2** — chosen for:
- Lightweight (3.4M params) → fast inference on CPU/MPS
- Pretrained on ImageNet → strong feature extraction from street imagery
- Suitable for 4-class classification on ~4800 images
- The bi-temporal pair is fed as a single 1024×512 image (the model sees both before and after simultaneously — this is exactly what the dataset intends)

**Training plan:**
- Resize to 224×224 (standard) or 512×256 (preserves bi-temporal ratio better)
- Data augmentation: horizontal flip, color jitter, random crop
- Freeze backbone, train head for 5 epochs → unfreeze and fine-tune for 10 more
- WeightedRandomSampler to address class imbalance
- Metrics: accuracy, precision, recall, F1, confusion matrix
- Save best checkpoint by validation F1

---

## Sample Structure (programmatic)

```python
{
  "image_path": "ml/raw_dataset/extracted/final_label_image/folder_1/1000588895173412_2024.png",
  "label_id": 2,          # 0=no_damage, 1=mild, 2=moderate, 3=severe
  "label_name": "moderate",
  "split": "train"
}
```
