"""
Step 3: Preprocessing Pipeline for BiTemporal-StreetView-Damage

Converts the raw zip-extracted images into a clean train/val/test split
with a manifest CSV. No database. Pure filesystem + JSON/CSV.

Output:
  ml/processed/
    train.csv       — path, label_id, label_name
    val.csv
    test.csv
    label_map.json  — {0: "no_damage", 1: "mild", 2: "moderate", 3: "severe"}
"""

import os
import json
import random
import csv
import shutil
from PIL import Image

# ── Config ─────────────────────────────────────────────────────────────────────
BASE_DIR     = "ml/raw_dataset/extracted/final_label_image"
OUT_DIR      = "ml/processed"
SEED         = 42
TRAIN_RATIO  = 0.70
VAL_RATIO    = 0.15
# TEST_RATIO  = 0.15 (remainder)
IMG_SIZE     = (512, 256)   # Preserves the bi-temporal left/right ratio

# Folder → label mapping (from actual README inspection)
FOLDER_LABELS = {
    "no_damage": (0, "no_damage"),
    "folder_0":  (1, "mild"),
    "folder_1":  (2, "moderate"),
    "folder_2":  (3, "severe"),
}

random.seed(SEED)
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(os.path.join(OUT_DIR, "images_resized"), exist_ok=True)

# ── Save label map ──────────────────────────────────────────────────────────────
label_map = {str(v[0]): v[1] for v in FOLDER_LABELS.values()}
with open(os.path.join(OUT_DIR, "label_map.json"), "w") as f:
    json.dump(label_map, f, indent=2)
print(f"Saved label_map.json: {label_map}")

# ── Collect all samples ─────────────────────────────────────────────────────────
all_samples = []
for folder, (label_id, label_name) in FOLDER_LABELS.items():
    folder_path = os.path.join(BASE_DIR, folder)
    if not os.path.isdir(folder_path):
        print(f"WARNING: {folder_path} does not exist, skipping.")
        continue
    files = sorted([f for f in os.listdir(folder_path) if f.endswith(".png")])
    print(f"  {folder:12s} → {len(files):5d} images  (label {label_id}: {label_name})")
    for fname in files:
        all_samples.append({
            "src_path":   os.path.join(folder_path, fname),
            "label_id":   label_id,
            "label_name": label_name,
            "filename":   f"{folder}_{fname}",
        })

print(f"\nTotal samples collected: {len(all_samples)}")

# ── Resize + save processed images ─────────────────────────────────────────────
print(f"\nResizing images to {IMG_SIZE} and saving to {OUT_DIR}/images_resized/ ...")
processed_rows = []
skipped = 0

for i, s in enumerate(all_samples):
    dst_name = s["filename"]
    dst_path = os.path.join(OUT_DIR, "images_resized", dst_name)

    if not os.path.exists(dst_path):
        try:
            img = Image.open(s["src_path"]).convert("RGB")
            img = img.resize(IMG_SIZE, Image.LANCZOS)
            img.save(dst_path, "PNG")
        except Exception as e:
            print(f"  SKIP {s['src_path']}: {e}")
            skipped += 1
            continue

    processed_rows.append({
        "path":       os.path.join("images_resized", dst_name),
        "label_id":   s["label_id"],
        "label_name": s["label_name"],
    })

    if (i + 1) % 500 == 0:
        print(f"  Processed {i+1}/{len(all_samples)} ...")

print(f"Done. {len(processed_rows)} processed, {skipped} skipped.")

# ── Stratified split ────────────────────────────────────────────────────────────
def stratified_split(rows, train_r, val_r, seed=42):
    from collections import defaultdict
    rng = random.Random(seed)
    by_label = defaultdict(list)
    for r in rows:
        by_label[r["label_id"]].append(r)
    train, val, test = [], [], []
    for label_id, items in by_label.items():
        rng.shuffle(items)
        n = len(items)
        n_train = int(n * train_r)
        n_val   = int(n * val_r)
        train += items[:n_train]
        val   += items[n_train:n_train + n_val]
        test  += items[n_train + n_val:]
    return train, val, test

train_rows, val_rows, test_rows = stratified_split(processed_rows, TRAIN_RATIO, VAL_RATIO)
print(f"\nSplit sizes: train={len(train_rows)}, val={len(val_rows)}, test={len(test_rows)}")

# ── Write CSV manifests ─────────────────────────────────────────────────────────
FIELDNAMES = ["path", "label_id", "label_name"]
for split_name, rows in [("train", train_rows), ("val", val_rows), ("test", test_rows)]:
    csv_path = os.path.join(OUT_DIR, f"{split_name}.csv")
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)
    # Count per class
    from collections import Counter
    dist = Counter(r["label_name"] for r in rows)
    print(f"  {split_name}.csv → {len(rows)} samples | {dict(dist)}")

print(f"\nPreprocessing complete. Output in: {OUT_DIR}/")
print("Files created:")
for f in sorted(os.listdir(OUT_DIR)):
    size = os.path.getsize(os.path.join(OUT_DIR, f)) if os.path.isfile(os.path.join(OUT_DIR, f)) else "dir"
    print(f"  {f}  ({size})")
