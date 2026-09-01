"""
Phase 5: Comprehensive evaluation of DisasterTypeClassifier on unseen test set.
Generates accuracy, macro F1, per-class precision/recall/F1, and confusion matrix.
Saves results to ml/results/
"""

import os
import json
import csv
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

PROCESSED_DIR = "ml/medic/processed"
CHECKPOINT = "ml/models/disaster_type_classifier.pth"
RESULTS_DIR = "ml/results"
os.makedirs(RESULTS_DIR, exist_ok=True)

LABEL_NAMES = [
    "earthquake",
    "flood",
    "hurricane",
    "fire",
    "landslide",
    "not_disaster",
    "other_disaster",
]
NUM_CLASSES = len(LABEL_NAMES)
IMG_SIZE = (224, 224)

device = (
    "mps" if torch.backends.mps.is_available()
    else "cuda" if torch.cuda.is_available()
    else "cpu"
)

# Load test dataset
test_csv = os.path.join(PROCESSED_DIR, "test.csv")
test_samples = []
with open(test_csv) as f:
    for row in csv.DictReader(f):
        test_samples.append((row["path"], int(row["label_id"])))

print("=" * 60)
print(f"EVALUATING MEDIC DISASTER TYPE MODEL ({len(test_samples)} test samples)")
print("=" * 60)

# Build Model
model = models.mobilenet_v2(weights=None)
model.classifier = nn.Sequential(
    nn.Dropout(0.3),
    nn.Linear(model.last_channel, NUM_CLASSES)
)

if not os.path.exists(CHECKPOINT):
    print(f"Error: Checkpoint {CHECKPOINT} not found! Run train.py first.")
    exit(1)

model.load_state_dict(torch.load(CHECKPOINT, map_location=device))
model = model.to(device)
model.eval()

transform = transforms.Compose([
    transforms.Resize(IMG_SIZE),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

all_preds = []
all_labels = []

with torch.no_grad():
    for rel_path, label_id in test_samples:
        img_path = os.path.join(PROCESSED_DIR, rel_path)
        img = Image.open(img_path).convert("RGB")
        tensor = transform(img).unsqueeze(0).to(device)
        out = model(tensor)
        pred = out.argmax(dim=1).item()
        all_preds.append(pred)
        all_labels.append(label_id)

acc = accuracy_score(all_labels, all_preds)
report = classification_report(all_labels, all_preds, target_names=LABEL_NAMES, output_dict=True, zero_division=0)
cm = confusion_matrix(all_labels, all_preds, labels=list(range(NUM_CLASSES))).tolist()

print(f"\n--- OVERALL METRICS ---")
print(f"Overall Accuracy : {acc * 100:.2f}%")
print(f"Macro F1 Score   : {report['macro avg']['f1-score'] * 100:.2f}%")
print(f"Weighted F1 Score: {report['weighted avg']['f1-score'] * 100:.2f}%")

print(f"\n--- PER-CLASS PERFORMANCE ---")
print(f"{'Class':18s} | {'Precision':10s} | {'Recall':10s} | {'F1-Score':10s}")
print("-" * 55)
for name in LABEL_NAMES:
    cls_data = report[name]
    print(f"{name:18s} | {cls_data['precision']*100:9.1f}% | {cls_data['recall']*100:9.1f}% | {cls_data['f1-score']*100:9.1f}%")

print(f"\n--- CONFUSION MATRIX ---")
print(f"Classes: {LABEL_NAMES}")
for idx, row in enumerate(cm):
    print(f"  {LABEL_NAMES[idx]:16s}: {row}")

# Save results
eval_result = {
    "model": "MobileNetV2 (QCRI/MEDIC)",
    "accuracy": acc,
    "classification_report": report,
    "confusion_matrix": cm,
    "classes": LABEL_NAMES,
}

with open(os.path.join(RESULTS_DIR, "medic_evaluation.json"), "w") as f:
    json.dump(eval_result, f, indent=2)

with open(os.path.join(RESULTS_DIR, "medic_confusion_matrix.json"), "w") as f:
    json.dump({"classes": LABEL_NAMES, "matrix": cm}, f, indent=2)

print(f"\nSaved evaluation to {RESULTS_DIR}/medic_evaluation.json & {RESULTS_DIR}/medic_confusion_matrix.json")
