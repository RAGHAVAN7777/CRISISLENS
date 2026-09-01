"""
Phase 3: Preprocess QCRI/MEDIC dataset for Disaster Type Classification.
Extracts a stratified subset from the official splits across all 7 classes:
['earthquake', 'flood', 'hurricane', 'fire', 'landslide', 'not_disaster', 'other_disaster']
Saves normalized images (224x224) and train.csv / val.csv / test.csv manifests.
"""

import os
import json
import csv
from PIL import Image
from collections import Counter
from datasets import load_dataset

PROCESSED_DIR = "ml/medic/processed"
IMAGES_DIR = os.path.join(PROCESSED_DIR, "images")
os.makedirs(IMAGES_DIR, exist_ok=True)

IMG_SIZE = (224, 224)
TARGET_PER_CLASS_TRAIN = 250
TARGET_PER_CLASS_VAL = 50
TARGET_PER_CLASS_TEST = 60

LABEL_NAMES = [
    "earthquake",
    "flood",
    "hurricane",
    "fire",
    "landslide",
    "not_disaster",
    "other_disaster",
]

# Save label_map.json
label_map = {str(idx): name for idx, name in enumerate(LABEL_NAMES)}
with open(os.path.join(PROCESSED_DIR, "label_map.json"), "w") as f:
    json.dump(label_map, f, indent=2)

print("=" * 60)
print("PREPARING QCRI/MEDIC SUBSET ACROSS 7 DISASTER TYPES")
print("=" * 60)
print(f"Target classes: {LABEL_NAMES}")

def extract_split_samples(split_name, target_per_class, max_scan=5000):
    print(f"\nStreaming samples from split '{split_name}' (target: {target_per_class}/class, max_scan={max_scan})...")
    ds_stream = load_dataset("QCRI/MEDIC", split=split_name, streaming=True)
    
    class_counts = Counter()
    extracted_rows = []
    
    for idx, sample in enumerate(ds_stream):
        if idx >= max_scan:
            break
            
        label_id = sample.get("disaster_types")
        if label_id is None or label_id < 0 or label_id >= len(LABEL_NAMES):
            continue
            
        label_name = LABEL_NAMES[label_id]
        if class_counts[label_id] >= target_per_class:
            if all(class_counts[c] >= target_per_class for c in range(len(LABEL_NAMES))):
                break
            continue
            
        img = sample.get("image")
        if img is None:
            continue
            
        try:
            filename = f"{split_name}_{label_name}_{class_counts[label_id]:04d}.jpg"
            img_path = os.path.join(IMAGES_DIR, filename)
            if not os.path.exists(img_path):
                img = img.convert("RGB").resize(IMG_SIZE, Image.LANCZOS)
                img.save(img_path, "JPEG", quality=85)
            
            rel_path = os.path.join("images", filename)
            extracted_rows.append({
                "path": rel_path,
                "label_id": label_id,
                "label_name": label_name,
            })
            class_counts[label_id] += 1
        except Exception as e:
            continue

    print(f"Extracted {len(extracted_rows)} samples for {split_name}: {dict(class_counts)}")
    return extracted_rows

# Extract Train, Dev, Test
train_rows = extract_split_samples("train", TARGET_PER_CLASS_TRAIN, max_scan=6000)
val_rows = extract_split_samples("dev", TARGET_PER_CLASS_VAL, max_scan=2000)
test_rows = extract_split_samples("test", TARGET_PER_CLASS_TEST, max_scan=2500)

# Write CSV files
for split_name, rows in [("train", train_rows), ("val", val_rows), ("test", test_rows)]:
    csv_path = os.path.join(PROCESSED_DIR, f"{split_name}.csv")
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["path", "label_id", "label_name"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Saved {csv_path} with {len(rows)} samples.")

print("\n" + "=" * 60)
print(f"PREPARATION COMPLETE! Total images saved in {IMAGES_DIR}")
print(f"Train: {len(train_rows)} | Val: {len(val_rows)} | Test: {len(test_rows)}")
print("=" * 60)
