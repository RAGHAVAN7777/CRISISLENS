"""
Phase 4: Train DisasterTypeClassifier using MobileNetV2 + Transfer Learning
Trained on QCRI/MEDIC dataset (7 classes):
['earthquake', 'flood', 'hurricane', 'fire', 'landslide', 'not_disaster', 'other_disaster']
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
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

PROCESSED_DIR = "ml/medic/processed"
MODELS_DIR = "ml/models"
CHECKPOINT = os.path.join(MODELS_DIR, "disaster_type_classifier.pth")
METRICS_FILE = os.path.join(PROCESSED_DIR, "metrics.json")
RESULTS_DIR = "ml/results"

os.makedirs(MODELS_DIR, exist_ok=True)
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
BATCH_SIZE = 32
PHASE1_EPOCHS = 4
PHASE2_EPOCHS = 6
LR_HEAD = 1e-3
LR_FINETUNE = 2e-4

device = (
    "mps" if torch.backends.mps.is_available()
    else "cuda" if torch.cuda.is_available()
    else "cpu"
)
print(f"Using device for training: {device}")

# Dataset definition
class MedicDataset(Dataset):
    def __init__(self, csv_path, base_dir, transform=None):
        self.base_dir = base_dir
        self.transform = transform
        self.samples = []
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

# Transforms
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

train_tf = transforms.Compose([
    transforms.Resize(IMG_SIZE),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(15),
    transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
    transforms.ToTensor(),
    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])

val_tf = transforms.Compose([
    transforms.Resize(IMG_SIZE),
    transforms.ToTensor(),
    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])

# Load datasets
train_ds = MedicDataset(os.path.join(PROCESSED_DIR, "train.csv"), PROCESSED_DIR, train_tf)
val_ds = MedicDataset(os.path.join(PROCESSED_DIR, "val.csv"), PROCESSED_DIR, val_tf)
test_ds = MedicDataset(os.path.join(PROCESSED_DIR, "test.csv"), PROCESSED_DIR, val_tf)

print(f"Dataset splits: Train={len(train_ds)}, Val={len(val_ds)}, Test={len(test_ds)}")

# Weighted sampler for class balance
train_labels = [s[1] for s in train_ds.samples]
class_counts = Counter(train_labels)
class_weights = {c: 1.0 / max(class_counts[c], 1) for c in range(NUM_CLASSES)}
sample_weights = [class_weights[lbl] for lbl in train_labels]
sampler = WeightedRandomSampler(sample_weights, num_samples=len(train_ds), replacement=True)

train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=sampler, num_workers=0)
val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
test_loader = DataLoader(test_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

# Build Model: MobileNetV2
model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)
model.classifier = nn.Sequential(
    nn.Dropout(0.3),
    nn.Linear(model.last_channel, NUM_CLASSES)
)
model = model.to(device)

def freeze_backbone(m):
    for p in m.features.parameters():
        p.requires_grad = False

def unfreeze_top_layers(m, n=8):
    for block in list(m.features.children())[-n:]:
        for p in block.parameters():
            p.requires_grad = True

def evaluate(loader):
    model.eval()
    all_preds, all_labels = [], []
    total_loss, total = 0.0, 0
    criterion = nn.CrossEntropyLoss()
    with torch.no_grad():
        for imgs, lbls in loader:
            imgs, lbls = imgs.to(device), lbls.to(device)
            out = model(imgs)
            loss = criterion(out, lbls)
            total_loss += loss.item() * imgs.size(0)
            preds = out.argmax(dim=1).cpu().tolist()
            all_preds.extend(preds)
            all_labels.extend(lbls.cpu().tolist())
            total += imgs.size(0)
            
    acc = accuracy_score(all_labels, all_preds)
    prec = precision_score(all_labels, all_preds, average="macro", zero_division=0)
    rec = recall_score(all_labels, all_preds, average="macro", zero_division=0)
    f1 = f1_score(all_labels, all_preds, average="macro", zero_division=0)
    cm = confusion_matrix(all_labels, all_preds, labels=list(range(NUM_CLASSES))).tolist()
    return {
        "loss": total_loss / max(total, 1),
        "acc": acc,
        "precision": prec,
        "recall": rec,
        "f1": f1,
        "cm": cm,
    }

def train_epoch(loader, optimizer, criterion):
    model.train()
    total_loss, total_correct, total = 0.0, 0, 0
    for imgs, lbls in loader:
        imgs, lbls = imgs.to(device), lbls.to(device)
        optimizer.zero_grad()
        out = model(imgs)
        loss = criterion(out, lbls)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * imgs.size(0)
        total_correct += (out.argmax(1) == lbls).sum().item()
        total += imgs.size(0)
    return total_loss / max(total, 1), total_correct / max(total, 1)

criterion = nn.CrossEntropyLoss()
best_val_f1 = 0.0
best_epoch = 0
history = []

print("\n" + "=" * 60)
print("PHASE 1: Training Classification Head (Backbone Frozen)")
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
    print(f"Epoch {epoch}/{PHASE1_EPOCHS} | Train Loss: {tr_loss:.4f}, Train Acc: {tr_acc*100:.1f}% | Val Loss: {val_m['loss']:.4f}, Val Acc: {val_m['acc']*100:.1f}%, Val F1: {val_m['f1']*100:.1f}% | {elapsed:.1f}s")
    history.append({"phase": 1, "epoch": epoch, "train_loss": tr_loss, "train_acc": tr_acc, **val_m})
    
    if val_m["f1"] > best_val_f1:
        best_val_f1 = val_m["f1"]
        best_epoch = epoch
        torch.save(model.state_dict(), CHECKPOINT)
        print(f"  --> Saved Best Checkpoint (val_f1={best_val_f1:.4f})")

print("\n" + "=" * 60)
print("PHASE 2: Fine-Tuning Top Backbone Layers")
print("=" * 60)
unfreeze_top_layers(model, n=8)
optimizer = optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=LR_FINETUNE)
scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=PHASE2_EPOCHS)

for epoch in range(1, PHASE2_EPOCHS + 1):
    t0 = time.time()
    tr_loss, tr_acc = train_epoch(train_loader, optimizer, criterion)
    val_m = evaluate(val_loader)
    scheduler.step()
    elapsed = time.time() - t0
    print(f"Epoch {epoch}/{PHASE2_EPOCHS} | Train Loss: {tr_loss:.4f}, Train Acc: {tr_acc*100:.1f}% | Val Loss: {val_m['loss']:.4f}, Val Acc: {val_m['acc']*100:.1f}%, Val F1: {val_m['f1']*100:.1f}% | {elapsed:.1f}s")
    history.append({"phase": 2, "epoch": epoch, "train_loss": tr_loss, "train_acc": tr_acc, **val_m})
    
    if val_m["f1"] > best_val_f1:
        best_val_f1 = val_m["f1"]
        best_epoch = epoch
        torch.save(model.state_dict(), CHECKPOINT)
        print(f"  --> Saved Best Checkpoint (val_f1={best_val_f1:.4f})")

# Final Evaluation on Test Set
print("\n" + "=" * 60)
print("FINAL TEST SET EVALUATION")
print("=" * 60)
model.load_state_dict(torch.load(CHECKPOINT, map_location=device))
test_m = evaluate(test_loader)
print(f"Test Accuracy : {test_m['acc']*100:.2f}%")
print(f"Test Precision: {test_m['precision']*100:.2f}%")
print(f"Test Recall   : {test_m['recall']*100:.2f}%")
print(f"Test Macro F1 : {test_m['f1']*100:.2f}%")

metrics_data = {
    "model": "MobileNetV2 (QCRI/MEDIC)",
    "task": "Disaster Type Classification",
    "classes": LABEL_NAMES,
    "num_classes": NUM_CLASSES,
    "best_val_f1": best_val_f1,
    "test_metrics": test_m,
    "training_history": history,
}

with open(METRICS_FILE, "w") as f:
    json.dump(metrics_data, f, indent=2)

print(f"\nModel saved to: {CHECKPOINT}")
print(f"Metrics saved to: {METRICS_FILE}")
print("Training Complete!")
