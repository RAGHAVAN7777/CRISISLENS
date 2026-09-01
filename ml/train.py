"""
Step 5: Train a lightweight damage-severity classifier
        using MobileNetV2 + transfer learning.

Dataset: BiTemporal-StreetView-Damage (4 classes)
  0 = no_damage
  1 = mild
  2 = moderate
  3 = severe

Strategy:
  - MobileNetV2 pretrained on ImageNet
  - Replace classifier head for 4-class output
  - Phase 1: freeze backbone, train head (5 epochs)
  - Phase 2: unfreeze top layers, fine-tune (10 epochs)
  - WeightedRandomSampler for class imbalance
  - Save best checkpoint by val F1
  - Export metrics to ml/models/metrics.json
"""

import os
import json
import csv
import time
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from torchvision import models, transforms
from PIL import Image
from collections import Counter
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, confusion_matrix
)

# ── Config ──────────────────────────────────────────────────────────────────────
PROCESSED_DIR = "ml/processed"
MODELS_DIR    = "ml/models"
CHECKPOINT    = os.path.join(MODELS_DIR, "damage_classifier.pth")
METRICS_FILE  = os.path.join(MODELS_DIR, "metrics.json")
IMG_SIZE      = (256, 512)   # H x W — preserves bi-temporal ratio
BATCH_SIZE    = 16
PHASE1_EPOCHS = 5
PHASE2_EPOCHS = 10
LR_HEAD       = 1e-3
LR_FINETUNE   = 2e-4
NUM_CLASSES   = 4
LABEL_NAMES   = ["no_damage", "mild", "moderate", "severe"]

os.makedirs(MODELS_DIR, exist_ok=True)

device = (
    "mps" if torch.backends.mps.is_available()
    else "cuda" if torch.cuda.is_available()
    else "cpu"
)
print(f"Using device: {device}")

# ── Dataset ─────────────────────────────────────────────────────────────────────
class DamageDataset(Dataset):
    def __init__(self, csv_path, base_dir, transform=None):
        self.base_dir  = base_dir
        self.transform = transform
        self.samples   = []
        with open(csv_path) as f:
            reader = csv.DictReader(f)
            for row in reader:
                self.samples.append((row["path"], int(row["label_id"])))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        rel_path, label = self.samples[idx]
        img_path = os.path.join(self.base_dir, rel_path)
        img = Image.open(img_path).convert("RGB")
        if self.transform:
            img = self.transform(img)
        return img, label

# ── Transforms ──────────────────────────────────────────────────────────────────
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]

train_tf = transforms.Compose([
    transforms.Resize(IMG_SIZE),
    transforms.RandomHorizontalFlip(),
    transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2),
    transforms.RandomGrayscale(p=0.05),
    transforms.ToTensor(),
    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])

val_tf = transforms.Compose([
    transforms.Resize(IMG_SIZE),
    transforms.ToTensor(),
    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])

# ── Load datasets ────────────────────────────────────────────────────────────────
train_ds = DamageDataset(os.path.join(PROCESSED_DIR, "train.csv"), PROCESSED_DIR, train_tf)
val_ds   = DamageDataset(os.path.join(PROCESSED_DIR, "val.csv"),   PROCESSED_DIR, val_tf)
test_ds  = DamageDataset(os.path.join(PROCESSED_DIR, "test.csv"),  PROCESSED_DIR, val_tf)

print(f"Train: {len(train_ds)} | Val: {len(val_ds)} | Test: {len(test_ds)}")

# ── Weighted sampler (class imbalance) ───────────────────────────────────────────
train_labels = [s[1] for s in train_ds.samples]
class_counts = Counter(train_labels)
class_weights = {c: 1.0 / class_counts[c] for c in class_counts}
sample_weights = [class_weights[lbl] for lbl in train_labels]
sampler = WeightedRandomSampler(sample_weights, num_samples=len(train_ds), replacement=True)

train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=sampler, num_workers=0)
val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
test_loader  = DataLoader(test_ds,  batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

# ── Model ────────────────────────────────────────────────────────────────────────
model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)
# Replace classifier head
model.classifier = nn.Sequential(
    nn.Dropout(0.3),
    nn.Linear(model.last_channel, NUM_CLASSES),
)
model = model.to(device)

# ── Helpers ──────────────────────────────────────────────────────────────────────
def freeze_backbone(m):
    for param in m.features.parameters():
        param.requires_grad = False

def unfreeze_top_layers(m, n=10):
    """Unfreeze the last n feature blocks."""
    blocks = list(m.features.children())
    for block in blocks[-n:]:
        for param in block.parameters():
            param.requires_grad = True

def evaluate(loader):
    model.eval()
    all_preds, all_labels = [], []
    with torch.no_grad():
        for imgs, lbls in loader:
            imgs = imgs.to(device)
            out  = model(imgs)
            preds = out.argmax(dim=1).cpu().tolist()
            all_preds.extend(preds)
            all_labels.extend(lbls.tolist())
    acc  = accuracy_score(all_labels, all_preds)
    prec = precision_score(all_labels, all_preds, average="macro", zero_division=0)
    rec  = recall_score(all_labels, all_preds, average="macro", zero_division=0)
    f1   = f1_score(all_labels, all_preds, average="macro", zero_division=0)
    cm   = confusion_matrix(all_labels, all_preds, labels=list(range(NUM_CLASSES))).tolist()
    return {"acc": acc, "precision": prec, "recall": rec, "f1": f1, "cm": cm}

def train_epoch(loader, optimizer, criterion):
    model.train()
    total_loss, total_correct, total = 0.0, 0, 0
    for imgs, lbls in loader:
        imgs, lbls = imgs.to(device), lbls.to(device)
        optimizer.zero_grad()
        out  = model(imgs)
        loss = criterion(out, lbls)
        loss.backward()
        optimizer.step()
        total_loss    += loss.item() * imgs.size(0)
        total_correct += (out.argmax(1) == lbls).sum().item()
        total         += imgs.size(0)
    return total_loss / total, total_correct / total

criterion = nn.CrossEntropyLoss()
best_val_f1   = 0.0
best_epoch    = 0
history       = []

# ── Phase 1: Train head only ──────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("PHASE 1: Training classifier head (backbone frozen)")
print("=" * 60)
freeze_backbone(model)
optimizer = optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=LR_HEAD)
scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=PHASE1_EPOCHS)

for epoch in range(1, PHASE1_EPOCHS + 1):
    t0 = time.time()
    tr_loss, tr_acc = train_epoch(train_loader, optimizer, criterion)
    val_m = evaluate(val_loader)
    scheduler.step()
    elapsed = time.time() - t0
    print(f"  Epoch {epoch:2d}/{PHASE1_EPOCHS} | loss={tr_loss:.4f} acc={tr_acc:.3f} | "
          f"val_acc={val_m['acc']:.3f} val_f1={val_m['f1']:.3f} | {elapsed:.1f}s")
    history.append({"phase": 1, "epoch": epoch, **val_m})

    if val_m["f1"] > best_val_f1:
        best_val_f1 = val_m["f1"]
        best_epoch  = epoch
        torch.save(model.state_dict(), CHECKPOINT)
        print(f"    ✓ Saved best checkpoint (val_f1={best_val_f1:.4f})")

# ── Phase 2: Fine-tune top layers ─────────────────────────────────────────────────
print("\n" + "=" * 60)
print("PHASE 2: Fine-tuning top backbone layers")
print("=" * 60)
unfreeze_top_layers(model, n=10)
optimizer = optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=LR_FINETUNE)
scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=PHASE2_EPOCHS)

for epoch in range(1, PHASE2_EPOCHS + 1):
    t0 = time.time()
    tr_loss, tr_acc = train_epoch(train_loader, optimizer, criterion)
    val_m = evaluate(val_loader)
    scheduler.step()
    elapsed = time.time() - t0
    print(f"  Epoch {epoch:2d}/{PHASE2_EPOCHS} | loss={tr_loss:.4f} acc={tr_acc:.3f} | "
          f"val_acc={val_m['acc']:.3f} val_f1={val_m['f1']:.3f} | {elapsed:.1f}s")
    history.append({"phase": 2, "epoch": epoch, **val_m})

    if val_m["f1"] > best_val_f1:
        best_val_f1 = val_m["f1"]
        best_epoch  = epoch
        torch.save(model.state_dict(), CHECKPOINT)
        print(f"    ✓ Saved best checkpoint (val_f1={best_val_f1:.4f})")

# ── Final evaluation on test set ──────────────────────────────────────────────────
print("\n" + "=" * 60)
print("FINAL TEST SET EVALUATION")
print("=" * 60)
# Load best checkpoint
model.load_state_dict(torch.load(CHECKPOINT, map_location=device))
test_m = evaluate(test_loader)
print(f"  Test Accuracy  : {test_m['acc']:.4f}")
print(f"  Test Precision : {test_m['precision']:.4f}")
print(f"  Test Recall    : {test_m['recall']:.4f}")
print(f"  Test F1 (macro): {test_m['f1']:.4f}")
print(f"\n  Confusion Matrix (rows=true, cols=pred):")
print(f"  Classes: {LABEL_NAMES}")
for i, row in enumerate(test_m["cm"]):
    print(f"  {LABEL_NAMES[i]:12s}: {row}")

# ── Save metrics ───────────────────────────────────────────────────────────────────
metrics = {
    "model": "MobileNetV2",
    "dataset": "Rayford295/BiTemporal-StreetView-Damage",
    "num_classes": NUM_CLASSES,
    "label_names": LABEL_NAMES,
    "best_val_f1": best_val_f1,
    "best_epoch": best_epoch,
    "test": test_m,
    "training_history": history,
    "img_size": list(IMG_SIZE),
    "batch_size": BATCH_SIZE,
    "phase1_epochs": PHASE1_EPOCHS,
    "phase2_epochs": PHASE2_EPOCHS,
}
with open(METRICS_FILE, "w") as f:
    json.dump(metrics, f, indent=2)

print(f"\nMetrics saved to: {METRICS_FILE}")
print(f"Model checkpoint: {CHECKPOINT}")
print("\nTraining complete.")
