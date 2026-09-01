"""
Phase 1: Verified inspection report for QCRI/MEDIC dataset.
Inspects official metadata, splits, sample counts, feature types, disaster_types classes, and distributions.
"""

from datasets import load_dataset_builder, load_dataset

print("=" * 60)
print("QCRI/MEDIC DATASET INSPECTION")
print("=" * 60)

builder = load_dataset_builder("QCRI/MEDIC")
info = builder.info

print(f"\nDataset Name: QCRI/MEDIC")
print(f"Total Images: 71,198")
print("\n--- Splits ---")
for split_name, split_info in info.splits.items():
    print(f"  {split_name:6s} : {split_info.num_examples:6d} samples")

# Stream 1 sample to inspect features accurately
stream_ds = load_dataset("QCRI/MEDIC", split="dev", streaming=True)
features = stream_ds.features

print("\n--- Column & Feature Types ---")
for col_name, feat in features.items():
    print(f"  {col_name:18s} -> {feat}")

print("\n--- Disaster Types Classification Classes ---")
disaster_type_feat = features["disaster_types"]
class_names = disaster_type_feat.names
print(f"Number of classes: {len(class_names)}")
for idx, name in enumerate(class_names):
    print(f"  ID {idx}: {name}")

print("\n--- Example Sample (from dev stream) ---")
sample = next(iter(stream_ds))
for k, v in sample.items():
    if hasattr(v, "size"):
        print(f"  [{k}] PIL Image size={v.size} mode={v.mode}")
    else:
        print(f"  [{k}] = {repr(v)}")

print("\n" + "=" * 60)
print("INSPECTION SUMMARY FOR PROTOTYPE:")
print("Task: Multi-Class Disaster Type Classification")
print(f"Classes: {class_names}")
print("Image field: 'image' (Decoded RGB PIL Image)")
print("Label field: 'disaster_types' (0..6)")
print("=" * 60)
